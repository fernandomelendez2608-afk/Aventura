'use strict';
/* Aventura de almas — servidor (HTTP + WebSocket, sin dependencias) */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const E = require('./engine.js');
const WS = require('./ws-lite.js');
const Push = require('./push.js');
const { makeStores } = require('./store.js');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const PUB = path.join(__dirname, 'public');
const SAVE_EVERY = +process.env.SAVE_EVERY_MS || 30000; // como mucho un guardado por partida cada 30 s (los cambios de turno se guardan enseguida)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
// archivos de la web que también se aceptan en la raíz (por si se subió el proyecto sin carpetas)
const ROOT_FILES = new Set(['index.html', 'vigia.html', 'shared.js', 'sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']);
const RETRY_MS = +process.env.RETRY_MS || 60000;
const SUBJECT = process.env.VAPID_SUBJECT || (/^https:\/\//.test(process.env.RENDER_EXTERNAL_URL || '') ? process.env.RENDER_EXTERNAL_URL : 'mailto:admin@example.com');

const { local, remote } = makeStores(process.env, DATA_DIR);
const games = new Map();   // código -> partida
const conns = new Map();   // conexión -> { code, pid, tok }
let remoteLoaded = !remote;
let vapid = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- guardado ---------- */
function touchGame(g, now) { g._d = true; g._dv = (g._dv || 0) + 1; g.rev = (g.rev || 0) + 1; if (now) g._now = true; }
let lastErrLog = 0;
function logSaveErr(e) { if (Date.now() - lastErrLog > 60000) { lastErrLog = Date.now(); console.error('No se pudo guardar en la nube (se reintentará):', e.message); } }
async function doSave(force) {
  const now = Date.now();
  for (const g of [...games.values()]) {
    if (!g._d) continue;
    if (!force && !g._now && now - (g._ls || 0) < SAVE_EVERY) continue;
    const ver = g._dv; let str;
    try { str = E.serialize(g); } catch (e) { console.error('Error serializando', g.code, e); continue; }
    g._ls = Date.now(); g._now = false;
    try { await local.save(g.code, str); } catch (e) { /* disco no disponible: no es grave si hay nube */ }
    if (remote) { try { await remote.save(g.code, str); } catch (e) { logSaveErr(e); continue; } }
    if (g._dv === ver) g._d = false;
  }
}
let savePromise = null;
function saveDirtyGames(force) {
  if (savePromise) return force ? savePromise.then(() => doSave(true)) : savePromise;
  savePromise = doSave(force).finally(() => { savePromise = null; });
  return savePromise;
}
function dropGame(code) {
  games.delete(code);
  local.remove(code).catch(() => {});
  if (remote) remote.remove(code).catch(e => logSaveErr(e));
}
function adopt(list, source) {
  let n = 0;
  for (const it of list) {
    let g; try { g = E.deserialize(it.data); } catch (e) { console.error('Partida ilegible:', it.code); continue; }
    if (!g || !g.code || !g.players) continue;
    const cur = games.get(g.code);
    if (cur && (cur.rev || 0) >= (g.rev || 0)) continue;
    if (g.status === 'playing' && g.endsAt < Date.now()) g.endsAt = Date.now() + Math.max(g.cfg.turnHours * 3600000, 600000); // sin turnos "de golpe" tras un reinicio
    if (g.cfg.idleTurns === undefined) g.cfg.idleTurns = 2;
    for (const p of g.players) { if (!p.push) p.push = []; if (p.act === undefined) { p.act = true; p.idle = 0; p.auto = false; } }
    if (source === 'local' && remote) g._d = true; // subir a la nube lo que solo existía en disco
    games.set(g.code, g); n++;
  }
  return n;
}
async function loadRemote() {
  adopt(await remote.loadAll(), 'remote');
  remoteLoaded = true;
}
async function ensureVapid() {
  if (vapid) return;
  if (process.env.VAPID_PRIVATE_JSON) vapid = Push.vapidFromJSON(process.env.VAPID_PRIVATE_JSON);
  if (vapid) return;
  for (const st of [remote, local]) {
    if (!st || vapid) continue;
    try { vapid = Push.vapidFromJSON(await st.getMeta('vapid')); } catch (e) { /* se intenta con la siguiente */ }
  }
  if (vapid) return;
  if (remote && !remoteLoaded) return; // no inventar claves nuevas si la nube no responde: romperían las suscripciones existentes
  const v = Push.generateVapid(), s = JSON.stringify(v);
  try { if (remote) await remote.setMeta('vapid', s); } catch (e) { console.error('No se pudo guardar la clave de avisos en la nube:', e.message); if (remote) return; }
  try { await local.setMeta('vapid', s); } catch (e) { /* nada */ }
  vapid = v;
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
function bind(c, g, p) { conns.set(c, { code: g.code, pid: p.id, tok: p.token }); }
function joined(c, g, p, token) { send(c, { t: 'joined', code: g.code, token, pid: p.id, name: p.name, vapid: vapid ? vapid.pub : null }); }
function pushState(c) {
  const ci = conns.get(c); if (!ci) return;
  const g = games.get(ci.code); if (!g) return;
  send(c, { t: 's', s: E.snapshot(g, ci.pid) });
}
function broadcast(g) {
  for (const [c, ci] of conns) if (ci.code === g.code && c.open) pushState(c);
}
function fmtDur(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  if (h >= 48) return Math.round(h / 24) + ' días';
  return h + ' h' + (r ? ' ' + r + ' min' : '');
}
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- avisos al celular ---------- */
function notify(g, p, payload, opts) {
  if (!vapid || !p || !p.push || !p.push.length) return;
  for (const sub of p.push.slice()) {
    Push.sendPush(sub, payload, vapid, SUBJECT, opts).then(st => {
      if (st === 404 || st === 410) { p.push = p.push.filter(x => x.endpoint !== sub.endpoint); touchGame(g); }
      else if (st >= 400) console.error('Aviso rechazado (' + st + ') por', new URL(sub.endpoint).hostname);
    }).catch(e => console.error('Aviso fallido:', e.message));
  }
}
function notifyTurn(g, before) {
  if (!vapid) return;
  const evs = g.events.filter(e => e.id >= before);
  for (const p of g.players) {
    if (p.bot || !p.push || !p.push.length) continue;
    if (!p.alive && g.status !== 'over') continue;
    const mine = evs.filter(e => e.to && e.to.includes(p.id));
    const dead = mine.filter(e => e.k === 'dead').length;
    const hits = mine.filter(e => e.k === 'hit' || e.k === 'phit').length;
    let title, body;
    if (g.status === 'over') {
      title = '🏁 Fin de la partida · ' + g.code;
      body = 'Gana ' + g.players[g.winner].name + (g.winner === p.id ? ' — ¡eres tú!' : '') + '.';
    } else if (p.auto) {
      if (p.autoNote) continue;
      p.autoNote = true;
      title = '🤖 Tu ejército está en piloto automático';
      body = 'Un bot lo dirige porque llevas varios turnos sin entrar. Abre el juego para retomar el mando.';
    } else {
      const pts = g.units.filter(u => u.o === p.id && u.pts > 0).length;
      const parts = [];
      if (dead) parts.push('perdiste ' + dead + (dead === 1 ? ' unidad' : ' unidades'));
      if (hits) parts.push('te atacaron ' + hits + (hits === 1 ? ' vez' : ' veces'));
      if (pts) parts.push(pts + (pts === 1 ? ' unidad tiene' : ' unidades tienen') + ' puntos por gastar');
      title = '⏰ Turno ' + g.turn + ' · ' + g.code;
      body = (parts.length ? cap1(parts.join(', ')) + '. ' : 'Empezó un nuevo turno. ') + 'Termina en ' + fmtDur(g.endsAt - Date.now()) + '.';
    }
    notify(g, p, { title, body, tag: 'turn-' + g.code, url: '/' }, { ttl: 6 * 3600, topic: 'turn' + g.code });
  }
}
function notifyAttacks(g, before) { // ataques de otros jugadores en tiempo real (máx. un aviso cada 5 min por jugador)
  if (!vapid) return;
  const now = Date.now();
  for (let i = g.events.length - 1; i >= 0; i--) {
    const e = g.events[i];
    if (e.id < before) break;
    if (e.k !== 'phit' || !e.to) continue;
    for (const pid of e.to) {
      const p = g.players[pid];
      if (!p || p.bot || !p.push || !p.push.length) continue;
      if (p._lp && now - p._lp < 5 * 60000) continue;
      p._lp = now;
      notify(g, p, { title: '⚔️ ¡Te están atacando! · ' + g.code, body: e.text, tag: 'atk-' + g.code, url: '/' }, { ttl: 3600, urgency: 'high', topic: 'atk' + g.code });
    }
  }
}
const NT_TITLE = { prop: '📨 Propuesta de pacto', pact: '🤝 Diplomacia', horde: '🐺 ¡Horda en camino!' };
function notifyEvents(g, before) { // propuestas, pactos y hordas: aviso inmediato a los humanos implicados
  if (!vapid) return;
  const now = Date.now();
  for (const e of g.events) {
    if (e.id < before || !e.nt || !NT_TITLE[e.nt] || !e.to) continue;
    for (const pid of e.to) {
      const p = g.players[pid];
      if (!p || p.bot || p.auto || !p.push || !p.push.length) continue;
      p._ln = p._ln || {};
      if (p._ln[e.nt] && now - p._ln[e.nt] < 60000) continue;
      p._ln[e.nt] = now;
      notify(g, p, { title: NT_TITLE[e.nt] + ' · ' + g.code, body: e.text, tag: e.nt + '-' + g.code, url: '/' }, { ttl: 3600, urgency: 'high', topic: e.nt + g.code });
    }
  }
}
function remindAll() { // aviso cuando queda poco para que acabe el turno y aún no pulsaste «Fin de turno»
  if (!vapid) return;
  const now = Date.now();
  for (const g of games.values()) {
    if (g.status !== 'playing' || g.cfg.turnHours < 2) continue;
    const total = g.cfg.turnHours * 3600000, left = g.endsAt - now;
    if (left <= 0 || left > Math.max(20 * 60000, total * 0.2)) continue;
    for (const p of g.players) {
      if (p.bot || p.auto || !p.alive || p.ready || !p.push || !p.push.length || p.remT === g.turn) continue;
      p.remT = g.turn; touchGame(g);
      notify(g, p, { title: '⏳ Se acaba el turno · ' + g.code, body: 'Quedan ' + fmtDur(left) + ' y aún no pulsas «Fin de turno».', tag: 'rem-' + g.code, url: '/' }, { ttl: 1800, topic: 'rem' + g.code });
    }
  }
}

/* ---------- turnos ---------- */
function advance(g) {
  const before = g.eid;
  E.advanceTurn(g);
  for (const p of g.players) if (!p.auto) p.autoNote = false;
  touchGame(g, true);
  notifyTurn(g, before);
  notifyEvents(g, before);
  broadcast(g);
}
function maybeAdvance(g) {
  if (g.status !== 'playing') return;
  const humans = g.players.filter(p => p.alive && !p.bot && !p.auto);
  if (humans.length && humans.every(p => p.ready)) advance(g);
}

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
      bind(c, g, g.players[0]);
      touchGame(g, true);
      joined(c, g, g.players[0], token);
      return pushState(c);
    }
    if (m.t === 'join') {
      const g = games.get(String(m.code || '').toUpperCase().trim());
      if (!g) return send(c, { t: 'err', m: 'No existe esa partida' });
      const name = String(m.name || '').trim().slice(0, 14);
      if (!name) return send(c, { t: 'err', m: 'Escribe tu nombre' });
      if (g.status === 'over') return send(c, { t: 'err', m: 'Esa partida ya terminó' });
      const token = newToken();
      if (g.status === 'lobby') {
        const p = E.addPlayer(g, name, false, token);
        if (!p) return send(c, { t: 'err', m: 'La partida está llena (máx. 10)' });
        bind(c, g, p); touchGame(g, true);
        joined(c, g, p, token);
        return broadcast(g);
      }
      // partida en curso: se ocupa el lugar de un bot
      const slots = E.replaceableSlots(g);
      if (!slots.length) return send(c, { t: 'err', m: 'La partida ya empezó y no hay ningún bot cuyo lugar ocupar' });
      if (m.slot === undefined || m.slot === null) return send(c, { t: 'slots', code: g.code, slots });
      const r = E.replaceBot(g, m.slot | 0, name, token);
      if (typeof r === 'string') { send(c, { t: 'err', m: r }); return send(c, { t: 'slots', code: g.code, slots: E.replaceableSlots(g) }); }
      bind(c, g, r); touchGame(g, true);
      joined(c, g, r, token);
      return broadcast(g);
    }
    if (m.t === 'auth') {
      const g = games.get(String(m.code || '').toUpperCase().trim());
      const p = g && playerOf(g, m.token);
      if (!p) return send(c, { t: 'authfail' });
      bind(c, g, p);
      joined(c, g, p, m.token);
      return pushState(c);
    }
    if (!ci) return;
    const g = games.get(ci.code); if (!g) return;
    const pid = ci.pid;
    const me = g.players[pid];
    if (m.t === 'ping') return send(c, { t: 'pong' });
    if (!me || me.bot) { conns.delete(c); return send(c, { t: 'kicked' }); } // su lugar ya no es suyo

    if (m.t === 'seen') { // la persona tiene la app abierta y a la vista
      if (g.status !== 'playing') return;
      const wasAuto = me.auto, changed = !me.act || me.idle > 0 || me.auto;
      E.markSeen(g, pid);
      if (changed) touchGame(g, wasAuto);
      if (wasAuto) broadcast(g);
      return;
    }
    if (m.t === 'push') {
      if (m.a === 'sub') {
        if (!Push.validSubscription(m.sub)) return send(c, { t: 'err', m: 'Tu navegador envió una suscripción de avisos no válida' });
        const sub = { endpoint: m.sub.endpoint, keys: { p256dh: m.sub.keys.p256dh, auth: m.sub.keys.auth } };
        const had = me.push.some(x => x.endpoint === sub.endpoint);
        me.push = me.push.filter(x => x.endpoint !== sub.endpoint); me.push.push(sub);
        if (me.push.length > 3) me.push.shift();
        touchGame(g);
        send(c, { t: 'push', ok: true, subs: me.push.length });
        if (!had) notify(g, me, { title: '🔔 Avisos activados', body: 'Te avisaré cuando empiece tu turno, te ataquen o se acabe el tiempo.', tag: 'welcome', url: '/' }, { ttl: 600 });
      } else if (m.a === 'unsub') {
        me.push = me.push.filter(x => x.endpoint !== m.endpoint);
        touchGame(g);
        send(c, { t: 'push', ok: false, subs: me.push.length });
      }
      return;
    }
    if (m.t === 'lobby') {
      if (g.status !== 'lobby') return;
      if (pid !== g.hostId) return send(c, { t: 'err', m: 'Solo el anfitrión puede hacer eso' });
      if (m.a === 'addbot') { if (!E.addBot(g, String(m.pers || ''))) return send(c, { t: 'err', m: 'No caben más jugadores' }); }
      else if (m.a === 'remove') {
        const target = g.players.find(p => p.id === (m.id | 0));
        if (!target || target.id === g.hostId) return;
        E.removePlayer(g, target.id);
        for (const [cc, info] of [...conns]) { // reasignar números de jugador y expulsar al quitado
          if (info.code !== g.code) continue;
          const np = info.tok ? g.players.find(pp => pp.token === info.tok) : null;
          if (!np) { send(cc, { t: 'kicked' }); conns.delete(cc); } else info.pid = np.id;
        }
      }
      else if (m.a === 'cfg') {
        const h = Number(m.turnHours);
        if (h >= 0.01 && h <= 168) g.cfg.turnHours = h;
        const mt = m.maxTurns | 0;
        if (mt >= 0 && mt <= 1000) g.cfg.maxTurns = mt;
        if (['facil', 'normal', 'dificil'].includes(m.botLevel)) g.cfg.botLevel = m.botLevel;
        if (m.idleTurns !== undefined) { const it = m.idleTurns | 0; if (it >= 0 && it <= 10) g.cfg.idleTurns = it; }
      }
      else if (m.a === 'start') {
        const err = E.startGame(g);
        if (err) return send(c, { t: 'err', m: err });
      }
      touchGame(g, true);
      return broadcast(g);
    }
    if (m.t === 'cmd') {
      if (m.a === 'force') {
        if (pid !== g.hostId || g.status !== 'playing') return;
        return advance(g);
      }
      if (m.a === 'release') { // el anfitrión libera el lugar de un jugador ausente
        if (pid !== g.hostId) return send(c, { t: 'err', m: 'Solo el anfitrión puede hacer eso' });
        const target = g.players[m.id | 0];
        const oldTok = target && target.token;
        const err = E.releasePlayer(g, m.id | 0);
        if (err) return send(c, { t: 'err', m: err });
        for (const [cc, info] of [...conns]) if (info.code === g.code && oldTok && info.tok === oldTok) { send(cc, { t: 'kicked' }); conns.delete(cc); }
        touchGame(g, true);
        return broadcast(g);
      }
      const wasAuto = me.auto, before = g.eid;
      const r = E.cmd(g, pid, m);
      if (r.err) return send(c, { t: 'err', m: r.err });
      touchGame(g);
      notifyAttacks(g, before);
      notifyEvents(g, before);
      if (r.msg) send(c, { t: 'msg', m: r.msg });
      const pvp = g.events.some(e => e.id >= before && (e.k === 'phit' || e.k === 'dip'));
      if (wasAuto || pvp) broadcast(g); else pushState(c);
      if (m.a === 'ready') maybeAdvance(g);
      return;
    }
  } catch (e) {
    console.error('Error en mensaje', m && m.t, e);
    send(c, { t: 'err', m: 'Error interno del servidor' });
  }
}

