'use strict';
/* Aventura de almas — servidor (HTTP + WebSocket, sin dependencias) */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const E = require('./engine.js');
const WS = require('./ws-lite.js');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SAVE_FILE = path.join(DATA_DIR, 'games.json');
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const games = new Map();   // code -> game
const conns = new Map();   // conn -> { code, pid }
let lastSave = 0, saveDirty = false;

/* ---------- persistencia ---------- */
function loadAll() {
  try {
    const raw = fs.readFileSync(SAVE_FILE, 'utf8');
    const arr = JSON.parse(raw);
    for (const s of arr) {
      const g = E.deserialize(s);
      if (g.status === 'playing' && g.endsAt < Date.now()) g.endsAt = Date.now() + Math.max(g.cfg.turnHours * 3600000, 600000); // sin turnos "de golpe" tras un reinicio
      games.set(g.code, g);
    }
    console.log('Partidas restauradas:', games.size);
  } catch (e) { if (e.code !== 'ENOENT') console.error('No se pudo cargar el guardado:', e.message); }
}
function saveAll(force) {
  if (!saveDirty && !force) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const arr = [];
    for (const g of games.values()) arr.push(E.serialize(g));
    const tmp = SAVE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(arr));
    fs.renameSync(tmp, SAVE_FILE);
    saveDirty = false; lastSave = Date.now();
  } catch (e) { console.error('Error guardando:', e.message); }
}

/* ---------- utilidades ---------- */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode() {
  for (;;) {
    let c = ''; for (let i = 0; i < 5; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!games.has(c)) return c;
  }
}
const newToken = () => crypto.randomBytes(18).toString('hex');
const send = (c, o) => { try { c.send(JSON.stringify(o)); } catch (e) { /* conexión cerrada */ } };
function playerOf(g, token) { return token ? g.players.find(p => p.token === token) : null; }
function pushState(c) {
  const ci = conns.get(c); if (!ci) return;
  const g = games.get(ci.code); if (!g) return;
  send(c, { t: 's', s: E.snapshot(g, ci.pid) });
}
function broadcast(g) {
  for (const [c, ci] of conns) if (ci.code === g.code && c.open) pushState(c);
}
function touchGame(g) { g.dirty = true; saveDirty = true; }

/* ---------- WebSocket ---------- */
function onMessage(c, text) {
  let m; try { m = JSON.parse(text); } catch (e) { return; }
  if (!m || typeof m.t !== 'string') return;
  const ci = conns.get(c);
  try {
    if (m.t === 'create') {
      const name = String(m.name || '').trim().slice(0, 14);
      if (!name) return send(c, { t: 'err', m: 'Escribe tu nombre' });
      if (games.size >= 60) return send(c, { t: 'err', m: 'Servidor lleno de partidas' });
      const code = newCode(), token = newToken();
      const g = E.createGame(code, name, token);
      games.set(code, g);
      conns.set(c, { code, pid: 0 });
      touchGame(g);
      send(c, { t: 'joined', code, token, pid: 0, name: g.players[0].name });
      return pushState(c);
    }
    if (m.t === 'join') {
      const g = games.get(String(m.code || '').toUpperCase().trim());
      if (!g) return send(c, { t: 'err', m: 'No existe esa partida' });
      if (g.status !== 'lobby') return send(c, { t: 'err', m: 'Esa partida ya empezó' });
      const name = String(m.name || '').trim().slice(0, 14);
      if (!name) return send(c, { t: 'err', m: 'Escribe tu nombre' });
      const token = newToken();
      const p = E.addPlayer(g, name, false, token);
      if (!p) return send(c, { t: 'err', m: 'La partida está llena (máx. 10)' });
      conns.set(c, { code: g.code, pid: p.id });
      touchGame(g);
      send(c, { t: 'joined', code: g.code, token, pid: p.id, name: p.name });
      return broadcast(g);
    }
    if (m.t === 'auth') {
      const g = games.get(String(m.code || '').toUpperCase().trim());
      const p = g && playerOf(g, m.token);
      if (!p) return send(c, { t: 'authfail' });
      conns.set(c, { code: g.code, pid: p.id });
      send(c, { t: 'joined', code: g.code, token: m.token, pid: p.id, name: p.name });
      return pushState(c);
    }
    if (!ci) return;
    const g = games.get(ci.code); if (!g) return;
    const pid = ci.pid;
    if (m.t === 'ping') return send(c, { t: 'pong' });
    if (m.t === 'lobby') {
      if (g.status !== 'lobby') return;
      if (pid !== g.hostId) return send(c, { t: 'err', m: 'Solo el anfitrión puede hacer eso' });
      if (m.a === 'addbot') { if (!E.addBot(g)) return send(c, { t: 'err', m: 'No caben más jugadores' }); }
      else if (m.a === 'remove') {
        const target = g.players.find(p => p.id === (m.id | 0));
        if (!target || target.id === g.hostId) return;
        // reindexar conexiones tras quitar a alguien
        const removedToken = target.token;
        E.removePlayer(g, target.id);
        for (const [cc, info] of conns) {
          if (info.code !== g.code) continue;
          const p = g.players.find(pp => pp.token && pp.token === (info.token || null));
          if (info.pid === target.id) { send(cc, { t: 'kicked' }); conns.delete(cc); }
        }
        // recalcular pid de cada conexión por su token guardado
        for (const [cc, info] of conns) if (info.code === g.code && info.tok) { const p = playerOf(g, info.tok); if (p) info.pid = p.id; }
        void removedToken;
      }
      else if (m.a === 'cfg') {
        const h = Number(m.turnHours);
        if (h >= 0.01 && h <= 168) g.cfg.turnHours = h;
        const mt = m.maxTurns | 0;
        if (mt >= 0 && mt <= 1000) g.cfg.maxTurns = mt;
      }
      else if (m.a === 'start') {
        const err = E.startGame(g);
        if (err) return send(c, { t: 'err', m: err });
      }
      touchGame(g);
      return broadcast(g);
    }
    if (m.t === 'cmd') {
      if (m.a === 'force') {
        if (pid !== g.hostId || g.status !== 'playing') return;
        E.advanceTurn(g); touchGame(g); return broadcast(g);
      }
      const r = E.cmd(g, pid, m);
      if (r.err) return send(c, { t: 'err', m: r.err });
      touchGame(g);
      if (r.msg) send(c, { t: 'msg', m: r.msg });
      pushState(c);
      if (m.a === 'ready') maybeAdvance(g);
      return;
    }
  } catch (e) {
    console.error('Error en mensaje', m && m.t, e);
    send(c, { t: 'err', m: 'Error interno del servidor' });
  }
}
function maybeAdvance(g) {
  if (g.status !== 'playing') return;
  const humans = g.players.filter(p => p.alive && !p.bot);
  if (humans.length && humans.every(p => p.ready)) { E.advanceTurn(g); touchGame(g); broadcast(g); }
}

