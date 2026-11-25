import hashlib
import json
import os
import re
import sqlite3
import tempfile
import unittest
from datetime import datetime

_tmp = tempfile.mkdtemp()
os.environ["DB_PATH"] = os.path.join(_tmp, "test.db")
os.environ["ADMIN_CODE"] = "admin-secreto-12345"
os.environ["SECRET_KEY"] = "clave-de-prueba"
os.environ["PRICE_CENTS"] = "105"
os.environ["AUTO_DRAW_THREAD"] = "0"   # las pruebas llaman al sorteo automático a mano
os.environ["AUTO_DRAW_ENABLED"] = "0"

import app as pozo  # noqa: E402


def token(html):
    return re.search(r'name="_csrf" value="([^"]+)"', html).group(1)


class Client:
    def __init__(self):
        self.c = pozo.app.test_client()

    def get(self, url):
        return self.c.get(url)

    def tok(self):
        return token(self.c.get("/entrar").get_data(as_text=True))

    def post(self, url, data=None, csrf=True):
        data = dict(data or {})
        if csrf:
            data["_csrf"] = self.tok()
        return self.c.post(url, data=data)

    def login(self, code):
        return self.post("/entrar", {"code": code})


def db():
    con = sqlite3.connect(pozo.DB_PATH)
    con.row_factory = sqlite3.Row
    return con


