"""Pozo de amigos: app web cerrada (Flask + SQLite).

- Acceso solo con código personal (lo genera el administrador).
- Cada día hay una ronda: se reservan números, el admin marca los pagados.
- El sorteo es verificable (compromiso SHA-256 publicado antes de vender).
- El "banco grupal" es un libro de movimientos que no se edita ni se borra.
- No procesa pagos: el dinero se entrega fuera de la web.
"""
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from functools import wraps

from flask import (Flask, Response, abort, flash, g, redirect,
                   render_template, request, session, url_for)
from markupsafe import Markup

from animals import ANIMALS
import domino_engine as dom

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "pozo.db"))
ADMIN_CODE = os.environ.get("ADMIN_CODE", "").strip()
NUMBER_RANGE = max(10, min(int(os.environ.get("NUMBER_RANGE", "100")), len(ANIMALS)))
DEFAULT_PRICE_CENTS = int(os.environ.get("PRICE_CENTS", "100"))
MAX_TICKETS = int(os.environ.get("MAX_TICKETS_PER_MEMBER", "10"))
TZ = timezone(timedelta(hours=-5))  # Ecuador continental, sin horario de verano

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY") or secrets.token_hex(32),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=bool(os.environ.get("RENDER")),
    PERMANENT_SESSION_LIFETIME=timedelta(days=30),
    MAX_CONTENT_LENGTH=64 * 1024,
)
if os.environ.get("RENDER"):
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

if len(ADMIN_CODE) < 10:
    print("AVISO: define ADMIN_CODE (mínimo 10 caracteres) o nadie podrá administrar.")

SCHEMA = """
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  is_fixed INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  accepted_rules_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL,
  seed TEXT NOT NULL,
  commitment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  drawn_at TEXT,
  winning_number INTEGER,
  winner_member_id INTEGER REFERENCES members(id),
  pot_cents INTEGER,
  prize_cents INTEGER,
  bank_cents INTEGER,
  prize_paid INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL REFERENCES rounds(id),
  member_id INTEGER NOT NULL REFERENCES members(id),
  number INTEGER NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(round_id, number)
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  round_id INTEGER,
  created_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  white_key TEXT, white_name TEXT,
  black_key TEXT, black_name TEXT,
  moves TEXT NOT NULL DEFAULT '[]',
  ply INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  result TEXT NOT NULL DEFAULT '',
  winner TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dgames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_key TEXT NOT NULL,
  seats TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  state TEXT NOT NULL DEFAULT '{}',
  scores TEXT NOT NULL DEFAULT '[0,0]',
  round_no INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"""

KIND_LABEL = {
    "round_bank": "Aporte de la ronda",
    "inversion": "Inversión",
    "retorno": "Retorno de inversión",
    "reparto": "Reparto a miembros",
    "ajuste": "Ajuste / corrección",
}
# signo: -1 sale del banco, 1 entra, 0 lo decide el admin al escribir el monto
LEDGER_FORM_KINDS = {"inversion": -1, "retorno": 1, "reparto": -1, "ajuste": 0}

DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ---------------------------------------------------------------- base de datos
def init_db():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript(SCHEMA)
    con.commit()
    con.close()


init_db()


def get_db():
    if "db" not in g:
        con = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys = ON")
        g.db = con
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


@contextmanager
def tx():
    """Transacción que bloquea escrituras concurrentes (evita carreras)."""
    db = get_db()
    db.execute("BEGIN IMMEDIATE")
    try:
        yield db
        db.execute("COMMIT")
    except Exception:
        db.execute("ROLLBACK")
        raise


# ---------------------------------------------------------------- utilidades
def now():
    return datetime.now(TZ)


def today():
    return now().strftime("%Y-%m-%d")


def iso():
    return now().isoformat(timespec="seconds")


def get_setting(key, default=None):
    row = get_db().execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key, value):
    get_db().execute(
        "INSERT INTO settings(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, str(value)),
    )


def parse_cents(text):
    t = (text or "").strip().replace(",", ".")
    try:
        d = Decimal(t)
    except InvalidOperation:
        return None
    if not d.is_finite():
        return None
    cents = int((d * 100).to_integral_value(rounding=ROUND_HALF_UP))
    if abs(cents) > 100_000_000:
        return None
    return cents


@app.template_filter("money")
def money(cents):
    if cents is None:
        return "—"
    sign = "-" if cents < 0 else ""
    return f"{sign}${Decimal(abs(cents)) / 100:,.2f}"


@app.template_filter("fecha")
def fecha(day):
    d = datetime.strptime(day, "%Y-%m-%d")
    return f"{DIAS[d.weekday()]} {d.day} {MESES[d.month - 1]} {d.year}"


@app.template_filter("hora")
def hora(ts):
    try:
        return datetime.fromisoformat(ts).strftime("%d/%m/%Y %H:%M")
    except (TypeError, ValueError):
        return ts or ""


def animal(n):
    return {"name": ANIMALS[n - 1]}


def animal_label(n):
    return f"{n} ({ANIMALS[n - 1]})"


app.jinja_env.globals["animal"] = animal


def norm_code(raw):
    return re.sub(r"[^a-z0-9]", "", (raw or "").lower())


def hash_code(norm):
    return hashlib.sha256(norm.encode()).hexdigest()


def generate_code():
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    raw = "".join(secrets.choice(alphabet) for _ in range(12))
    return "-".join(raw[i:i + 4] for i in range(0, 12, 4))


def admin_marker():
    return hashlib.sha256(("v1:" + ADMIN_CODE).encode()).hexdigest()[:16]


# ---------------------------------------------------------------- sesión y seguridad
def csrf_token():
    if "_csrf" not in session:
        session["_csrf"] = secrets.token_hex(16)
    return session["_csrf"]


def csrf_field():
    return Markup('<input type="hidden" name="_csrf" value="%s">') % csrf_token()