/* ---------- HTTP ---------- */
function gamesInfo() {
  return [...games.values()].map(g => ({ code: g.code, status: g.status, turn: g.turn, endsAt: g.endsAt, players: g.players.length }));
}
function storeInfo() {
  const st = remote || local;
  return { type: remote ? 'nube' : 'disco', ok: st.status.ok, lastOk: st.status.lastOk, error: st.status.lastError, pending: [...games.values()].filter(g => g._d).length };
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
    return res.end(JSON.stringify({ ok: true, now: Date.now(), conns: [...conns.keys()].filter(c => c.open).length, games: gamesInfo(), store: storeInfo(), push: !!vapid }));
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
      for (const s of arr) { const g = E.deserialize(s); if (g && g.code) { g.endsAt = Math.max(g.endsAt, Date.now() + 600000); g.rev = (g.rev || 0) + 1000; games.set(g.code, g); touchGame(g, true); n++; } }
      res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('Restauradas ' + n + ' partidas');
    } catch (e) { res.writeHead(400); return res.end('JSON inválido'); }
  }
  let f = p === '/' ? '/index.html' : p === '/vigia' ? '/vigia.html' : p;
  f = path.normalize(f).replace(/^(\.\.[/\\])+/, '').replace(/\\/g, '/');
  const base = f.replace(/^\//, '');
  const candidates = ROOT_FILES.has(base) ? [path.join(__dirname, base), path.join(PUB, base)] : [path.join(PUB, f)];
  const tryNext = i => {
    if (i >= candidates.length) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    const full = candidates[i];
    fs.readFile(full, (err, data) => {
      if (err) return tryNext(i + 1);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  };
  tryNext(0);
});

WS.attach(server, c => {
  c.on('message', t => onMessage(c, t));
  c.on('close', () => { conns.delete(c); });
});

/* ---------- reloj de turnos, guardado y "mantener despierto" ---------- */
let lastRetry = 0;
setInterval(() => {
  const now = Date.now();
  for (const g of [...games.values()]) {
    if (g.status === 'playing' && now >= g.endsAt) { try { advance(g); } catch (e) { console.error('Error avanzando turno', g.code, e); g.endsAt = now + 60000; } }
  }
  try { remindAll(); } catch (e) { console.error('Error en recordatorios', e); }
  saveDirtyGames().catch(() => {});
  for (const [code, g] of [...games]) { // limpiar partidas terminadas o abandonadas hace mucho
    const idle = now - (g.status === 'lobby' ? g.created : g.endsAt);
    if ((g.status === 'over' && idle > 7 * 86400000) || (g.status === 'lobby' && idle > 2 * 86400000)) dropGame(code);
  }
  if (remote && !remoteLoaded && now - lastRetry > RETRY_MS) { lastRetry = now; loadRemote().then(() => { console.log('Nube restablecida: partidas cargadas'); return ensureVapid(); }).catch(() => {}); }
  if (!vapid && (remoteLoaded || !remote) && now - lastRetry > RETRY_MS) { lastRetry = now; ensureVapid().catch(() => {}); }
}, 2000);
setInterval(() => { for (const c of conns.keys()) { if (c.open) c.ping(); } }, 25000);
const SELF = process.env.RENDER_EXTERNAL_URL;
if (SELF) setInterval(() => { fetch(SELF + '/health', { signal: AbortSignal.timeout(10000) }).catch(() => {}); }, 9 * 60 * 1000);

/* ---------- arranque y cierre ---------- */
let closing = false;
async function shutdown() {
  if (closing) return; closing = true;
  console.log('Cerrando: guardando partidas…');
  try { await Promise.race([saveDirtyGames(true), sleep(8000)]); } catch (e) { /* nada */ }
  process.exit(0);
}
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, shutdown);
process.on('unhandledRejection', e => console.error('Promesa sin manejar:', e && e.message || e));

const bootP = (async function boot() {
  adopt(await local.loadAll(), 'local');
  if (remote) {
    for (let i = 1; i <= 3 && !remoteLoaded; i++) {
      try { await loadRemote(); } catch (e) { console.error('No se pudo leer la nube (intento ' + i + '/3):', e.message); if (i < 3) await sleep(2000); }
    }
    if (!remoteLoaded) console.error('Se arranca con lo que hay en disco; se reintentará cada minuto.');
  }
  await ensureVapid().catch(e => console.error('Avisos no disponibles:', e.message));
  console.log('Partidas cargadas:', games.size, '· guardado en', remote ? 'la nube (Upstash)' : 'disco local (se pierde si Render reinicia)', '· avisos', vapid ? 'listos' : 'no disponibles');
  server.listen(PORT, () => console.log('Aventura de almas escuchando en el puerto', PORT));
})();
if (process.env.ADA_TEST) module.exports = { ready: bootP, games, conns, advance, remindAll, notifyAttacks, notifyEvents, touchGame };