class PozoTests(unittest.TestCase):
    def test_flujo_completo(self):
        admin = Client()
        self.assertEqual(admin.login(pozo.ADMIN_CODE).status_code, 302)

        codes = {}
        for name in ("Ana", "Beto", "Carla"):
            html = admin.post("/admin/miembros", {"name": name}).get_data(as_text=True)
            codes[name] = re.search(r'id="codigo"[^>]*>([^<]+)<', html).group(1).strip()
            self.assertRegex(codes[name], r"^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$")

        # los códigos no se guardan en claro
        with open(pozo.DB_PATH, "rb") as fh:
            raw = fh.read()
        for code in codes.values():
            self.assertNotIn(code.encode(), raw)

        ana, beto, carla = Client(), Client(), Client()
        for cl, name in ((ana, "Ana"), (beto, "Beto"), (carla, "Carla")):
            self.assertEqual(cl.login(codes[name]).status_code, 302)

        # hasta aceptar las reglas, todo redirige a /reglas
        r = ana.get("/")
        self.assertEqual(r.status_code, 302)
        self.assertTrue(r.headers["Location"].endswith("/reglas"))
        for cl in (ana, beto, carla):
            cl.post("/reglas/aceptar")
            self.assertEqual(cl.get("/").status_code, 200)

        ana.post("/reservar", {"n": ["5", "17", "0", "101"]})
        beto.post("/reservar", {"n": ["17", "40"]})
        carla.post("/reservar", {"n": ["63"]})

        home = ana.get("/").get_data(as_text=True)
        self.assertIn("Reservar seleccionados", home)
        self.assertIn("Mis números de hoy", home)
        self.assertIn('class="sprite  a5"', home)  # cada número lleva su dibujo
        self.assertIn('class="sprite  a17"', home)
        panel = admin.get("/admin").get_data(as_text=True)
        self.assertIn("marcar pagado", panel)
        self.assertEqual(admin.get("/").status_code, 200)

        con = db()
        rows = con.execute(
            "SELECT t.id, t.number, m.name FROM tickets t JOIN members m ON m.id=t.member_id "
            "ORDER BY t.number").fetchall()
        self.assertEqual([(r["number"], r["name"]) for r in rows],
                         [(5, "Ana"), (17, "Ana"), (40, "Beto"), (63, "Carla")])
        ids = {r["number"]: r["id"] for r in rows}

        # un miembro no puede marcar pagos ni entrar al panel
        self.assertEqual(ana.get("/admin").status_code, 403)
        self.assertEqual(ana.post(f"/admin/numero/{ids[17]}/pagado", {"valor": "1"}).status_code, 403)

        for n in (5, 40, 63):
            admin.post(f"/admin/numero/{ids[n]}/pagado", {"valor": "1"})

        rnd = con.execute("SELECT * FROM rounds").fetchone()
        self.assertEqual(rnd["status"], "open")
        self.assertEqual(rnd["commitment"], hashlib.sha256(rnd["seed"].encode()).hexdigest())
        self.assertEqual(rnd["price_cents"], 105)

        admin.post(f"/admin/ronda/{rnd['id']}/sortear")
        rnd = con.execute("SELECT * FROM rounds").fetchone()
        self.assertEqual(rnd["status"], "drawn")

        # recomputo independiente del ganador
        nums = [5, 40, 63]
        payload = f"{rnd['seed']}|{rnd['day']}|5,40,63"
        expected = nums[int(hashlib.sha256(payload.encode()).hexdigest(), 16) % 3]
        self.assertEqual(rnd["winning_number"], expected)
        winner = con.execute("SELECT name FROM members WHERE id=?",
                             (rnd["winner_member_id"],)).fetchone()["name"]
        self.assertEqual(winner, {5: "Ana", 40: "Beto", 63: "Carla"}[expected])

        # dinero: 3 x 1.05 = 3.15 -> premio 1.57, banco 1.58
        self.assertEqual((rnd["pot_cents"], rnd["prize_cents"], rnd["bank_cents"]), (315, 157, 158))
        self.assertEqual(rnd["prize_cents"] + rnd["bank_cents"], rnd["pot_cents"])
        led = con.execute("SELECT * FROM ledger").fetchall()
        self.assertEqual([(l["kind"], l["amount_cents"]) for l in led], [("round_bank", 158)])

        # la reserva sin pagar (17) se anuló
        self.assertEqual(con.execute("SELECT COUNT(*) FROM tickets").fetchone()[0], 3)

        # ya no se puede reservar ni sortear otra vez
        ana.post("/reservar", {"n": ["77"]})
        self.assertEqual(con.execute("SELECT COUNT(*) FROM tickets").fetchone()[0], 3)
        admin.post(f"/admin/ronda/{rnd['id']}/sortear")
        self.assertEqual(con.execute("SELECT COUNT(*) FROM ledger").fetchone()[0], 1)

        page = ana.get(f"/ronda/{rnd['day']}").get_data(as_text=True)
        self.assertIn("Verificar en mi navegador", page)
        self.assertIn(rnd["seed"], page)
        self.assertIn("$1.58", ana.get("/banco").get_data(as_text=True))
        self.assertIn("Sorteada", ana.get("/").get_data(as_text=True))
        self.assertIn("marcar entregado", admin.get("/admin").get_data(as_text=True))
        self.assertIn("$3.15", ana.get("/historial").get_data(as_text=True))

        # libro del banco
        def ledger(kind, amount, desc="x"):
            admin.post("/admin/banco", {"kind": kind, "amount": amount, "description": desc})
            return con.execute("SELECT COALESCE(SUM(amount_cents),0) FROM ledger").fetchone()[0]

        self.assertEqual(ledger("inversion", "1.00", "Dominio"), 58)
        self.assertEqual(ledger("inversion", "5", "Demasiado"), 58)   # sin saldo
        self.assertEqual(ledger("inversion", "-1", "Negativo"), 58)   # signo inválido
        self.assertEqual(ledger("ajuste", "-0.08", "Corrección"), 50)
        self.assertEqual(ledger("retorno", "2,50", "Venta"), 300)
        self.assertEqual(ledger("inversion", "abc", "Basura"), 300)
        self.assertEqual(ledger("otro", "1", "Tipo falso"), 300)

        # respaldo: sin códigos
        raw = admin.get("/admin/respaldo.json").get_data(as_text=True)
        data = json.loads(raw)
        self.assertNotIn("code_hash", raw)
        self.assertEqual(len(data["libro_banco"]), 4)
        self.assertEqual(data["rondas"][0]["seed"], rnd["seed"])

    def test_acceso_y_csrf(self):
        anon = Client()
        for url in ("/", "/banco", "/historial", "/reglas", "/admin"):
            r = anon.get(url)
            self.assertEqual(r.status_code, 302, url)
            self.assertTrue(r.headers["Location"].endswith("/entrar"), url)
        self.assertEqual(anon.post("/entrar", {"code": "x"}, csrf=False).status_code, 400)
        self.assertEqual(anon.post("/admin/precio", {"price": "1"}, csrf=False).status_code, 400)
        r = anon.get("/entrar")
        self.assertIn("noindex", r.headers["X-Robots-Tag"])
        self.assertIn("script-src 'self'", r.headers["Content-Security-Policy"])
        self.assertIn("Disallow: /", anon.get("/robots.txt").get_data(as_text=True))

    def test_limite_intentos(self):
        pozo._FAILS.clear()
        c = Client()
        for _ in range(8):
            self.assertEqual(c.login("codigo-incorrecto").status_code, 200)
        self.assertEqual(c.login("codigo-incorrecto").status_code, 429)
        pozo._FAILS.clear()

    def test_salud(self):
        c = Client()
        for method in (c.c.get, c.c.head):
            r = method("/salud")
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.headers["Cache-Control"], "no-store")
            r.close()
        self.assertEqual(c.get("/salud").get_data(as_text=True), "ok")
        self.assertEqual(c.post("/salud").status_code, 405)  # con token válido: la ruta solo acepta lecturas

    def test_fondo(self):
        c = Client()
        r = c.get("/static/bg.jpg")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.mimetype, "image/jpeg")
        r.close()
        css = c.get("/static/style.css")
        self.assertIn(b'url("bg.jpg")', css.data)
        css.close()

    def test_animales(self):
        from animals import ANIMALS
        self.assertEqual(len(ANIMALS), 100)
        self.assertEqual(len(set(ANIMALS)), 100)
        self.assertEqual(pozo.NUMBER_RANGE, 100)
        self.assertEqual(pozo.animal(1)["name"], ANIMALS[0])
        self.assertEqual(pozo.animal_label(100), f"100 ({ANIMALS[99]})")
        # la hoja de dibujos y su CSS cubren los 100 números
        static = os.path.join(os.path.dirname(os.path.abspath(pozo.__file__)), "static")
        with open(os.path.join(static, "sprites.css"), encoding="utf-8") as fh:
            css = fh.read()
        for n in range(1, 101):
            self.assertIn(f".a{n}{{", css)
        with open(os.path.join(static, "sprites.png"), "rb") as fh:
            head = fh.read(24)
        self.assertEqual(head[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual((int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big")), (320, 320))

    def test_ajedrez(self):
        self.assertEqual(Client().get("/ajedrez").status_code, 302)  # solo miembros
        admin = Client()
        admin.login(pozo.ADMIN_CODE)
        r = admin.get("/ajedrez")
        self.assertEqual(r.status_code, 200)
        html = r.get_data(as_text=True)
        self.assertIn("chess-ui.js", html)
        self.assertNotIn("<script>", html)  # la CSP solo admite scripts externos
        for f in ("chess.js", "chess-ui.js", "chess.png"):
            rr = admin.get("/static/" + f)
            self.assertEqual(rr.status_code, 200, f)
            rr.close()

    def test_ajedrez_en_linea(self):
        admin = Client()
        admin.login(pozo.ADMIN_CODE)
        html = admin.post("/admin/miembros", {"name": "Dora"}).get_data(as_text=True)
        code = re.search(r'id="codigo"[^>]*>([^<]+)<', html).group(1).strip()
        dora = Client()
        dora.login(code)
        dora.post("/reglas/aceptar")
        con = db()

        self.assertEqual(Client().get("/ajedrez/linea").status_code, 302)
        self.assertEqual(admin.post("/ajedrez/crear", {"color": "w"}, csrf=False).status_code, 400)
        r = admin.post("/ajedrez/crear", {"color": "w"})
        gid = int(r.headers["Location"].rsplit("/", 1)[1])
        self.assertIn("Dora", dora.get("/ajedrez/linea").get_data(as_text=True) + "Dora")
        self.assertIn("Administrador", dora.get("/ajedrez/linea").get_data(as_text=True))

        mv = lambda c, ply, f, t, p=0, res="": c.post(
            f"/ajedrez/jugar/{gid}", {"ply": ply, "f": f, "t": t, "p": p, "result": res})
        self.assertEqual(mv(admin, 0, 52, 36).status_code, 409)       # sin rival aún
        admin.post(f"/ajedrez/unirse/{gid}")                          # no puede unirse a la suya
        self.assertEqual(con.execute("SELECT status FROM games").fetchone()[0], "open")
        dora.post(f"/ajedrez/unirse/{gid}")
        g = con.execute("SELECT * FROM games WHERE id=?", (gid,)).fetchone()
        self.assertEqual((g["status"], g["black_name"], g["white_name"]), ("playing", "Dora", "Administrador"))

        self.assertEqual(mv(dora, 0, 12, 28).status_code, 409)        # turno de las blancas
        self.assertEqual(mv(admin, 0, 64, 36).status_code, 409)       # casilla inválida
        self.assertEqual(mv(admin, 0, 52, 36).status_code, 200)       # e2-e4
        self.assertEqual(mv(admin, 1, 51, 35).status_code, 409)       # no le toca
        self.assertEqual(mv(admin, 0, 52, 36).status_code, 409)       # jugada repetida
        # mate del loco: f3 e5 g4 Dh4#
        for c, ply, f, t in ((dora, 1, 12, 28), (admin, 2, 53, 45), (dora, 3, 3, 39)):
            pass
        state = json.loads(dora.get(f"/ajedrez/estado/{gid}").get_data(as_text=True))
        self.assertEqual((state["ply"], state["you"], state["status"]), (1, "b", "playing"))
        self.assertEqual(json.loads(admin.get(f"/ajedrez/estado/{gid}").get_data(as_text=True))["you"], "w")

        # una tercera persona solo mira y no puede jugar
        carl = Client()
        html = admin.post("/admin/miembros", {"name": "Edu"}).get_data(as_text=True)
        carl.login(re.search(r'id="codigo"[^>]*>([^<]+)<', html).group(1).strip())
        carl.post("/reglas/aceptar")
        self.assertEqual(json.loads(carl.get(f"/ajedrez/estado/{gid}").get_data(as_text=True))["you"], "")
        self.assertEqual(carl.post(f"/ajedrez/jugar/{gid}", {"ply": 1, "f": 12, "t": 28, "p": 0}).status_code, 409)

        self.assertEqual(mv(dora, 1, 12, 28).status_code, 200)        # e7-e5
        self.assertEqual(mv(admin, 2, 53, 45, 0, "mate").status_code, 200)
        g = con.execute("SELECT * FROM games WHERE id=?", (gid,)).fetchone()
        self.assertEqual((g["status"], g["result"], g["winner"], g["ply"]), ("over", "mate", "w", 3))
        self.assertEqual(mv(dora, 3, 3, 39).status_code, 409)         # terminada

        # rendirse
        gid2 = int(dora.post("/ajedrez/crear", {"color": "b"}).headers["Location"].rsplit("/", 1)[1])
        admin.post(f"/ajedrez/unirse/{gid2}")
        dora.post(f"/ajedrez/rendirse/{gid2}")
        g = con.execute("SELECT * FROM games WHERE id=?", (gid2,)).fetchone()
        self.assertEqual((g["status"], g["result"], g["winner"]), ("over", "resign", "w"))
        self.assertEqual(admin.get(f"/ajedrez/partida/{gid2}").status_code, 200)

    def test_domino(self):
        self.assertEqual(Client().get("/domino").status_code, 302)
        admin = Client()
        admin.login(pozo.ADMIN_CODE)
        html = admin.get("/domino").get_data(as_text=True)
        self.assertIn("domino-ui.js", html)
        self.assertNotIn("<script>", html)
        for f in ("domino.js", "domino-ui.js"):
            rr = admin.get("/static/" + f)
            self.assertEqual(rr.status_code, 200, f)
            rr.close()

    def test_domino_motor(self):
        import random
        import domino_engine as de
        rng = random.Random(7)
        for g in range(300):
            st = de.new_round(None if g % 3 == 0 else g % 4, rng)
            self.assertEqual(sorted(t for h in st["hands"] for t in map(tuple, h)), sorted(map(tuple, de.deck())))
            while not st["over"]:
                seat = st["turn"]
                m = de.bot_move(st, seat, rng)
                if m:
                    de.play(st, seat, m["i"], m["side"])
                else:
                    de.pass_turn(st, seat)
                n = len(st["chain"]) + sum(len(h) for h in st["hands"])
                self.assertEqual(n, 28)
                c = st["chain"]
                self.assertTrue(all(c[k][1] == c[k + 1][0] for k in range(len(c) - 1)))
            self.assertIn(st["reason"], ("domino", "tranca", "tranca-empate"))
        st = de.new_round(None, rng)
        seat = st["turn"]
        self.assertEqual([m["side"] for m in de.legal(st, seat)], ["S"])
        with self.assertRaises(ValueError):
            de.play(st, (seat + 1) % 4, 0, "S")

    def test_domino_en_linea(self):
        pozo.DOMINO_PACE = 0.0
        admin = Client()
        admin.login(pozo.ADMIN_CODE)
        html = admin.post("/admin/miembros", {"name": "Fer"}).get_data(as_text=True)
        fer = Client()
        fer.login(re.search(r'id="codigo"[^>]*>([^<]+)<', html).group(1).strip())
        fer.post("/reglas/aceptar")
        html = admin.post("/admin/miembros", {"name": "Gus"}).get_data(as_text=True)
        gus = Client()
        gus.login(re.search(r'id="codigo"[^>]*>([^<]+)<', html).group(1).strip())
        gus.post("/reglas/aceptar")

        self.assertEqual(Client().get("/domino/linea").status_code, 302)
        self.assertEqual(admin.post("/domino/crear", csrf=False).status_code, 400)
        gid = int(admin.post("/domino/crear").headers["Location"].rsplit("/", 1)[1])
        view = lambda c: json.loads(c.get(f"/domino/estado/{gid}").get_data(as_text=True))
        self.assertEqual(gus.get(f"/domino/estado/{gid}").status_code, 403)   # no sentado
        self.assertEqual(gus.get(f"/domino/mesa/{gid}").status_code, 302)
        self.assertIn("Sentarme", gus.get("/domino/linea").get_data(as_text=True))
        gus.post(f"/domino/unirse/{gid}", {"seat": "9"})                          # asiento inválido
        self.assertEqual(gus.get(f"/domino/estado/{gid}").status_code, 403)
        fer.post(f"/domino/unirse/{gid}", {"seat": "2"})
        self.assertEqual([s["name"] if s else None for s in view(admin)["seats"]], ["Administrador", None, "Fer", None])
        self.assertEqual(view(admin)["status"], "open")
        self.assertNotIn("hand", view(admin))
        self.assertEqual(fer.post(f"/domino/empezar/{gid}").status_code, 200)    # solo el anfitrión
        self.assertEqual(view(admin)["status"], "open")
        self.assertEqual(admin.post(f"/domino/empezar/{gid}").status_code, 200)
        v = view(admin)
        self.assertEqual((v["status"], v["you"], v["seats"][1]["bot"], v["seats"][3]["bot"]), ("playing", 0, True, True))
        self.assertEqual(len(v["hand"]), 7)
        self.assertIsNone(v["hands"])                                             # fichas ajenas ocultas
        self.assertNotIn(b"hands", json.dumps(view(fer)).encode().replace(b'"hands": null', b""))

        # se juega una mano completa entre Administrador y Fer (la computadora llena el resto)
        mv = lambda c, i, side: c.post(f"/domino/jugar/{gid}", {"i": i, "side": side})
        steps = 0
        while steps < 400:
            steps += 1
            va, vf = view(admin), view(fer)
            if va["over"]:
                break
            for c, v in ((admin, va), (fer, vf)):
                if v["turn"] == v["you"] and v["legal"]:
                    other = fer if c is admin else admin
                    wrong = mv(other, 0, "S")
                    self.assertEqual(wrong.status_code, 409)                      # no es su turno
                    m = v["legal"][0]
                    self.assertEqual(mv(c, m["i"], m["side"]).status_code, 200)
        va = view(admin)
        self.assertTrue(va["over"])
        self.assertEqual(sum(va["scores"]) > 0 or va["reason"] == "tranca-empate", True)
        self.assertEqual(len(va["hands"]), 4)                                     # al terminar se ven todas
        self.assertEqual(mv(admin, 0, "S").status_code, 409)
        fer.post(f"/domino/siguiente/{gid}")
        v2 = view(fer)
        self.assertEqual((v2["round_no"], v2["over"]), (2, False))

        # salir: la computadora ocupa tu lugar; sin personas, la mesa desaparece
        fer.post(f"/domino/salir/{gid}")
        self.assertEqual(fer.get(f"/domino/estado/{gid}").status_code, 403)
        self.assertTrue(view(admin)["seats"][2]["bot"])
        admin.post(f"/domino/salir/{gid}")
        self.assertEqual(db().execute("SELECT COUNT(*) FROM dgames WHERE id=?", (gid,)).fetchone()[0], 0)
        pozo.DOMINO_PACE = 0.9

    def test_sorteo_automatico(self):
        real_now = pozo.now
        admin = Client()
        admin.login(pozo.ADMIN_CODE)
        con = db()
        con.execute("INSERT INTO members(name, code_hash, created_at) VALUES('Auto', 'hash-auto', 'x')")
        mid = con.execute("SELECT id FROM members WHERE name='Auto'").fetchone()[0]
        con.commit()

        def at(y, m, d, h, mi):
            pozo.now = lambda: datetime(y, m, d, h, mi, tzinfo=pozo.TZ)

        def ticket(rid, number, paid):
            con.execute("INSERT INTO tickets(round_id, member_id, number, paid, created_at) VALUES(?,?,?,?,'x')",
                        (rid, mid, number, paid))
            con.commit()

        def status(day):
            return con.execute("SELECT status FROM rounds WHERE day=?", (day,)).fetchone()[0]

        try:
            with pozo.app.app_context():
                # desactivado: no hace nada aunque sea tarde
                at(2030, 1, 1, 20, 0)
                rid = pozo.get_or_create_round("2030-01-01")["id"]
                ticket(rid, 7, 1)
                self.assertEqual(pozo.maybe_auto_draw(), 0)
                self.assertEqual(status("2030-01-01"), "open")

                pozo.set_setting("auto_draw_enabled", "1")
                pozo.set_setting("auto_draw_time", "19:00")
                at(2030, 1, 1, 18, 59)
                self.assertEqual(pozo.maybe_auto_draw(), 0)               # falta un minuto
                self.assertEqual(status("2030-01-01"), "open")
                at(2030, 1, 1, 19, 0)
                self.assertEqual(pozo.maybe_auto_draw(), 1)               # a las 19:00 en punto
                self.assertEqual(status("2030-01-01"), "drawn")
                self.assertEqual(pozo.maybe_auto_draw(), 0)               # no se repite
                self.assertEqual(con.execute("SELECT COUNT(*) FROM ledger WHERE round_id=?", (rid,)).fetchone()[0], 1)
                row = con.execute("SELECT * FROM rounds WHERE id=?", (rid,)).fetchone()
                self.assertEqual((row["winning_number"], row["pot_cents"], row["prize_cents"], row["bank_cents"]),
                                 (7, 105, 52, 53))

                # sin pagados a la hora: ese día no se sortea solo, ni aunque paguen después
                at(2030, 1, 2, 19, 5)
                rid2 = pozo.get_or_create_round("2030-01-02")["id"]
                ticket(rid2, 9, 0)
                self.assertEqual(pozo.maybe_auto_draw(), 0)
                con.execute("UPDATE tickets SET paid=1 WHERE round_id=?", (rid2,))
                con.commit()
                self.assertEqual(pozo.maybe_auto_draw(), 0)
                self.assertEqual(status("2030-01-02"), "open")

                # un día anterior que quedó abierto con pagados se sortea al volver el servidor
                at(2030, 1, 3, 9, 0)
                self.assertEqual(pozo.maybe_auto_draw(), 1)
                self.assertEqual(status("2030-01-02"), "drawn")

                # cambiar la hora desde el panel
                admin.post("/admin/sorteo-auto", {"time": "25:99", "enabled": "1"})
                self.assertEqual(pozo.auto_draw_settings(), (True, "19:00"))
                admin.post("/admin/sorteo-auto", {"time": "20:30", "enabled": "1"})
                self.assertEqual(pozo.auto_draw_settings(), (True, "20:30"))
                self.assertIn("20:30", admin.get("/admin").get_data(as_text=True))
                admin.post("/admin/sorteo-auto", {"time": "20:30"})
                self.assertEqual(pozo.auto_draw_settings(), (False, "20:30"))
        finally:
            pozo.now = real_now
            with pozo.app.app_context():
                pozo.set_setting("auto_draw_enabled", "0")
                pozo.get_db().commit() if pozo.get_db().in_transaction else None

    def test_formula_estable(self):
        w, digest, payload = pozo.compute_winner("abc", "2026-11-14", [63, 5, 40])
        self.assertEqual(payload, "abc|2026-11-14|5,40,63")
        self.assertIn(w, (5, 40, 63))
        self.assertEqual(digest, hashlib.sha256(payload.encode()).hexdigest())


if __name__ == "__main__":
    unittest.main()