def current_user():
    if "user" in g:
        return g.user
    user = None
    role = session.get("role")
    if role == "admin" and ADMIN_CODE and session.get("av") == admin_marker():
        user = {"role": "admin", "name": "Administrador", "id": None, "accepted": True}
    elif role == "member":
        row = get_db().execute(
            "SELECT * FROM members WHERE id=? AND active=1", (session.get("member_id"),)
        ).fetchone()
        if row:
            user = {"role": "member", "name": row["name"], "id": row["id"],
                    "accepted": bool(row["accepted_rules_at"])}
    g.user = user
    return user


def login_required(f):
    @wraps(f)
    def wrapper(*a, **k):
        if not current_user():
            return redirect(url_for("login"))
        return f(*a, **k)
    return wrapper


def member_required(f):
    @wraps(f)
    def wrapper(*a, **k):
        user = current_user()
        if not user:
            return redirect(url_for("login"))
        if user["role"] != "member":
            flash("Esta acción es solo para miembros.", "error")
            return redirect(url_for("home"))
        return f(*a, **k)
    return wrapper


def admin_required(f):
    @wraps(f)
    def wrapper(*a, **k):
        user = current_user()
        if not user:
            return redirect(url_for("login"))
        if user["role"] != "admin":
            abort(403)
        return f(*a, **k)
    return wrapper


@app.context_processor
def inject():
    return {"user": current_user(), "csrf_field": csrf_field,
            "number_range": NUMBER_RANGE, "max_tickets": MAX_TICKETS,
            "kind_label": KIND_LABEL, "animal": animal, "csrf_token": csrf_token}


@app.before_request
def csrf_protect():
    if request.method == "POST":
        sent = (request.form.get("_csrf") or "").encode()
        expected = (session.get("_csrf") or "").encode()
        if not expected or not hmac.compare_digest(sent, expected):
            abort(400)


@app.before_request
def rules_gate():
    ep = request.endpoint or ""
    if ep in ("static", "login", "robots", "health", "rules", "accept_rules", "logout"):
        return None
    user = current_user()
    if user and user["role"] == "member" and not user["accepted"]:
        return redirect(url_for("rules"))
    return None


@app.after_request
def security_headers(resp):
    resp.headers["X-Robots-Tag"] = "noindex, nofollow"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "same-origin"
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; style-src 'self'; script-src 'self'; "
        "img-src 'self' data:; form-action 'self'; frame-ancestors 'none'"
    )
    if request.endpoint != "static":
        resp.headers["Cache-Control"] = "no-store"
    return resp


_FAILS = {}


def too_many_attempts(ip):
    t = time.time()
    recent = [x for x in _FAILS.get(ip, []) if t - x < 600]
    _FAILS[ip] = recent
    if len(_FAILS) > 500:
        for k in [k for k, v in _FAILS.items() if not v]:
            _FAILS.pop(k, None)
    return len(recent) >= 8


def record_fail(ip):
    _FAILS.setdefault(ip, []).append(time.time())


# ---------------------------------------------------------------- lógica del sorteo
def get_or_create_round(day):
    db = get_db()
    row = db.execute("SELECT * FROM rounds WHERE day=?", (day,)).fetchone()
    if row:
        return row
    seed = secrets.token_hex(32)
    commitment = hashlib.sha256(seed.encode()).hexdigest()
    price = int(get_setting("price_cents", DEFAULT_PRICE_CENTS))
    db.execute(
        "INSERT OR IGNORE INTO rounds(day, price_cents, seed, commitment, created_at) "
        "VALUES(?, ?, ?, ?, ?)",
        (day, price, seed, commitment, iso()),
    )
    return db.execute("SELECT * FROM rounds WHERE day=?", (day,)).fetchone()


def compute_winner(seed, day, numbers):
    """Fórmula pública. Debe coincidir con static/app.js y con la página de verificación."""
    nums = sorted(numbers)
    payload = f"{seed}|{day}|{','.join(str(n) for n in nums)}"
    digest = hashlib.sha256(payload.encode()).hexdigest()
    index = int(digest, 16) % len(nums)
    return nums[index], digest, payload


def ledger_totals():
    rows = get_db().execute(
        "SELECT kind, COALESCE(SUM(amount_cents), 0) AS s FROM ledger GROUP BY kind"
    ).fetchall()
    by = {r["kind"]: r["s"] for r in rows}
    return {
        "balance": sum(by.values()),
        "aportes": by.get("round_bank", 0),
        "invertido": -by.get("inversion", 0),
        "retornos": by.get("retorno", 0),
        "repartido": -by.get("reparto", 0),
        "ajustes": by.get("ajuste", 0),
    }