/* ---------- HTTP ---------- */
function gamesInfo() {
  return [...games.values()].map(g => ({ code: g.code, status: g.status, turn: g.turn, endsAt: g.endsAt, players: g.players.length }));
}
function readBody(req, limit) {
  return new Promise((res, rej) => {
    let n = 0; const chunks = [];
    req.on('data', d => { n += d.length; if (n > limit) { rej(new Error('too big')); req.destroy(); } else chunks.push(d); });
    req.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rej);
  });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (p === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ ok: true, now: Date.now(), conns: [...conns.keys()].filter(c => c.open).length, games: gamesInfo() }));
  }
  if (p === '/api/backup' || p === '/api/restore') {
    if (!ADMIN_KEY || url.searchParams.get('key') !== ADMIN_KEY) { res.writeHead(403); return res.end('Clave de administrador inválida o no configurada (variable ADMIN_KEY)'); }
    if (p === '/api/backup') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="aventura-de-almas-backup.json"' });
      return res.end(JSON.stringify([...games.values()].map(g => E.serialize(g))));
    }
    if (req.method !== 'POST') { res.writeHead(405); return res.end('Usa POST con el JSON del respaldo'); }
    try {
      const arr = JSON.parse(await readBody(req, 30 * 1024 * 1024));
      let n = 0;
      for (const s of arr) { const g = E.deserialize(s); if (g && g.code) { g.endsAt = Math.max(g.endsAt, Date.now() + 600000); games.set(g.code, g); n++; } }
      saveDirty = true; saveAll(true);
      res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('Restauradas ' + n + ' partidas');
    } catch (e) { res.writeHead(400); return res.end('JSON inválido'); }
  }
  let f = p === '/' ? '/index.html' : p === '/vigia' ? '/vigia.html' : p;
  f = path.normalize(f).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(PUB, f);
  if (!full.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

WS.attach(server, c => {
  c.alive = true;
  c.on('message', t => onMessage(c, t));
  c.on('close', () => { conns.delete(c); });
});
// guardar el token en la info de conexión para poder reindexar tras expulsiones
const _set = conns.set.bind(conns);
conns.set = (c, info) => { const g = games.get(info.code); const p = g && g.players[info.pid]; if (p) info.tok = p.token; return _set(c, info); };

/* ---------- reloj de turnos, guardado y "mantener despierto" ---------- */
setInterval(() => {
  for (const g of games.values()) {
    if (g.status !== 'playing') continue;
    if (Date.now() >= g.endsAt) { E.advanceTurn(g); touchGame(g); broadcast(g); }
  }
  if (saveDirty && Date.now() - lastSave > 10000) saveAll();
  // limpiar partidas terminadas o abandonadas hace mucho
  for (const [code, g] of games) {
    const idle = Date.now() - (g.status === 'lobby' ? g.created : g.endsAt);
    if ((g.status === 'over' && idle > 7 * 86400000) || (g.status === 'lobby' && idle > 2 * 86400000)) { games.delete(code); saveDirty = true; }
  }
}, 2000);
setInterval(() => { for (const c of conns.keys()) { if (c.open) c.ping(); } }, 25000);
const SELF = process.env.RENDER_EXTERNAL_URL;
if (SELF) setInterval(() => { http.get ? require('https').get(SELF + '/health', r => r.resume()).on('error', () => {}) : 0; }, 9 * 60 * 1000);

loadAll();
server.listen(PORT, () => console.log('Aventura de almas escuchando en el puerto', PORT));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { saveAll(true); process.exit(0); });