def load_rules():
    try:
        with open(os.path.join(BASE_DIR, "rules.txt"), encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        text = "## Reglas\n\nTodavía no hay reglas escritas."
    blocks = []
    for chunk in [c for c in text.split("\n\n") if c.strip()]:
        lines = [l.rstrip() for l in chunk.strip("\n").split("\n")]
        if lines and lines[0].startswith("## "):
            blocks.append(("h2", lines[0][3:].strip()))
            lines = lines[1:]
        if not lines:
            continue
        if all(l.startswith("- ") for l in lines):
            blocks.append(("ul", [l[2:] for l in lines]))
        elif all(re.match(r"^\d+\. ", l) for l in lines):
            blocks.append(("ol", [re.sub(r"^\d+\. ", "", l) for l in lines]))
        else:
            blocks.append(("p", " ".join(lines)))
    return blocks


# ---------------------------------------------------------------- rutas públicas
@app.route("/robots.txt")
def robots():
    return Response("User-agent: *\nDisallow: /\n", mimetype="text/plain")


@app.route("/salud")
def health():
    """Para el vigía externo (UptimeRobot, cron-job.org...). No pide login, no toca la base de datos
    y no muestra nada del grupo: solo responde 'ok'."""
    return Response("ok", mimetype="text/plain")


@app.route("/entrar", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        ip = request.remote_addr or "?"
        if too_many_attempts(ip):
            flash("Demasiados intentos. Espera unos minutos.", "error")
            return render_template("login.html"), 429
        raw = (request.form.get("code") or "").strip()
        if ADMIN_CODE and hmac.compare_digest(raw.encode(), ADMIN_CODE.encode()):
            session.clear()
            session["role"] = "admin"
            session["av"] = admin_marker()
            session.permanent = True
            return redirect(url_for("admin"))
        norm = norm_code(raw)
        row = None
        if norm:
            row = get_db().execute(
                "SELECT * FROM members WHERE code_hash=? AND active=1", (hash_code(norm),)
            ).fetchone()
        if row:
            session.clear()
            session["role"] = "member"
            session["member_id"] = row["id"]
            session.permanent = True
            return redirect(url_for("home"))
        record_fail(ip)
        flash("Código no válido.", "error")
    return render_template("login.html")


@app.route("/salir", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


# ---------------------------------------------------------------- rutas de miembros
@app.route("/")
@login_required
def home():
    db = get_db()
    user = current_user()
    rnd = get_or_create_round(today())
    tickets = db.execute(
        "SELECT t.*, m.name FROM tickets t JOIN members m ON m.id=t.member_id "
        "WHERE t.round_id=? ORDER BY t.number", (rnd["id"],)
    ).fetchall()
    by_number = {t["number"]: t for t in tickets}
    mine = [t for t in tickets if user["id"] is not None and t["member_id"] == user["id"]]
    paid_count = sum(1 for t in tickets if t["paid"])
    winner = None
    if rnd["status"] == "drawn":
        winner = db.execute("SELECT name FROM members WHERE id=?",
                            (rnd["winner_member_id"],)).fetchone()
    return render_template(
        "home.html", rnd=rnd, tickets=tickets, by_number=by_number, mine=mine,
        paid_count=paid_count, pot=paid_count * rnd["price_cents"],
        winner=winner, totals=ledger_totals(),
        auto_time=auto_draw_settings()[1] if auto_draw_settings()[0] else None,
    )


@app.route("/reservar", methods=["POST"])
@member_required
def reserve():
    user = current_user()
    wanted = set()
    for v in request.form.getlist("n"):
        try:
            n = int(v)
        except ValueError:
            continue
        if 1 <= n <= NUMBER_RANGE:
            wanted.add(n)
    if not wanted:
        flash("Elige al menos un número.", "error")
        return redirect(url_for("home"))
    taken, ok = [], []
    with tx() as db:
        rnd = get_or_create_round(today())
        if rnd["status"] != "open":
            flash("Las ventas de hoy ya están cerradas.", "error")
            return redirect(url_for("home"))
        have = db.execute(
            "SELECT COUNT(*) AS c FROM tickets WHERE round_id=? AND member_id=?",
            (rnd["id"], user["id"]),
        ).fetchone()["c"]
        if have + len(wanted) > MAX_TICKETS:
            flash(f"Máximo {MAX_TICKETS} números por persona en cada ronda.", "error")
            return redirect(url_for("home"))
        for n in sorted(wanted):
            try:
                db.execute(
                    "INSERT INTO tickets(round_id, member_id, number, created_at) "
                    "VALUES(?, ?, ?, ?)", (rnd["id"], user["id"], n, iso()))
                ok.append(n)
            except sqlite3.IntegrityError:
                taken.append(n)
    if ok:
        flash("Reservaste: " + ", ".join(animal_label(n) for n in ok) +
              ". Págale al administrador para que los marque como pagados; "
              "hasta entonces no entran al sorteo.", "ok")
    if taken:
        flash("Ya estaban tomados: " + ", ".join(animal_label(n) for n in taken) + ".", "error")
    return redirect(url_for("home"))


@app.route("/cancelar/<int:tid>", methods=["POST"])
@member_required
def cancel_ticket(tid):
    user = current_user()
    with tx() as db:
        cur = db.execute(
            "DELETE FROM tickets WHERE id=? AND member_id=? AND paid=0 AND round_id IN "
            "(SELECT id FROM rounds WHERE status='open')", (tid, user["id"]))
    flash("Reserva cancelada." if cur.rowcount else "No se pudo cancelar esa reserva.",
          "ok" if cur.rowcount else "error")
    return redirect(url_for("home"))


@app.route("/ronda/<day>")
@login_required
def round_page(day):
    if not DAY_RE.match(day):
        abort(404)
    db = get_db()
    rnd = db.execute("SELECT * FROM rounds WHERE day=?", (day,)).fetchone()
    if not rnd:
        abort(404)
    tickets = db.execute(
        "SELECT t.*, m.name FROM tickets t JOIN members m ON m.id=t.member_id "
        "WHERE t.round_id=? ORDER BY t.number", (rnd["id"],)).fetchall()
    winner = None
    numbers = [t["number"] for t in tickets if t["paid"]]
    if rnd["status"] == "drawn":
        winner = db.execute("SELECT name FROM members WHERE id=?",
                            (rnd["winner_member_id"],)).fetchone()
    ordered = sorted(numbers)
    return render_template(
        "round.html", rnd=rnd, tickets=tickets, winner=winner,
        numbers_csv=",".join(str(n) for n in ordered))


@app.route("/historial")
@login_required
def history():
    rows = get_db().execute(
        "SELECT r.*, m.name AS winner_name FROM rounds r "
        "LEFT JOIN members m ON m.id=r.winner_member_id "
        "WHERE r.status='drawn' ORDER BY r.day DESC LIMIT 200").fetchall()
    return render_template("history.html", rows=rows)


@app.route("/ajedrez")
@login_required
def chess():
    return render_template("chess.html")


# ---------------------------------------------------------------- ajedrez en línea
# Las jugadas se guardan como [origen, destino, coronación]. El servidor controla de quién es el turno
# y que no se pisen dos jugadas, pero no sabe de reglas de ajedrez: cada navegador las verifica.
GAME_RESULTS = {"mate", "stalemate", "insufficient", "fifty", "repetition"}
MAX_ACTIVE_GAMES = 5
MAX_PLIES = 600


def player_key(user):
    return "a" if user["role"] == "admin" else f"m{user['id']}"


def game_color(game, user):
    key = player_key(user)
    if game["white_key"] == key:
        return "w"
    if game["black_key"] == key:
        return "b"
    return ""


def json_response(data, status=200):
    return Response(json.dumps(data), status=status, mimetype="application/json",
                    headers={"Cache-Control": "no-store"})


def load_game(game_id):
    row = get_db().execute("SELECT * FROM games WHERE id=?", (game_id,)).fetchone()
    if not row:
        abort(404)
    return row


@app.route("/domino")
@login_required
def domino():
    return render_template("domino.html")


# ---------------------------------------------------------------- dominó en línea
# El servidor reparte, valida cada jugada y guarda las fichas de cada uno (nadie ve las ajenas).
# Los asientos vacíos los juega la computadora. Los turnos automáticos avanzan cuando alguien consulta la mesa.
DOMINO_PACE = float(os.environ.get("DOMINO_PACE", "0.9"))  # segundos entre jugadas automáticas
MAX_DOMINO_GAMES = 3


@contextmanager
def dom_tx(game_id):
    db = get_db()
    db.execute("BEGIN IMMEDIATE")
    try:
        row = db.execute("SELECT * FROM dgames WHERE id=?", (game_id,)).fetchone()
        if not row:
            abort(404)
        g = dict(row)
        g["seats"] = json.loads(g["seats"])
        g["state"] = json.loads(g["state"])
        g["scores"] = json.loads(g["scores"])
        g["dirty"], g["delete"] = False, False
        yield g
        if g["delete"]:
            db.execute("DELETE FROM dgames WHERE id=?", (game_id,))
        elif g["dirty"]:
            db.execute("UPDATE dgames SET seats=?, status=?, state=?, scores=?, round_no=?, updated_at=? WHERE id=?",
                       (json.dumps(g["seats"]), g["status"], json.dumps(g["state"]), json.dumps(g["scores"]),
                        g["round_no"], int(time.time()), game_id))
        db.execute("COMMIT")
    except BaseException:
        db.execute("ROLLBACK")
        raise


def dom_seat(g, user):
    key = player_key(user)
    for i, s in enumerate(g["seats"]):
        if s and not s["bot"] and s["key"] == key:
            return i
    return -1


def dom_after(g):
    st = g["state"]
    if st["over"]:
        if st["reason"] != "tranca-empate" and st["winner"] >= 0:
            g["scores"][st["winner"] % 2] += st["points"]
        if max(g["scores"]) >= dom.TARGET:
            g["status"] = "over"
    g["dirty"] = True


def dom_start(g, now):
    n = 0
    for i, s in enumerate(g["seats"]):
        if s is None:
            n += 1
            g["seats"][i] = {"key": "", "name": f"Computadora {n}", "bot": True}
    g["status"], g["scores"], g["round_no"] = "playing", [0, 0], 1
    g["state"] = dom.new_round(None)
    g["state"]["t"] = now
    g["dirty"] = True


def dom_advance(g, now):
    """Juega los turnos de la computadora (y los pases forzados) con un ritmo pausado."""
    st = g["state"]
    if g["status"] != "playing" or st["over"]:
        return
    if now - st["t"] > 3 * DOMINO_PACE:
        st["t"] = now - DOMINO_PACE
    for _ in range(2):
        if st["over"] or now - st["t"] < DOMINO_PACE:
            break
        seat = st["turn"]
        is_bot = g["seats"][seat]["bot"]
        m = dom.bot_move(st, seat) if is_bot else None
        if m:
            dom.play(st, seat, m["i"], m["side"])
        elif is_bot or not dom.legal(st, seat):
            dom.pass_turn(st, seat)
        else:
            break  # espera a la persona
        st["t"] += DOMINO_PACE
        if st["over"]:
            dom_after(g)
        g["dirty"] = True


def dom_view(g, seat):
    st = g["state"]
    started = g["status"] != "open"
    v = {"id": g["id"], "status": g["status"], "you": seat, "scores": g["scores"], "round_no": g["round_no"],
         "target": dom.TARGET, "seats": [({"name": s["name"], "bot": s["bot"]} if s else None) for s in g["seats"]]}
    if started:
        v.update({
            "chain": st["chain"], "turn": st["turn"], "over": st["over"], "winner": st["winner"],
            "reason": st["reason"], "points": st["points"], "seq": st["seq"], "log": st["log"][-6:],
            "counts": [len(h) for h in st["hands"]],
            "hand": st["hands"][seat] if seat >= 0 else [],
            "legal": dom.legal(st, seat) if (seat >= 0 and st["turn"] == seat and not st["over"]) else [],
            "hands": st["hands"] if st["over"] else None,
        })
    return v


@app.route("/domino/linea")
@login_required
def domino_lobby():
    db, user = get_db(), current_user()
    db.execute("DELETE FROM dgames WHERE updated_at < ?", (int(time.time()) - 14 * 86400,))
    key = player_key(user)
    rows, mine, open_games = db.execute("SELECT * FROM dgames ORDER BY id DESC LIMIT 60").fetchall(), [], []
    for r in rows:
        seats = json.loads(r["seats"])
        humans = [s["name"] for s in seats if s and not s["bot"]]
        item = {"id": r["id"], "status": r["status"], "humans": humans, "owner": seats[0]["name"] if seats[0] else ""}
        if any(s and not s["bot"] and s["key"] == key for s in seats):
            mine.append(item)
        elif r["status"] == "open":
            item["free"] = [(i, "Compañero de " + item["owner"] if i == 2 else "Rival de " + item["owner"])
                            for i in (2, 1, 3) if seats[i] is None]
            open_games.append(item)
    return render_template("domino_lobby.html", mine=mine[:15], open_games=open_games[:15])


@app.route("/domino/crear", methods=["POST"])
@login_required
def domino_create():
    user, db = current_user(), get_db()
    key = player_key(user)
    active = sum(1 for r in db.execute("SELECT seats, status FROM dgames WHERE status IN ('open','playing')").fetchall()
                 if any(s and not s["bot"] and s["key"] == key for s in json.loads(r["seats"])))
    if active >= MAX_DOMINO_GAMES:
        flash(f"Ya tienes {MAX_DOMINO_GAMES} mesas activas. Sal de alguna.", "error")
        return redirect(url_for("domino_lobby"))
    seats = [{"key": key, "name": user["name"], "bot": False}, None, None, None]
    now = int(time.time())
    cur = db.execute("INSERT INTO dgames (owner_key, seats, created_at, updated_at) VALUES (?,?,?,?)",
                     (key, json.dumps(seats), now, now))
    return redirect(url_for("domino_table", game_id=cur.lastrowid))


@app.route("/domino/unirse/<int:game_id>", methods=["POST"])
@login_required
def domino_join(game_id):
    user = current_user()
    try:
        seat = int(request.form.get("seat", ""))
    except ValueError:
        seat = -1
    with dom_tx(game_id) as g:
        if g["status"] == "open" and dom_seat(g, user) < 0 and seat in (1, 2, 3) and g["seats"][seat] is None:
            g["seats"][seat] = {"key": player_key(user), "name": user["name"], "bot": False}
            g["dirty"] = True
            if all(g["seats"]):
                dom_start(g, time.time())
    return redirect(url_for("domino_table", game_id=game_id))


@app.route("/domino/empezar/<int:game_id>", methods=["POST"])
@login_required
def domino_begin(game_id):
    user = current_user()
    with dom_tx(game_id) as g:
        if g["status"] == "open" and g["owner_key"] == player_key(user):
            dom_start(g, time.time())
    return json_response({"ok": True})


@app.route("/domino/mesa/<int:game_id>")
@login_required
def domino_table(game_id):
    row = get_db().execute("SELECT status, seats FROM dgames WHERE id=?", (game_id,)).fetchone()
    if not row:
        abort(404)
    seats = json.loads(row["seats"])
    me = any(s and not s["bot"] and s["key"] == player_key(current_user()) for s in seats)
    if not me:
        flash("No estás sentado en esa mesa.", "error")
        return redirect(url_for("domino_lobby"))
    return render_template("domino_mesa.html", game_id=game_id, owner=row["status"] == "open")


@app.route("/domino/estado/<int:game_id>")
@login_required
def domino_state(game_id):
    user = current_user()
    with dom_tx(game_id) as g:
        seat = dom_seat(g, user)
        if seat < 0:
            return json_response({"error": "No estás en esta mesa."}, 403)
        dom_advance(g, time.time())
        view = dom_view(g, seat)
        view["owner"] = g["owner_key"] == player_key(user)
    return json_response(view)


@app.route("/domino/jugar/<int:game_id>", methods=["POST"])
@login_required
def domino_move(game_id):
    user = current_user()
    try:
        i, side = int(request.form["i"]), request.form["side"]
    except (KeyError, ValueError):
        return json_response({"error": "Jugada inválida."}, 400)
    with dom_tx(game_id) as g:
        seat = dom_seat(g, user)
        if seat < 0 or g["status"] != "playing":
            return json_response({"error": "No puedes jugar aquí."}, 409)
        try:
            dom.play(g["state"], seat, i, side)
        except ValueError:
            return json_response({"error": "Esa jugada no es válida ahora."}, 409)
        g["state"]["t"] = time.time()
        if g["state"]["over"]:
            dom_after(g)
        g["dirty"] = True
        view = dom_view(g, seat)
        view["owner"] = g["owner_key"] == player_key(user)
    return json_response(view)


@app.route("/domino/siguiente/<int:game_id>", methods=["POST"])
@login_required
def domino_next(game_id):
    user = current_user()
    with dom_tx(game_id) as g:
        st = g["state"]
        if dom_seat(g, user) >= 0 and g["status"] == "playing" and st.get("over"):
            starter = st["winner"] if st["winner"] >= 0 else st["starter"]
            g["state"] = dom.new_round(starter)
            g["state"]["t"] = time.time()
            g["round_no"] += 1
            g["dirty"] = True
    return json_response({"ok": True})


@app.route("/domino/salir/<int:game_id>", methods=["POST"])
@login_required
def domino_leave(game_id):
    user = current_user()
    with dom_tx(game_id) as g:
        seat = dom_seat(g, user)
        if seat >= 0:
            if g["status"] == "open":
                if g["owner_key"] == player_key(user):
                    g["delete"] = True
                else:
                    g["seats"][seat] = None
                    g["dirty"] = True
            elif g["status"] == "playing":
                g["seats"][seat] = {"key": "", "name": "Computadora", "bot": True}
                g["dirty"] = True
            if not g["delete"] and not any(s and not s["bot"] for s in g["seats"]):
                g["delete"] = True
    return redirect(url_for("domino_lobby"))


@app.route("/ajedrez/linea")
@login_required
def chess_lobby():
    db = get_db()
    db.execute("DELETE FROM games WHERE updated_at < ?", (int(time.time()) - 14 * 86400,))
    key = player_key(current_user())
    mine = db.execute(
        "SELECT * FROM games WHERE (white_key=? OR black_key=?) ORDER BY updated_at DESC LIMIT 20",
        (key, key)).fetchall()
    open_games = db.execute(
        "SELECT * FROM games WHERE status='open' AND white_key IS NOT ? AND black_key IS NOT ? "
        "ORDER BY id DESC LIMIT 20", (key, key)).fetchall()
    return render_template("chess_lobby.html", mine=mine, open_games=open_games, my_key=key)


@app.route("/ajedrez/crear", methods=["POST"])
@login_required
def chess_create():
    user, db = current_user(), get_db()
    key = player_key(user)
    active = db.execute(
        "SELECT COUNT(*) FROM games WHERE status IN ('open','playing') AND (white_key=? OR black_key=?)",
        (key, key)).fetchone()[0]
    if active >= MAX_ACTIVE_GAMES:
        flash(f"Ya tienes {MAX_ACTIVE_GAMES} partidas activas. Termina o abandona alguna.", "error")
        return redirect(url_for("chess_lobby"))
    color = request.form.get("color", "r")
    if color not in ("w", "b"):
        color = secrets.choice(["w", "b"])
    now = int(time.time())
    cols = ("white_key, white_name" if color == "w" else "black_key, black_name")
    cur = db.execute(f"INSERT INTO games ({cols}, created_at, updated_at) VALUES (?,?,?,?)",
                     (key, user["name"], now, now))
    return redirect(url_for("chess_game", game_id=cur.lastrowid))


@app.route("/ajedrez/unirse/<int:game_id>", methods=["POST"])
@login_required
def chess_join(game_id):
    user, db = current_user(), get_db()
    game = load_game(game_id)
    if game["status"] != "open" or game_color(game, user):
        return redirect(url_for("chess_game", game_id=game_id))
    key, col = player_key(user), ("black" if game["white_key"] else "white")
    now = int(time.time())
    db.execute(f"UPDATE games SET {col}_key=?, {col}_name=?, status='playing', updated_at=? "
               "WHERE id=? AND status='open'", (key, user["name"], now, game_id))
    return redirect(url_for("chess_game", game_id=game_id))


@app.route("/ajedrez/partida/<int:game_id>")
@login_required
def chess_game(game_id):
    game = load_game(game_id)
    return render_template("chess_game.html", game=game, you=game_color(game, current_user()))


def game_state(game, user):
    return {"id": game["id"], "status": game["status"], "result": game["result"],
            "winner": game["winner"], "ply": game["ply"], "moves": json.loads(game["moves"]),
            "white": game["white_name"], "black": game["black_name"],
            "you": game_color(game, user)}


@app.route("/ajedrez/estado/<int:game_id>")
@login_required
def chess_state(game_id):
    return json_response(game_state(load_game(game_id), current_user()))


def parse_move():
    try:
        f, t, p = (int(request.form[k]) for k in ("f", "t", "p"))
    except (KeyError, ValueError):
        return None
    if not (0 <= f < 64 and 0 <= t < 64 and f != t and p in (0, 2, 3, 4, 5)):
        return None
    return [f, t, p]


@app.route("/ajedrez/jugar/<int:game_id>", methods=["POST"])
@login_required
def chess_move(game_id):
    user, db = current_user(), get_db()
    game = load_game(game_id)
    color = game_color(game, user)
    mv = parse_move()
    try:
        ply = int(request.form.get("ply", ""))
    except ValueError:
        ply = -1
    if game["status"] != "playing" or not color or mv is None:
        return json_response({"error": "No se puede jugar aquí."}, 409)
    if ply != game["ply"] or (game["ply"] % 2 == 0) != (color == "w") or game["ply"] >= MAX_PLIES:
        return json_response({"error": "No es tu turno o la partida cambió."}, 409)
    moves = json.loads(game["moves"]) + [mv]
    result = request.form.get("result", "")
    status, res, winner = "playing", "", ""
    if result in GAME_RESULTS:
        status, res = "over", result
        winner = color if result == "mate" else ""
    cur = db.execute(
        "UPDATE games SET moves=?, ply=ply+1, status=?, result=?, winner=?, updated_at=? "
        "WHERE id=? AND ply=? AND status='playing'",
        (json.dumps(moves), status, res, winner, int(time.time()), game_id, ply))
    if cur.rowcount != 1:
        return json_response({"error": "La partida cambió."}, 409)
    return json_response(game_state(load_game(game_id), user))


@app.route("/ajedrez/rendirse/<int:game_id>", methods=["POST"])
@login_required
def chess_resign(game_id):
    user, db = current_user(), get_db()
    game = load_game(game_id)
    color = game_color(game, user)
    if color and game["status"] == "playing":
        db.execute("UPDATE games SET status='over', result='resign', winner=?, updated_at=? "
                   "WHERE id=? AND status='playing'",
                   ("b" if color == "w" else "w", int(time.time()), game_id))
    elif color and game["status"] == "open":  # nadie se unió: se cancela
        db.execute("DELETE FROM games WHERE id=? AND status='open'", (game_id,))
        return redirect(url_for("chess_lobby"))
    return redirect(url_for("chess_game", game_id=game_id))


@app.route("/banco")
@login_required
def bank():
    rows = get_db().execute(
        "SELECT * FROM ledger ORDER BY id DESC LIMIT 500").fetchall()
    return render_template("bank.html", rows=rows, totals=ledger_totals())


@app.route("/reglas")
@login_required
def rules():
    return render_template("rules.html", blocks=load_rules())


@app.route("/reglas/aceptar", methods=["POST"])
@member_required
def accept_rules():
    get_db().execute("UPDATE members SET accepted_rules_at=? WHERE id=?",
                     (iso(), current_user()["id"]))
    return redirect(url_for("home"))


# ---------------------------------------------------------------- administración
@app.route("/admin")
@admin_required
def admin():
    db = get_db()
    day = today()
    get_or_create_round(day)
    rounds_view = []
    for r in db.execute("SELECT * FROM rounds WHERE status='open' ORDER BY day DESC").fetchall():
        tix = db.execute(
            "SELECT t.*, m.name FROM tickets t JOIN members m ON m.id=t.member_id "
            "WHERE t.round_id=? ORDER BY t.number", (r["id"],)).fetchall()
        if r["day"] != day and not tix:
            continue
        rounds_view.append({"round": r, "tickets": tix,
                            "paid": sum(1 for t in tix if t["paid"])})
    pending = db.execute(
        "SELECT r.*, m.name AS winner_name FROM rounds r "
        "JOIN members m ON m.id=r.winner_member_id "
        "WHERE r.status='drawn' AND r.prize_paid=0 ORDER BY r.day DESC").fetchall()
    members = db.execute(
        "SELECT m.*, (SELECT COUNT(*) FROM tickets t JOIN rounds r ON r.id=t.round_id "
        "WHERE t.member_id=m.id AND r.status='drawn') AS jugados "
        "FROM members m ORDER BY m.active DESC, m.name").fetchall()
    return render_template(
        "admin.html", rounds_view=rounds_view, pending=pending, members=members,
        totals=ledger_totals(), price=int(get_setting("price_cents", DEFAULT_PRICE_CENTS)),
        ledger_kinds=LEDGER_FORM_KINDS, today=day,
        auto_enabled=auto_draw_settings()[0], auto_time=auto_draw_settings()[1],
        auto_last=get_setting("auto_draw_last", ""))


def show_code(name, code, regenerated=False):
    return render_template("admin_code.html", name=name, code=code, regenerated=regenerated)


@app.route("/admin/miembros", methods=["POST"])
@admin_required
def admin_add_member():
    name = (request.form.get("name") or "").strip()[:60]
    if not name:
        flash("Escribe el nombre del miembro.", "error")
        return redirect(url_for("admin"))
    code = generate_code()
    get_db().execute(
        "INSERT INTO members(name, code_hash, is_fixed, created_at) VALUES(?, ?, ?, ?)",
        (name, hash_code(norm_code(code)), 1 if request.form.get("fixed") else 0, iso()))
    return show_code(name, code)


@app.route("/admin/miembros/<int:mid>/codigo", methods=["POST"])
@admin_required
def admin_regen_code(mid):
    db = get_db()
    row = db.execute("SELECT * FROM members WHERE id=?", (mid,)).fetchone()
    if not row:
        abort(404)
    code = generate_code()
    db.execute("UPDATE members SET code_hash=? WHERE id=?", (hash_code(norm_code(code)), mid))
    return show_code(row["name"], code, regenerated=True)


@app.route("/admin/miembros/<int:mid>/activo", methods=["POST"])
@admin_required
def admin_toggle_active(mid):
    get_db().execute("UPDATE members SET active = 1 - active WHERE id=?", (mid,))
    return redirect(url_for("admin"))


@app.route("/admin/miembros/<int:mid>/fijo", methods=["POST"])
@admin_required
def admin_toggle_fixed(mid):
    get_db().execute("UPDATE members SET is_fixed = 1 - is_fixed WHERE id=?", (mid,))
    return redirect(url_for("admin"))


@app.route("/admin/precio", methods=["POST"])
@admin_required
def admin_price():
    cents = parse_cents(request.form.get("price"))
    if cents is None or not (1 <= cents <= 1_000_000):
        flash("Precio no válido.", "error")
        return redirect(url_for("admin"))
    with tx() as db:
        set_setting("price_cents", cents)
        # si la ronda de hoy aún no tiene reservas, el precio nuevo aplica ya
        db.execute(
            "UPDATE rounds SET price_cents=? WHERE day=? AND status='open' AND "
            "NOT EXISTS (SELECT 1 FROM tickets WHERE round_id=rounds.id)", (cents, today()))
    flash("Precio actualizado. Rondas con reservas conservan su precio.", "ok")
    return redirect(url_for("admin"))


@app.route("/admin/numero/<int:tid>/pagado", methods=["POST"])
@admin_required
def admin_set_paid(tid):
    value = 1 if request.form.get("valor") == "1" else 0
    get_db().execute(
        "UPDATE tickets SET paid=? WHERE id=? AND round_id IN "
        "(SELECT id FROM rounds WHERE status='open')", (value, tid))
    return redirect(url_for("admin") + "#rondas")


@app.route("/admin/numero/<int:tid>/liberar", methods=["POST"])
@admin_required
def admin_release(tid):
    get_db().execute(
        "DELETE FROM tickets WHERE id=? AND round_id IN "
        "(SELECT id FROM rounds WHERE status='open')", (tid,))
    return redirect(url_for("admin") + "#rondas")


def perform_draw(db, rid, by="admin"):
    """Sortea una ronda abierta. Debe llamarse dentro de tx(). Devuelve (estado, número ganador, día):
    estado = 'ok', 'cerrada' (no estaba abierta) o 'sin_pagos'."""
    rnd = db.execute("SELECT * FROM rounds WHERE id=?", (rid,)).fetchone()
    if not rnd or rnd["status"] != "open":
        return "cerrada", None, None
    paid = db.execute(
        "SELECT number, member_id FROM tickets WHERE round_id=? AND paid=1 ORDER BY number",
        (rid,)).fetchall()
    if not paid:
        return "sin_pagos", None, rnd["day"]
    winning, _digest, _payload = compute_winner(
        rnd["seed"], rnd["day"], [p["number"] for p in paid])
    winner_id = next(p["member_id"] for p in paid if p["number"] == winning)
    pot = rnd["price_cents"] * len(paid)
    prize = pot // 2
    bank = pot - prize
    db.execute("DELETE FROM tickets WHERE round_id=? AND paid=0", (rid,))
    db.execute(
        "UPDATE rounds SET status='drawn', drawn_at=?, winning_number=?, "
        "winner_member_id=?, pot_cents=?, prize_cents=?, bank_cents=? WHERE id=?",
        (iso(), winning, winner_id, pot, prize, bank, rid))
    db.execute(
        "INSERT INTO ledger(created_at, kind, amount_cents, description, round_id, created_by) "
        "VALUES(?, 'round_bank', ?, ?, ?, 'sistema')",
        (iso(), bank, f"Mitad del pozo de la ronda {rnd['day']}", rid))
    set_setting("auto_draw_last", f"{rnd['day']}: sorteo {by}, ganó {animal_label(winning)}")
    return "ok", winning, rnd["day"]


@app.route("/admin/ronda/<int:rid>/sortear", methods=["POST"])
@admin_required
def admin_draw(rid):
    with tx() as db:
        state, winning, day = perform_draw(db, rid, "manual")
    if state == "cerrada":
        flash("Esa ronda no está abierta.", "error")
        return redirect(url_for("admin"))
    if state == "sin_pagos":
        flash("No hay números pagados: no se puede sortear.", "error")
        return redirect(url_for("admin"))
    flash(f"Sorteo hecho: ganó {animal_label(winning)}.", "ok")
    return redirect(url_for("round_page", day=day))


# ---------------------------------------------------------------- cierre automático
AUTO_DRAW_TIME = os.environ.get("AUTO_DRAW_TIME", "19:00")
AUTO_DRAW_ENABLED = os.environ.get("AUTO_DRAW_ENABLED", "1") != "0"
_last_auto_check = [0.0]


def parse_hhmm(text):
    m = re.fullmatch(r"([01]?\d|2[0-3]):([0-5]\d)", (text or "").strip())
    return (int(m.group(1)), int(m.group(2))) if m else None


def auto_draw_settings():
    """(activo, 'HH:MM') con lo que haya guardado el administrador."""
    enabled = get_setting("auto_draw_enabled", "1" if AUTO_DRAW_ENABLED else "0") == "1"
    hhmm = parse_hhmm(get_setting("auto_draw_time", AUTO_DRAW_TIME)) or parse_hhmm("19:00")
    return enabled, f"{hhmm[0]:02d}:{hhmm[1]:02d}"


def maybe_auto_draw():
    """Sortea la ronda de hoy cuando llega la hora (hora de Ecuador) y sortea las rondas de días anteriores
    que quedaron abiertas con números pagados. Si a la hora no hay ningún número pagado, hoy no se sortea solo:
    queda para el sorteo manual. Es seguro llamarla muchas veces y desde varios procesos a la vez."""
    enabled, hhmm = auto_draw_settings()
    if not enabled:
        return 0
    n = now()
    h, m = parse_hhmm(hhmm)
    reached = n >= n.replace(hour=h, minute=m, second=0, microsecond=0)
    day = today()
    done = 0
    db = get_db()
    open_rounds = db.execute(
        "SELECT id, day FROM rounds WHERE status='open' AND (day < ? OR day = ?) ORDER BY day",
        (day, day)).fetchall()
    for r in open_rounds:
        is_today = r["day"] == day
        if is_today and (not reached or get_setting("auto_skip_day") == day):
            continue
        with tx() as dbx:
            state, winning, _d = perform_draw(dbx, r["id"], "automático")
            if state == "sin_pagos" and is_today:
                set_setting("auto_skip_day", day)
                set_setting("auto_draw_last", f"{day}: a las {hhmm} no había números pagados; queda para sorteo manual")
        if state == "ok":
            done += 1
    return done


def _auto_loop():
    while True:
        time.sleep(20)
        try:
            with app.app_context():
                maybe_auto_draw()
        except Exception as exc:  # no tumbar el hilo por un error pasajero
            print("auto-sorteo:", exc)


@app.before_request
def auto_draw_hook():
    # además del hilo: cualquier visita (o el vigía en /salud) revisa la hora, como mucho cada 15 s
    if request.endpoint == "static":
        return
    if time.monotonic() - _last_auto_check[0] < 15:
        return
    _last_auto_check[0] = time.monotonic()
    try:
        maybe_auto_draw()
    except Exception as exc:
        print("auto-sorteo:", exc)


@app.route("/admin/sorteo-auto", methods=["POST"])
@admin_required
def admin_auto_draw():
    hhmm = parse_hhmm(request.form.get("time"))
    if not hhmm:
        flash("Hora no válida. Usa el formato 19:00.", "error")
        return redirect(url_for("admin"))
    set_setting("auto_draw_time", f"{hhmm[0]:02d}:{hhmm[1]:02d}")
    set_setting("auto_draw_enabled", "1" if request.form.get("enabled") == "1" else "0")
    set_setting("auto_skip_day", "")
    flash("Sorteo automático guardado.", "ok")
    return redirect(url_for("admin"))


@app.route("/admin/ronda/<int:rid>/premio", methods=["POST"])
@admin_required
def admin_prize_paid(rid):
    get_db().execute("UPDATE rounds SET prize_paid=1 WHERE id=? AND status='drawn'", (rid,))
    return redirect(url_for("admin") + "#premios")


@app.route("/admin/banco", methods=["POST"])
@admin_required
def admin_ledger():
    kind = request.form.get("kind", "")
    desc = (request.form.get("description") or "").strip()[:200]
    amount = parse_cents(request.form.get("amount"))
    if kind not in LEDGER_FORM_KINDS or not desc or not amount:
        flash("Revisa tipo, monto y descripción.", "error")
        return redirect(url_for("admin") + "#banco")
    sign = LEDGER_FORM_KINDS[kind]
    if sign:
        if amount < 0:
            flash("Escribe el monto en positivo; el tipo decide si entra o sale.", "error")
            return redirect(url_for("admin") + "#banco")
        amount *= sign
    with tx() as db:
        balance = db.execute("SELECT COALESCE(SUM(amount_cents), 0) AS s FROM ledger").fetchone()["s"]
        if amount < 0 and balance + amount < 0:
            flash("No hay saldo suficiente en el banco para ese movimiento.", "error")
            return redirect(url_for("admin") + "#banco")
        db.execute(
            "INSERT INTO ledger(created_at, kind, amount_cents, description, created_by) "
            "VALUES(?, ?, ?, ?, 'admin')", (iso(), kind, amount, desc))
    flash("Movimiento registrado en el libro del banco.", "ok")
    return redirect(url_for("admin") + "#banco")


@app.route("/admin/respaldo.json")
@admin_required
def admin_backup():
    db = get_db()

    def rows(q):
        return [dict(r) for r in db.execute(q).fetchall()]

    data = {
        "generado": iso(),
        "miembros": rows("SELECT id, name, is_fixed, active, accepted_rules_at, created_at FROM members"),
        "rondas": rows(
            "SELECT id, day, price_cents, commitment, "
            "CASE WHEN status='drawn' THEN seed END AS seed, status, created_at, drawn_at, "
            "winning_number, winner_member_id, pot_cents, prize_cents, bank_cents, prize_paid "
            "FROM rounds ORDER BY day"),
        "numeros": rows("SELECT * FROM tickets ORDER BY round_id, number"),
        "libro_banco": rows("SELECT * FROM ledger ORDER BY id"),
    }
    return Response(
        json.dumps(data, ensure_ascii=False, indent=2), mimetype="application/json",
        headers={"Content-Disposition": f'attachment; filename="respaldo-pozo-{today()}.json"'})


if os.environ.get("AUTO_DRAW_THREAD", "1") != "0":
    import threading
    threading.Thread(target=_auto_loop, daemon=True, name="auto-sorteo").start()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)
