'use strict';
/* Aventura de almas — motor del juego (lógica pura, sin red) */
const S = require('./shared.js');
const BC = require('./botchat.js');
const K = S.KINDS;
const cheb = S.cheb;

const COLORS = ['#e5484d', '#3e8bff', '#2fbf71', '#f5b82e', '#a56bff', '#ff7a2f', '#22c3c3', '#ff6fb0', '#9aa7b5', '#9bd13a'];
const MAX_PLAYERS_WORLD = 24;
for (let i = COLORS.length; i < MAX_PLAYERS_WORLD; i++) COLORS.push(`hsl(${Math.round((i * 47) % 360)},${60 + (i % 3) * 10}%,${52 + (i % 2) * 8}%)`); // más colores para el mundo abierto
const COLOR_NAMES0 = ['Rojo', 'Azul', 'Verde', 'Dorado', 'Violeta', 'Naranja', 'Turquesa', 'Rosa', 'Plata', 'Lima'];
const COLOR_NAMES = COLOR_NAMES0.concat(Array.from({ length: 14 }, (_, i) => 'Color ' + (11 + i)));
const UNIT_NAMES = ['Aria', 'Brom', 'Cael', 'Dara', 'Eron', 'Fia', 'Gorin', 'Hela', 'Ivo', 'Juna', 'Kael', 'Lira', 'Maro', 'Nyx', 'Orin', 'Pia', 'Quin', 'Rhea', 'Soren', 'Tala', 'Ulf', 'Vera', 'Wren', 'Xan', 'Yara', 'Zed'];
const CITY_NAMES = ['Aldea Bruma', 'Puerto Ceniza', 'Valle Hueco', 'Torre Lunar', 'Fuerte Espina', 'Villa Alba', 'Paso del Cuervo', 'Refugio Ámbar', 'Monte Sombra', 'Claro Plata', 'Ruinas de Oro', 'Atalaya Gris', 'Nido de Roca', 'Vado Rojo'];
const BOT_NAMES = ['Morgana', 'Ragnar', 'Isolda', 'Thorin', 'Selene', 'Kaelen', 'Brynn', 'Dorian', 'Nerea', 'Vlad'];
const ROLES = ['frontal', 'arquero', 'tanque', 'medico'];
const ROLE_W = {
  frontal: { dano: 4, salud: 2, defensa: 2, movilidad: 1, doble: 3, medico: 0.2, general: 0.3 },
  arquero: { dano: 4, movilidad: 3, salud: 1.5, defensa: 1, doble: 3, medico: 0.2, general: 0.2 },
  tanque:  { salud: 3, defensa: 4, general: 2.5, dano: 1, movilidad: 0.5, medico: 0.3, doble: 0.3 },
  medico:  { medico: 4, general: 2, salud: 2, defensa: 2, dano: 1, movilidad: 1.5, doble: 0.3 },
};
const MAX_UNITS = 14;
const BREED_MAX = 20, BREED_WAIT = 15, BREED_BONUS = { hp: 10, dmg: 2 };
const MAX_LEVEL = 53; // = suma de los topes de habilidades (10+10+2+10+1+10+10), con 1 punto por nivel (nivel 1 ya trae 1)
const INV_CAP = 45;
const isAux = u => !!(u.sm || u.cart || u.bld || u.sg); // invocaciones y carretas no cuentan como unidades
const packBonus = u => { const k = u.eq && u.eq.mochila; return k ? (S.PACK[k.t] || 0) : 0; };
const capOf = u => u.cart ? S.CART.cap : INV_CAP + packBonus(u);
const CRAFTS_PER_TURN = 4;
const cityCrafts = c => CRAFTS_PER_TURN + 2 * ((c.b && c.b.herreria) || 0);

/* ---------- aleatoriedad (con semilla guardada en el estado) ---------- */
function rng(g) {
  g.rng = (g.rng + 0x6D2B79F5) | 0;
  let t = g.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (g, a, b) => a + Math.floor(rng(g) * (b - a + 1));
const pick = (g, arr) => arr[Math.floor(rng(g) * arr.length)];
function wpick(g, table) { // table: [[valor, peso], ...]
  let tot = 0; for (const t of table) tot += t[1];
  let r = rng(g) * tot;
  for (const t of table) { r -= t[1]; if (r <= 0) return t[0]; }
  return table[table.length - 1][0];
}

/* ---------- ruido para el mapa ---------- */
function hash(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s) {
  let t = 0, amp = 1, f = 1, tot = 0;
  for (let o = 0; o < 4; o++) { t += amp * vnoise(x * f, y * f, s + o * 101); tot += amp; amp *= 0.5; f *= 2; }
  return t / tot;
}

/* ---------- creación / lobby ---------- */
function createGame(code, hostName, hostToken) {
  const g = {
    code, status: 'lobby', created: Date.now(),
    pairs: {}, rv: [], graves: [], rd: {}, nets: {}, chat: [], cid: 0,
    cfg: Object.assign({ turnHours: 4, maxTurns: 0, idleTurns: 2, botLevel: 'normal' }, Object.fromEntries(Object.keys(S.WORLD_OPTS).map(k => [k, S.WORLD_OPTS[k].def]))),
    dip: {}, props: [], trades: [], brk: {}, sites: [],
    players: [], turn: 0, endsAt: 0, units: [], creatures: [], cities: [], events: [],
    nid: 1, eid: 1, rng: (Math.random() * 2147483647) | 0, hostId: 0, winner: null, map: null,
  };
  addPlayer(g, hostName, false, hostToken);
  return g;
}
const maxPlayers = g => g.cfg && g.cfg.mode === 'mundo' ? MAX_PLAYERS_WORLD : 10;
function addPlayer(g, name, bot, token, late) {
  if ((g.status !== 'lobby' && !late) || g.players.length >= maxPlayers(g)) return null;
  const id = g.players.length;
  const used = new Set(g.players.map(p => p.name));
  let nm = String(name || '').trim().slice(0, 14) || 'Jugador';
  if (used.has(nm)) { let i = 2; while (used.has(nm + i)) i++; nm = nm + i; }
  const p = { id, name: nm, color: COLORS[id], bot: !!bot, token: token || null, alive: true, ready: false,
    aggr: rng(g) < 0.5, pers: 'equilibrado', wr: {}, stats: { kills: 0, boss: 0, pk: 0 }, act: true, idle: 0, auto: false, push: [] };
  g.players.push(p);
  return p;
}
function addBot(g, pers) {
  if (g.status !== 'lobby' || g.players.length >= maxPlayers(g) || g.cfg.mode === 'mundo') return null;
  const used = new Set(g.players.map(p => p.name));
  const avail = BOT_NAMES.filter(n => !used.has('Bot ' + n));
  const b = addPlayer(g, 'Bot ' + (avail.length ? pick(g, avail) : g.players.length), true, null);
  if (b) {
    if (S.PERS[pers]) b.pers = pers;
    else { // al azar, intentando que cada bot tenga una personalidad distinta
      const taken = new Set(g.players.filter(p => p.bot && p !== b && p.pers).map(p => p.pers));
      const free = Object.keys(S.PERS).filter(k => !taken.has(k));
      b.pers = pick(g, free.length ? free : Object.keys(S.PERS));
    }
  }
  return b;
}
function removePlayer(g, id) {
  if (g.status !== 'lobby') return false;
  const i = g.players.findIndex(p => p.id === id);
  if (i <= 0) return false; // el anfitrión (0) no se quita
  g.players.splice(i, 1);
  g.players.forEach((p, k) => { p.id = k; p.color = COLORS[k]; });
  return true;
}

/* ---------- presencia, piloto automático y reemplazos ---------- */
function markSeen(g, pid) {
  const p = g.players[pid];
  if (!p || p.bot) return;
  p.act = true; p.idle = 0;
  if (p.auto) { p.auto = false; ev(g, `👋 ${p.name} vuelve y retoma el mando de su ejército.`, null, 'sys'); }
}
function replaceableSlots(g) {
  return g.players.filter(p => p.alive && p.bot).map(p => ({
    id: p.id, name: p.name, color: p.color,
    units: g.units.filter(u => u.o === p.id).length, cities: g.cities.filter(c => c.owner === p.id).length, score: score(g, p),
  }));
}
function replaceBot(g, pid, name, token) {
  if (g.status !== 'playing') return 'Esta partida no admite jugadores nuevos ahora';
  const p = g.players[pid];
  if (!p || !p.bot || !p.alive) return 'Ese lugar ya no está disponible';
  const base = String(name || '').trim().slice(0, 14);
  if (!base) return 'Escribe tu nombre';
  const used = new Set(g.players.filter(x => x !== p).map(x => x.name));
  let nm = base;
  if (used.has(nm)) { let i = 2; while (used.has((base + i).slice(0, 14))) i++; nm = (base + i).slice(0, 14); }
  const old = p.name;
  for (const c of g.cities) if (c.owner === p.id && c.name === 'Capital de ' + old) c.name = 'Capital de ' + nm;
  p.name = nm; p.bot = false; p.auto = false; p.token = token; p.push = []; p.idle = 0; p.act = true; p.ready = false;
  ev(g, `👋 ${nm} entra a la partida y toma el lugar de ${old}.`, null, 'sys');
  return p;
}
function releasePlayer(g, pid) {
  const p = g.players[pid];
  if (!p || p.bot || !p.alive) return 'No se puede liberar a ese jugador';
  if (!p.auto) return 'Solo se puede liberar a un jugador ausente (con bot al mando)';
  p.bot = true; p.auto = false; p.token = null; p.push = [];
  ev(g, `🤖 ${p.name} deja su lugar: queda un bot permanente y alguien nuevo puede ocuparlo.`, null, 'sys');
  return null;
}

/* ---------- diplomacia ---------- */
const pkey = (a, b) => a < b ? a + '-' + b : b + '-' + a;
function pactOf(g, a, b) { return (g.dip && g.dip[pkey(a, b)]) || null; }
function evPair(g, a, b, text, nt) {
  ev(g, text, [a, b], 'dip', nt);
  const rest = g.players.filter(x => x.id !== a && x.id !== b).map(x => x.id);
  if (rest.length) ev(g, text, rest, 'dip');
}
function applyPact(g, a, b, k) {
  const key = pkey(a, b);
  g.dip[key] = k; delete g.brk[key];
  botNote(g, g.players[a], b, 'fv', k === 'alianza' ? 3 : 2); botNote(g, g.players[b], a, 'fv', k === 'alianza' ? 3 : 2);
  g.props = g.props.filter(x => !(pkey(x.from, x.to) === key && (x.k === k || k === 'alianza')));
  evPair(g, a, b, k === 'paz' ? `🕊️ ${g.players[a].name} y ${g.players[b].name} firman la paz.` : `🤝 ${g.players[a].name} y ${g.players[b].name} forman una alianza.`, 'pact');
}
function doDip(g, p, m) {
  const d = m.d;
  if (g.cfg.mode === 'historia') return 'En el modo Historia todos los jugadores están aliados contra el mundo';
  if (g.cfg.mode === 'equipos') return 'En el modo por equipos las alianzas están fijadas: tus compañeros son aliados y los demás equipos, enemigos';
  if (g.cfg.mode === 'rey') return 'En el reto del Rey Demonio las alianzas están fijadas: el Rey Demonio contra todos los demás';
  if (d === 'accept' || d === 'reject' || d === 'cancel') {
    const pr = g.props.find(x => x.id === (m.id | 0));
    if (!pr) return 'Esa propuesta ya no existe';
    if (d === 'cancel') { if (pr.from !== p.id) return 'No es tu propuesta'; g.props.splice(g.props.indexOf(pr), 1); return { msg: 'Propuesta retirada' }; }
    if (pr.to !== p.id) return 'Esa propuesta no es para ti';
    g.props.splice(g.props.indexOf(pr), 1);
    if (d === 'reject') { ev(g, `❌ ${p.name} rechaza tu propuesta de ${S.PACTS[pr.k].n.toLowerCase()}.`, [pr.from], 'dip'); return { msg: 'Propuesta rechazada' }; }
    const cur = pactOf(g, pr.from, pr.to);
    if (cur === pr.k || cur === 'alianza') return 'Ya existe ese pacto';
    if (pr.k === 'alianza' && cur !== 'paz') return 'Ya no hay paz entre ustedes';
    if (!g.players[pr.from].alive) return 'Ese jugador ya no está en la partida';
    applyPact(g, pr.from, pr.to, pr.k);
    return { msg: 'Pacto firmado' };
  }
  const to = g.players[m.to | 0];
  if (!to || !to.alive || to === p) return 'Jugador no válido';
  const cur = pactOf(g, p.id, to.id);
  if (d === 'offer') {
    const k = m.k;
    if (k !== 'paz' && k !== 'alianza') return 'Propuesta no válida';
    if (cur === 'alianza') return 'Ya son aliados';
    if (k === 'paz' && cur === 'paz') return 'Ya hay paz con ese jugador';
    if (k === 'alianza' && cur !== 'paz') return 'Para aliarse primero deben firmar la paz';
    const rev = g.props.find(x => x.from === to.id && x.to === p.id && x.k === k);
    if (rev) { g.props.splice(g.props.indexOf(rev), 1); applyPact(g, to.id, p.id, k); return { msg: 'Pacto firmado' }; }
    if (g.props.some(x => x.from === p.id && x.to === to.id && x.k === k)) return 'Ya enviaste esa propuesta';
    if (g.props.filter(x => x.from === p.id).length >= 4) return 'Tienes demasiadas propuestas pendientes';
    g.props.push({ id: g.nid++, from: p.id, to: to.id, k, turn: g.turn });
    ev(g, `📨 ${p.name} te propone ${k === 'paz' ? 'la paz' : 'una alianza'}.`, [to.id], 'dip', 'prop');
    return { msg: 'Propuesta enviada a ' + to.name };
  }
  if (d === 'break') {
    if (!cur) return 'No tienes ningún pacto con ese jugador';
    const key = pkey(p.id, to.id);
    if (cur === 'alianza') { g.dip[key] = 'paz'; evPair(g, p.id, to.id, `💔 ${p.name} rompe la alianza con ${to.name}: vuelven a la paz.`, 'pact'); return { msg: 'Alianza rota (siguen en paz)' }; }
    if (g.brk[key] !== undefined) return 'Ya anunciaste la ruptura';
    g.brk[key] = g.turn + 2;
    evPair(g, p.id, to.id, `⚔️ ${p.name} rompe la paz con ${to.name}. La guerra empieza en 2 turnos.`, 'pact');
    return { msg: 'Paz rota: la guerra empieza en 2 turnos' };
  }
  return 'Acción de diplomacia desconocida';
}
/* ---------- comercio entre jugadores (v1.25) ---------- */
// Se puede comerciar con quien tengas paz o alianza. Quien propone deja lo que da «en depósito» (sale de su ciudad) hasta que el otro acepta, rechaza o caduca (5 turnos).
const TRADE_MAX_OUT = 3, TRADE_MAX_QTY = 60, TRADE_TTL = 5;
function tradeClean(o) { const r = {}; if (o && typeof o === 'object') for (const k of Object.keys(o)) { const n = Math.floor(+o[k]); if (S.MATS[k] && n > 0) r[k] = Math.min(TRADE_MAX_QTY, n); } return r; }
function tradeValue(mats) { let v = 0; for (const k in mats) { const m = S.MATS[k]; v += mats[k] * (S.MAT_VAL[k] || 1); } return v; }
function tradeHome(g, pid, prefer) { // ciudad donde recibe algo un jugador
  const mine = g.cities.filter(c => c.owner === pid);
  return mine.find(c => c.id === prefer) || mine.find(c => c.cap) || mine[0] || null;
}
function tradeRefund(g, t) { // devuelve lo depositado
  const c = tradeHome(g, t.from, t.fc);
  if (!c) return;
  for (const k in t.give) c.st.m[k] = (c.st.m[k] || 0) + t.give[k];
  if (t.item) c.st.it.push(t.item);
}
function doTrade(g, p, m) {
  g.trades = g.trades || []; g.merch = g.merch || []; g.dungeons = g.dungeons || [];
  const d = m.d;
  if (g.cfg.mode === 'uno') return 'En el reto de una unidad no hay comercio';
  if (d === 'cancel' || d === 'reject' || d === 'accept') {
    const t = g.trades.find(x => x.id === (m.id | 0));
    if (!t) return 'Esa oferta ya no existe';
    if (d === 'cancel') { if (t.from !== p.id) return 'No es tu oferta'; g.trades.splice(g.trades.indexOf(t), 1); tradeRefund(g, t); return { msg: 'Oferta retirada: te devolvemos lo depositado' }; }
    if (t.to !== p.id) return 'Esa oferta no es para ti';
    if (d === 'reject') { g.trades.splice(g.trades.indexOf(t), 1); tradeRefund(g, t); ev(g, `❌ ${p.name} rechaza tu oferta de comercio.`, [t.from], 'trade'); return { msg: 'Oferta rechazada' }; }
    return tradeAccept(g, p, t);
  }
  if (d !== 'offer') return 'Acción de comercio desconocida';
  const to = g.players[m.to | 0];
  if (!to || !to.alive || to === p) return 'Jugador no válido';
  if (!pactOf(g, p.id, to.id)) return 'Solo puedes comerciar con quien tengas paz o alianza';
  if (g.trades.filter(x => x.from === p.id).length >= TRADE_MAX_OUT) return 'Tienes demasiadas ofertas pendientes';
  const c = g.cities.find(x => x.id === (m.fc | 0) && x.owner === p.id);
  if (!c) return 'Elige una ciudad tuya de la que sale la mercancía';
  const give = tradeClean(m.give), want = tradeClean(m.want);
  const item = m.gi ? c.st.it.find(x => x.id === (m.gi | 0)) : null;
  if (m.gi && !item) return 'Ese objeto no está en el almacén de esa ciudad';
  if (!Object.keys(give).length && !item && !Object.keys(want).length) return 'La oferta está vacía';
  if (!canAfford(c.st.m, give)) return 'Esa ciudad no tiene todo lo que ofreces';
  spend(c.st.m, give);
  if (item) c.st.it.splice(c.st.it.indexOf(item), 1);
  g.trades.push({ id: g.nid++, from: p.id, to: to.id, fc: c.id, give, want, item: item || null, turn: g.turn });
  ev(g, `🛒 ${p.name} te ofrece un trato: ${tradeText(g.trades[g.trades.length - 1])}.`, [to.id], 'trade', 'prop');
  return { msg: 'Oferta enviada a ' + to.name };
}
function tradeText(t) {
  const side = (mats, item) => { const a = []; if (Object.keys(mats).length) a.push(fmtMats(mats)); if (item) a.push(S.itemName(item)); return a.length ? a.join(' + ') : 'nada'; };
  return `${side(t.give, t.item)} a cambio de ${side(t.want, null)}`;
}
function tradeAccept(g, p, t) {
  if (!g.players[t.from].alive) return 'Ese jugador ya no está en la partida';
  if (!pactOf(g, t.from, t.to)) return 'Ya no hay paz entre ustedes: no se puede comerciar';
  const src = g.cities.find(c => c.owner === p.id && canAfford(c.st.m, t.want));
  if (!src) return 'Ninguna de tus ciudades tiene todo lo que piden: ' + fmtMats(t.want);
  const dst = tradeHome(g, t.from, t.fc);
  if (!dst) return 'Ese jugador ya no tiene ciudades';
  const rcv = g.cities.find(c => c.owner === p.id && c.id === src.id) || src;
  g.trades.splice(g.trades.indexOf(t), 1);
  botNote(g, g.players[t.from], p.id, 'fv', 2); botNote(g, g.players[p.id], t.from, 'fv', 2);
  spend(src.st.m, t.want);
  for (const k in t.want) dst.st.m[k] = (dst.st.m[k] || 0) + t.want[k];
  for (const k in t.give) rcv.st.m[k] = (rcv.st.m[k] || 0) + t.give[k];
  if (t.item) rcv.st.it.push(t.item);
  ev(g, `🤝 Trato cerrado entre ${g.players[t.from].name} y ${p.name}: ${tradeText(t)}. Recibes la mercancía en ${rcv.name}.`, [t.from, p.id], 'trade');
  return { msg: 'Trato cerrado. Recibido en ' + rcv.name };
}
function tradeTick(g) { // caducidad y respuesta de bots / jugadores ausentes
  if (!g.trades || !g.trades.length) return;
  for (const t of g.trades.slice()) {
    if (!g.trades.includes(t)) continue;
    const a = g.players[t.from], b = g.players[t.to];
    if (g.turn - t.turn >= TRADE_TTL || !a.alive || !b.alive || !pactOf(g, t.from, t.to)) {
      g.trades.splice(g.trades.indexOf(t), 1); tradeRefund(g, t);
      if (a.alive) ev(g, `⌛ Tu oferta de comercio a ${b.name} caducó: te devolvemos lo depositado.`, [a.id], 'trade');
      continue;
    }
    if (!(b.bot || b.auto)) continue;
    const gv = tradeValue(t.give) + S.itemVal(t.item), wv = tradeValue(t.want);
    const fair = gv >= wv * 0.9 && (gv > 0 || wv === 0);
    const r = fair ? tradeAccept(g, b, t) : 'no';
    if (typeof r === 'string') { g.trades.splice(g.trades.indexOf(t), 1); tradeRefund(g, t); ev(g, `❌ ${b.name} rechaza tu oferta de comercio.`, [a.id], 'trade'); if (b.bot && !a.bot) botTalk(g, b, 'pact_no', { n: a.name }, true); }
    else if (b.bot && !a.bot) botTalk(g, b, 'pact_ok', { n: a.name }, true);
  }
}
function botDiplomacy(g) {
  if (g.cfg.mode === 'rey' || g.cfg.mode === 'historia' || g.cfg.mode === 'equipos') return;
  for (const key of Object.keys(g.brk)) {
    if (g.brk[key] <= g.turn) {
      const [a, b] = key.split('-').map(Number);
      delete g.dip[key]; delete g.brk[key];
      evPair(g, a, b, `⚔️ Termina la paz entre ${g.players[a].name} y ${g.players[b].name}: ¡están en guerra!`, 'pact');
    }
  }
  for (const pr of g.props.slice()) {
    if (!g.props.includes(pr)) continue;
    if (g.turn - pr.turn >= 5 || !g.players[pr.from].alive || !g.players[pr.to].alive) { g.props.splice(g.props.indexOf(pr), 1); continue; }
    const to = g.players[pr.to];
    if (!(to.bot || to.auto)) continue;
    const pers = to.auto ? 'granjero' : (to.pers || 'equilibrado');
    const recent = (to.wr && to.wr[pr.from] !== undefined && g.turn - to.wr[pr.from] <= 6) || (to.bot && botMem(to, pr.from).gr >= 5);
    let ok;
    if (to.auto && pr.k !== 'paz') continue; // un humano ausente no firma alianzas: espera a que vuelva
    const pb = to.bot ? botCfg(g, to).pb : (S.PERS[pers] || S.PERS.equilibrado).b, mem = to.bot ? botMem(to, pr.from) : { gr: 0, fv: 0 };
    ok = !recent && mem.gr < 5 && rng(g) < Math.max(0.02, Math.min(0.97, (pr.k === 'paz' ? pb.paz : pb.ali) + 0.07 * mem.fv - 0.1 * mem.gr));
    g.props.splice(g.props.indexOf(pr), 1);
    const asker = g.players[pr.from];
    if (ok) { applyPact(g, pr.from, pr.to, pr.k); if (to.bot && !asker.bot) botTalk(g, to, 'pact_ok', { n: asker.name }, true); }
    else { ev(g, `❌ ${to.name} rechaza tu propuesta de ${S.PACTS[pr.k].n.toLowerCase()}.`, [pr.from], 'dip'); if (to.bot && !asker.bot) botTalk(g, to, recent ? 'pact_no_recent' : 'pact_no', { n: asker.name }, true); }
  }
}

/* ---------- utilidades de estado ---------- */
function touch(g) { g._v = (g._v || 0) + 1; }
function idx(g) {
  if (g._ix && g._iv === g._v) return g._ix;
  const w = g.map.w;
  const U = new Map(), C = new Map(), T = new Map();
  for (const u of g.units) U.set(u.y * w + u.x, u);
  for (const c of g.creatures) C.set(c.y * w + c.x, c);
  for (const c of g.cities) T.set(c.y * w + c.x, c);
  g._ix = { U, C, T }; g._iv = g._v;
  return g._ix;
}
function terrAt(g, x, y) { return g.map.t.charAt(y * g.map.w + x); }
const mapH0 = g => g.map.h0 || g.map.h; // alto del mapa «de verdad» (sin la franja de mazmorras)
const mapArea = g => g.map.w * mapH0(g);
function inB(g, x, y) { return x >= 0 && y >= 0 && x < g.map.w && y < g.map.h; }
function ev(g, text, to, kind, nt) {
  g.events.push({ id: g.eid++, turn: g.turn, text, to: to || null, k: kind || '', nt: nt || undefined });
  if (g.events.length > 300) g.events.splice(0, g.events.length - 300);
  if (!to && CHRON_K.includes(kind)) { const ch = g.chron || (g.chron = []); ch.push({ id: g.eid - 1, turn: g.turn, text, k: kind }); if (ch.length > 400) ch.splice(0, ch.length - 400); } // crónica pública: dura mucho más que el registro
}
const CHRON_K = ['city', 'boss', 'story', 'season', 'pvp', 'sys'];
function recordHist(g) { // historial: puntos, unidades y ciudades de cada jugador al empezar cada turno
  const h = g.hist || (g.hist = []);
  h.push({ t: g.turn, p: g.players.map(p => p.alive ? [score(g, p), g.units.filter(u => u.o === p.id && !isAux(u)).length, g.cities.filter(c => c.owner === p.id).length] : null) });
  if (h.length > 500) g.hist = h.filter((e, i) => i >= 250 || i % 2 === 0); // al pasar de 500 turnos, se aclara la parte antigua
}
function histInfo(g, pid) { // series para el cliente: los 8 mejores jugadores (y tú) con un máximo de 70 puntos
  const h = g.hist || []; if (!h.length) return null;
  const last = h[h.length - 1].p, ids = g.players.map(p => p.id).filter(i => last[i]).sort((a, b) => last[b][0] - last[a][0]).slice(0, 8);
  if (pid !== undefined && last[pid] && !ids.includes(pid)) ids.push(pid);
  const stride = Math.max(1, Math.ceil(h.length / 70)), rows = [];
  h.forEach((e, i) => { if (i % stride === 0 || i === h.length - 1) rows.push([e.t].concat(ids.map(id => e.p[id] || null))); });
  return { ids, rows };
}
const invW = u => {
  let n = 0; for (const m in u.inv.m) n += u.inv.m[m];
  return n + u.inv.it.length * 2;
};
function putItem(u, it, dropped) { // un objeto vale más que cualquier material: si no cabe, se descarta lo más barato
  if (invW(u) + 2 > capOf(u)) { const d = freeUp(u, 2, 99); if (dropped) for (const k in d) dropped[k] = (dropped[k] || 0) + d[k]; }
  if (invW(u) + 2 > capOf(u)) return false;
  u.inv.it.push(it); return true;
}
const matVal = m => S.MAT_VAL[m] || 0;
// libera `need` espacios descartando los materiales de menor valor (solo los que valen menos que `maxVal`); devuelve lo descartado
function freeUp(u, need, maxVal) {
  const out = {};
  while (capOf(u) - invW(u) < need) {
    let w = null;
    for (const m in u.inv.m) if (u.inv.m[m] > 0 && matVal(m) < maxVal && (w === null || matVal(m) < matVal(w))) w = m;
    if (w === null) break;
    const n = Math.min(u.inv.m[w], need - (capOf(u) - invW(u)));
    u.inv.m[w] -= n; if (u.inv.m[w] <= 0) delete u.inv.m[w];
    out[w] = (out[w] || 0) + n;
  }
  return out;
}
// añade materiales por orden de valor (gemas, escamas, almas… primero); si no caben, descarta cuero/hueso (o lo más barato) de la mochila
// antes que perder lo valioso. Devuelve lo que no cupo; `dropped` (opcional) acumula lo descartado de la mochila para hacer sitio.
function addMats(u, mats, dropped) {
  const lost = {};
  const keys = Object.keys(mats).sort((x, y) => matVal(y) - matVal(x));
  for (const m of keys) {
    let want = mats[m]; if (want <= 0) continue;
    if (capOf(u) - invW(u) < want) {
      const d = freeUp(u, want, matVal(m));
      if (dropped) for (const k in d) dropped[k] = (dropped[k] || 0) + d[k];
    }
    const take = Math.max(0, Math.min(capOf(u) - invW(u), want));
    if (take) u.inv.m[m] = (u.inv.m[m] || 0) + take;
    if (want - take > 0) lost[m] = want - take;
  }
  return lost;
}
const fmtMats = m => Object.keys(m).filter(k => m[k] > 0).map(k => m[k] + ' ' + S.MATS[k].n.toLowerCase()).join(', ');
const canAfford = (store, cost) => { for (const m in cost) if ((store[m] || 0) < cost[m]) return false; return true; };
const spend = (store, cost) => { for (const m in cost) { store[m] -= cost[m]; if (store[m] <= 0) delete store[m]; } };

function newUnit(g, owner, x, y) {
  const used = new Set(g.units.filter(u => u.o === owner).map(u => u.name));
  let name = UNIT_NAMES.find(n => !used.has(n));
  if (!name) name = pick(g, UNIT_NAMES) + g.nid;
  const u = { id: g.nid++, o: owner, name, x, y, lv: 1, xp: 0, hp: 50, pts: 1,
    sk: { dano: 0, salud: 0, movilidad: 0, medico: 0, doble: 0, defensa: 0, general: 0 },
    eq: {}, inv: { m: {}, it: [] }, mp: 3, at: 1, hits: 0, moved: false, acted: false };
  g.units.push(u); touch(g);
  return u;
}

/* ---------- estadísticas efectivas ---------- */
function aura(g, u) {
  let a = 0;
  for (const v of g.units) {
    if (v === u || v.o !== u.o || cheb(u, v) !== 1) continue;
    const ga = 0.02 * v.sk.general + (v.cls ? (S.classMods(v).aura || 0) : 0);
    if (ga > a) a = ga;
  }
  return a;
}
function heroAura(g, u) { // +10% daño y defensa cerca del protagonista propio (no a él mismo)
  if (u.hero || g.cfg.hero === 'no') return 0;
  const p = g.players[u.o], h = p && p.hero ? g.units.find(x => x.id === p.hero) : null;
  return h && h.hero && cheb(u, h) <= S.HERO.range ? S.HERO.aura : 0;
}
function wallBonus(g, u) {
  let b = 0;
  for (const c of g.cities) {
    if (c.owner !== u.o || !c.b) continue;
    const d = cheb(c, u);
    let w = 0;
    if (c.b.muralla && wallUp(g, c)) { if (d === 0) w = 5 * c.b.muralla; else if (d === 1) w = 3 * c.b.muralla; }
    if (c.b.iglesia && d <= 2) w += (d <= 1 ? 2 : 1) * c.b.iglesia * (S.CHURCH.def / 2); // aura sagrada: +2/nivel en la ciudad y pegado, +1/nivel a 2 casillas
    { const gd = guildOf(g, u.o); if (gd && d <= 2 && g.cities.some(x => x !== c && x.owner !== null && gd.m.includes(x.owner) && cheb(x, c) <= S.WORLD.guild.dist)) w = Math.max(w, S.WORLD.guild.def); } // territorio del gremio
    b = Math.max(b, w);
  }
  if (!u.cart && !u.sm && g.units.some(v => v.cart && v.o === u.o && !v.dg && cheb(u, v) <= 1)) b = Math.max(b, S.CART.aura); // la carreta: mini ciudad
  return b;
}
const holyOf = c => (c && c.b && c.b.iglesia) || 0;
function holyCost(c, cost) { // la iglesia abarata huesos y almas
  const L = holyOf(c); if (!L) return cost;
  const o = Object.assign({}, cost);
  for (const k of ['hueso', 'alma']) if (o[k]) o[k] = Math.max(1, Math.ceil(o[k] * (1 - S.CHURCH.disc * L)));
  return o;
}
const evMode = g => g.cfg.events || 'todo';
const wxNow = g => (evMode(g) !== 'calma' && g.wx && S.WEATHER[g.wx.k]) || null;
function eff(g, u) {
  if (u.sg) { const D = S.SIEGE[u.sg.k]; return { maxHp: D.hp, def: D.def, dmg: D.dmg, range: D.range, min: D.min, reach: false, pierce: 0, kind: null, tier: 0, mov: D.mov, attacks: 1, aura: 0, ha: 0, fx: {}, mods: {} }; }
  if (u.bld) return { maxHp: S.BUILDER.hp, def: S.BUILDER.def, dmg: 0, range: 1, min: 1, reach: false, pierce: 0, kind: null, tier: 0, mov: S.BUILDER.mov, attacks: 0, aura: 0, ha: 0, fx: {}, mods: {} };
  if (u.cart) return { maxHp: S.CART.hp, def: S.CART.def, dmg: 0, range: 1, min: 1, reach: false, pierce: 0, kind: null, tier: 0, mov: S.CART.mov, attacks: 0, aura: 0, ha: 0, fx: {}, mods: {} };
  if (u.sm) { // invocación: estadísticas de la criatura según el nivel del invocador
    const d = S.CREATURES[u.sm.k], L = Math.max(1, Math.min(u.lv, d.max));
    const own = g.units.find(x => x.id === u.sm.by), cm = own && own.cls ? S.classMods(own) : {};
    return { maxHp: Math.round(d.hp * (1 + 0.18 * (L - 1)) * (1 + (cm.sumHp || 0))), def: Math.round((d.def + 1.2 * (L - 1)) * 10) / 10,
      dmg: Math.round(d.dmg * (1 + 0.12 * (L - 1)) * (1 + (cm.sumDmg || 0))), range: 1, min: 1, reach: false, pierce: 0, kind: null, tier: 0,
      mov: d.mov, attacks: 1, aura: 0, fx: {}, mods: {} };
  }
  if (u.bs) { // bestia del Rey Demonio: estadísticas de la criatura según su nivel + habilidades; sin equipo
    const d = S.CREATURES[u.bs], L = Math.max(1, u.lv), au = aura(g, u), ha = heroAura(g, u);
    const bsc = d.boss ? S.KING.boss : { hp: 1, dmg: 1 };
    return { maxHp: Math.round((d.hp * bsc.hp * (1 + 0.18 * (L - 1)) + 6 * u.sk.salud) * (1 + au)),
      def: Math.round((d.def + 1.2 * (L - 1) + 2 * u.sk.defensa + wallBonus(g, u)) * (1 + au) * (1 + ha) * 10) / 10,
      dmg: Math.round((d.dmg * bsc.dmg * (1 + 0.12 * (L - 1)) + 2 * u.sk.dano) * (1 + ha)), range: d.rng || 1, min: 1, reach: false, pierce: 0, kind: null, tier: 0,
      mov: Math.max(1, d.mov + u.sk.movilidad - (u.sl > 0 ? 2 : 0)), attacks: u.sk.doble ? 2 : 1, aura: au, ha, fx: {}, mods: {} };
  }
  const w = u.eq.arma;
  let dmgBase = 3, range = 1, min = 1, pierce = 0, movB = 0, single = false, reach = false, kind = null, tier = 0, quick = false, magic = false;
  if (w) {
    const k = K[w.k];
    dmgBase = Math.round(k.base * S.WM[w.t]); range = k.range; min = k.min; pierce = k.pierce || 0; movB = k.mov || 0; single = !!k.single; reach = !!k.reach; quick = !!k.quick; magic = !!k.magic; kind = w.k; tier = w.t;
  }
  let def = 0, aDmg = 0, aDef = 0, aMov = 0, aPierce = 0;
  const fx = {};
  for (const slot of S.SLOTS) {
    const it = u.eq[slot];
    if (!it) continue;
    if (slot !== 'arma') def += K[it.k].def * S.AM[it.t];
    if (it.fx) for (const f of it.fx) {
      const A = S.AFFIX[f]; if (!A) continue;
      const v = A.v[Math.min(5, Math.max(1, it.r || 1)) - 1];
      if (f === 'afilado') aDmg += v; else if (f === 'dureza') aDef += v; else if (f === 'agil') aMov += v; else if (f === 'certero') aPierce += v;
      else fx[f] = (fx[f] || 0) + v;
    }
    if (it.gm) for (const gk of it.gm) { // gemas engastadas
      const gf = S.gemFx(gk, !!K[it.k].w); if (!gf) continue;
      if (gf.f === 'afilado') aDmg += gf.v; else if (gf.f === 'dureza') aDef += gf.v; else if (gf.f === 'agil') aMov += gf.v; else if (gf.f === 'certero') aPierce += gf.v;
      else fx[gf.f] = (fx[gf.f] || 0) + gf.v;
    }
  }
  const cm0 = u.cls ? S.classMods(u) : {};
  const set = S.armorSet(u.eq), sb = set ? set.b : {};
  const cm = Object.assign({}, cm0, { execute: (cm0.execute || 0) + (fx.ejecutor || 0), vsCre: (cm0.vsCre || 0) + (fx.bestias || 0) });
  def += 2 * u.sk.defensa + aDef + (cm.def || 0) + (sb.def || 0) + wallBonus(g, u);
  for (const k of ['vida', 'veneno', 'regen', 'espinas', 'fuego', 'hielo']) if (cm[k] || sb[k]) fx[k] = (fx[k] || 0) + (cm[k] || 0) + (sb[k] || 0);
  const au = aura(g, u), ha = heroAura(g, u), wxd = wxNow(g);
  const wm = (wxd && range > 1) ? (magic ? 1 + wxd.mag : 1 - wxd.rng) : 1; // el clima afecta a las armas a distancia
  return {
    maxHp: Math.round((50 + 6 * u.sk.salud) * (1 + au) * (1 + (cm.hpPct || 0) + (sb.hpPct || 0) + (fx.vigor || 0))) + (u.bn ? u.bn.hp : 0),
    def: Math.round(def * (1 + au) * (1 + ha) * 10) / 10,
    dmg: Math.round(Math.round((dmgBase + 2 * u.sk.dano + aDmg) * (1 + (cm.dmgPct || 0) + (magic ? (cm.magic || 0) : 0)) * (1 + ha)) * wm) + (u.bn ? u.bn.dmg : 0),
    range: range > 1 ? Math.max(min, range + (cm.range || 0) - (wxd ? wxd.rngR : 0)) : range, min, reach, pierce: Math.min(0.9, pierce + aPierce + (cm.certero || 0)), kind, tier,
    mov: Math.max(1, 3 + u.sk.movilidad + movB + aMov + (cm.mov || 0) - (u.sl > 0 ? 2 : 0) - (wxd ? wxd.mov : 0)),
    attacks: 1 + ((u.sk.doble && !single) ? 1 : 0) + (quick ? 1 : 0),
    aura: au, ha, fx, mods: cm,
  };
}
function cstats(c, g) {
  const d = S.CREATURES[c.t], L = c.lv;
  const el = c.el ? 1 : 0, win = (g && g.turn > 0 && S.seasonIdx(g.turn) === 3) ? 1 : 0;
  const solo = d.boss && g && g.cfg && g.cfg.mode === 'uno'; // reto de una unidad: jefes más débiles (60% de vida, 80% de daño)
  return { mhp: Math.round(d.hp * (1 + 0.18 * (L - 1)) * (el ? 1.5 : 1) * (solo ? 0.6 : 1) * (c.wb ? S.WORLD.wb.hpMul : 1)),
    dmg: Math.round(d.dmg * (1 + 0.12 * (L - 1)) * (el ? 1.25 : 1) * (solo ? 0.8 : 1) * (win && d.agg > 0 ? 1.15 : 1) * (1 + 0.25 * (c.ph || 0)) * (c.wb ? S.WORLD.wb.dmgMul : 1)),
    def: d.def + 1.2 * (L - 1) + (el ? 2 : 0), rng: d.rng || 1, min: 1, mov: Math.max(1, d.mov + (c.ph ? 1 : 0) - (c.sl > 0 ? 2 : 0)), agg: d.agg + ((win && d.agg > 0) ? 1 : 0) };
}
function terrDef(g, x, y) {
  const c = idx(g).T.get(y * g.map.w + x);
  return (S.TERR[terrAt(g, x, y)].def || 0) + (c ? 6 : 0);
}
function calcDamage(raw, def, pierce) {
  const d = Math.max(0, def * (1 - (pierce || 0)));
  return Math.max(1, Math.round(raw * (1 - d / (d + 60))));
}
const xpNeed = lv => 10 + 8 * (lv - 1);
function gainXp(g, u, n) {
  if (u.sm || u.cart || u.bld || u.sg) return;
  if (u.hero) n = Math.round(n * S.HERO.xp);
  { const er = eff(g, u).fx.erudito; if (er) n = Math.round(n * (1 + er)); }
  u.xp += n;
  while (u.lv < MAX_LEVEL && u.xp >= xpNeed(u.lv)) {
    u.xp -= xpNeed(u.lv); u.lv++; u.pts++;
    ev(g, `⭐ ${u.name} sube a nivel ${u.lv}. Tiene puntos por gastar.`, [u.o], 'lvl');
  }
  if (u.lv >= MAX_LEVEL) u.xp = 0;
}

/* ---------- generación del mundo ---------- */
function genMap(g) {
  const n = g.players.length, cf = g.cfg;
  const biome = cf.biome || 'azar', base = biome === 'desierto' ? 'd' : 'g';
  const auto = Math.max(28, Math.min(52, 22 + n * 3));
  const mul = ({ pequeno: 0.72, normal: 1, grande: 1.35, enorme: 1.75 })[cf.mapSize] || 1;
  const size = cf.mode === 'mundo' ? ({ grande: 120, enorme: 160, gigante: 220 })[cf.worldSize] || 160 : Math.max(Math.max(22, Math.ceil(n * 3.6)), Math.min(80, Math.round(auto * mul)));
  g.ratio = Math.max(0.5, Math.min(3.5, (size * size) / (auto * auto)));
  const w = size, h = size;
  const sA = (rng(g) * 1e6) | 0, sB = (rng(g) * 1e6) | 0;
  const t = new Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = x / (w - 1) * 2 - 1, ny = y / (h - 1) * 2 - 1;
    const d = Math.max(Math.abs(nx), Math.abs(ny));
    const hh = fbm(x / 8, y / 8, sA) - Math.pow(d, 5) * 0.4;
    const m = fbm(x / 6, y / 6, sB);
    const land = biome === 'bosque' ? (m > 0.25 ? 'f' : 'g') : biome === 'pradera' ? 'g' : biome === 'desierto' ? 'd' : (m > 0.56 ? 'f' : 'g');
    t[y * w + x] = hh < (biome === 'desierto' ? 0.21 : 0.30) ? 'w' : hh > 0.74 ? 'm' : hh > 0.63 ? 'h' : land;
  }
  const carve = (x0, y0, x1, y1) => {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
    for (;;) {
      const k = y0 * w + x0;
      if (t[k] === 'w' || t[k] === 'm' || (biome === 'bosque' && t[k] === 'f')) t[k] = base; // en el bosque los caminos son senderos despejados
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  };
  const cx = Math.round((w - 1) / 2), cy = Math.round((h - 1) / 2), R = size * 0.36;
  const a0 = rng(g) * Math.PI * 2;
  const starts = [];
  for (let i = 0; i < n; i++) {
    const ang = a0 + (i / n) * Math.PI * 2;
    const sx = Math.max(4, Math.min(w - 5, Math.round(cx + Math.cos(ang) * R)));
    const sy = Math.max(4, Math.min(h - 5, Math.round(cy + Math.sin(ang) * R)));
    starts.push({ x: sx, y: sy });
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const X = sx + dx, Y = sy + dy;
      if (X >= 0 && Y >= 0 && X < w && Y < h && Math.max(Math.abs(dx), Math.abs(dy)) <= 2) t[Y * w + X] = base;
    }
  }
  for (let i = 0; i < n; i++) { carve(starts[i].x, starts[i].y, starts[(i + 1) % n].x, starts[(i + 1) % n].y); carve(starts[i].x, starts[i].y, cx, cy); }
  g.map = { w, h, t: null };
  g.cities = [];
  starts.forEach((s, i) => g.cities.push({ id: g.nid++, x: s.x, y: s.y, owner: i, name: 'Capital de ' + g.players[i].name, cap: true, st: { m: { cuero: 10, hueso: 8 }, it: [] }, crafts: 0 }));
  const names = CITY_NAMES.slice();
  const cm = ({ pocas: 0.5, normal: 1, muchas: 2, abundantes: 3 })[cf.cities] || 1;
  const want = cf.mode === 'mundo' ? Math.max(8, Math.round(size * size / 220 * cm)) : Math.max(1, Math.round((n + 3) * cm * g.ratio));
  const minD = cm >= 3 ? 5 : cm >= 2 ? 6 : 8;
  for (let tries = 0; tries < (cf.mode === 'mundo' ? 30000 : 4000) && g.cities.length < n + want; tries++) {
    const x = ri(g, 3, w - 4), y = ri(g, 3, h - 4);
    if (!'gfhd'.includes(t[y * w + x])) continue;
    if (g.cities.some(c => cheb(c, { x, y }) < minD)) continue;
    let near = null, nd = 1e9;
    for (const c of g.cities) { const d = cheb(c, { x, y }); if (d < nd) { nd = d; near = c; } }
    carve(x, y, near.x, near.y);
    t[y * w + x] = base;
    const stash = {}; stash.cuero = ri(g, 2, 6); stash.hueso = ri(g, 1, 5); if (rng(g) < 0.6) stash.hierro = ri(g, 1, 4); if (rng(g) < 0.2) stash.acero = ri(g, 1, 2);
    g.cities.push({ id: g.nid++, x, y, owner: null, name: names.length ? names.splice(ri(g, 0, names.length - 1), 1)[0] : 'Aldea ' + g.nid, cap: false, st: { m: stash, it: [] }, crafts: 0 });
  }
  for (const c of g.cities) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { // el solar de 3×3 de cada ciudad es siempre transitable
    const k = (c.y + dy) * w + c.x + dx;
    if (!dx && !dy) t[k] = base; else if (t[k] === 'w' || t[k] === 'm') t[k] = base;
  }
  g.map.t = t.join('');
  addDungeonBand(g);
  g.starts = starts;
  touch(g);
}

function zoneOf(g, x, y) {
  const world = g.cfg.mode === 'mundo';
  let d = 1e9;
  for (const c of g.cities) if (world ? c.owner !== null : c.cap) d = Math.min(d, cheb(c, { x, y }));
  const size = world ? 90 : g.map.w; // en el mundo abierto las zonas peligrosas se miden con distancias fijas
  return d <= size * 0.16 ? 0 : d <= size * 0.30 ? 1 : 2;
}
const ZONE_TABLE = [
  [['ciervo', 4], ['jabali', 3], ['lobo', 2], ['conejo', 3], ['cabra', 2], ['serpiente', 1], ['murcielago', 1]],
  [['lobo', 3], ['oso', 2], ['goblin', 3], ['esqueleto', 2], ['jabali', 1], ['toro', 1], ['arana', 2], ['serpiente', 1], ['escorpion', 1], ['bandido', 1], ['murcielago', 1], ['tortuga', 1]],
  [['goblin', 2], ['esqueleto', 3], ['orco', 3], ['troll', 2], ['oso', 1], ['bandido', 2], ['zombi', 2], ['fantasma', 2], ['golem', 1], ['escorpion', 1], ['arana', 1]],
];
const FAUNA_TABLES = {
  pacifica: [
    [['ciervo', 6], ['jabali', 3], ['lobo', 1], ['conejo', 4], ['cabra', 3]],
    [['ciervo', 3], ['jabali', 3], ['oso', 3], ['lobo', 1], ['goblin', 1], ['toro', 2], ['cabra', 2], ['tortuga', 2], ['conejo', 2]],
    [['oso', 2], ['jabali', 2], ['ciervo', 2], ['goblin', 1], ['esqueleto', 1], ['orco', 1], ['troll', 1], ['toro', 2], ['tortuga', 2], ['zombi', 1]],
  ],
  agresiva: [
    [['lobo', 4], ['jabali', 2], ['ciervo', 1], ['goblin', 2], ['serpiente', 2], ['murcielago', 2], ['arana', 1]],
    [['lobo', 3], ['goblin', 3], ['orco', 2], ['esqueleto', 3], ['oso', 1], ['arana', 2], ['bandido', 2], ['escorpion', 2], ['zombi', 1], ['murcielago', 1]],
    [['orco', 3], ['troll', 3], ['esqueleto', 3], ['goblin', 2], ['bandido', 2], ['zombi', 2], ['fantasma', 3], ['golem', 2], ['escorpion', 1]],
  ],
};
const zoneTable = (g, zone) => (FAUNA_TABLES[g.cfg.fauna] || ZONE_TABLE)[zone];
const siteWant = g => g.cfg.mode === 'mundo' ? Math.max(10, Math.round(mapArea(g) / 420)) : Math.max(2, Math.round((g.players.length * 0.8 + 3) * (g.ratio || 1)));
function freeLandTile(g, minDistCity, minDistUnit, zone) {
  const w = g.map.w, h = mapH0(g), ix = idx(g);
  for (let tries = 0; tries < 200; tries++) {
    const x = ri(g, 1, w - 2), y = ri(g, 1, h - 2), k = y * w + x;
    if (!'gfhd'.includes(g.map.t.charAt(k))) continue;
    if (ix.U.has(k) || ix.C.has(k) || ix.T.has(k)) continue;
    if (g.cities.some(c => cheb(c, { x, y }) < minDistCity)) continue;
    if (g.units.some(u => cheb(u, { x, y }) < minDistUnit)) continue;
    if (g.sites && g.sites.some(t => t.x === x && t.y === y)) continue;
    if (zone !== undefined && zoneOf(g, x, y) !== zone) continue;
    return { x, y };
  }
  return null;
}
function spawnCreature(g, type, x, y, lv) {
  const d = S.CREATURES[type];
  const c = { id: g.nid++, t: type, x, y, hx: x, hy: y, lv: Math.min(lv, d.max), hp: 1, prov: null, hit: false };
  c.hp = cstats(c, g).mhp;
  g.creatures.push(c); touch(g);
  return c;
}
function dirText(g, pos) {
  const mid = (g.map.w - 1) / 2;
  const ns = pos.y < mid - 4 ? 'norte' : pos.y > mid + 4 ? 'sur' : '';
  const ew = pos.x < mid - 4 ? 'oeste' : pos.x > mid + 4 ? 'este' : '';
  const dir = ns && ew ? ({ norteoeste: 'noroeste', norteeste: 'noreste', suroeste: 'suroeste', sureste: 'sureste' })[ns + ew] : (ns || ew);
  return dir ? 'hacia el ' + dir : 'en el centro';
}
const regionIdx = (g, x, y) => { const m = (g.map.w - 1) / 2, f = Math.max(Math.abs(x - m), Math.abs(y - m)) / m, R = S.WORLD.regions; for (let i = 0; i < R.length; i++) if (f <= R[i].to) return i; return R.length - 1; }; // 0 seguras, 1 medias, 2 salvajes
const rndLv = (g, type, x, y) => { const d = S.CREATURES[type], k = x === undefined ? 1 : S.WORLD.regions[regionIdx(g, x, y)].lv; return Math.max(1, Math.min(d.max, 1 + Math.floor(Math.pow(rng(g), 1.5) * d.max * k))); }; // mundo abierto: nivel al azar, no sube con el tiempo
function spawnNormal(g, initial) {
  const world = g.cfg.mode === 'mundo';
  let zone = wpick(g, [[0, initial ? 4 : 3], [1, 3], [2, initial ? 2 : 3]]);
  const pos = freeLandTile(g, initial ? 5 : 4, initial ? 6 : 8, world ? undefined : zone);
  if (!pos) return null;
  if (world) zone = regionIdx(g, pos.x, pos.y); // mundo abierto: el peligro depende de la región (distancia al centro)
  const type = wpick(g, zoneTable(g, zone));
  const lv = g.cfg.mode === 'mundo' ? rndLv(g, type, pos.x, pos.y) : 1 + zone + (initial ? 0 : Math.floor(g.turn / 15));
  const c = spawnCreature(g, type, pos.x, pos.y, lv);
  if (!initial && g.turn >= 6 && zone >= 1 && !S.CREATURES[type].boss && rng(g) < 0.08) {
    const used = new Set(g.creatures.filter(x => x.el).map(x => x.el));
    const free = S.ELITE_NAMES.filter(n => !used.has(n));
    if (free.length) {
      c.el = pick(g, free); c.lv = Math.min(c.lv + 1, S.CREATURES[type].max); c.hp = cstats(c, g).mhp;
      ev(g, `⭐ Ha aparecido ${c.el}, ${S.CREATURES[type].n} élite (nivel ${c.lv}) ${dirText(g, pos)} del mapa. Suelta botín doble y un objeto raro.`, null, 'boss');
    }
  }
  return c;
}
function spawnSite(g) {
  const zone = wpick(g, [[0, 2], [1, 3], [2, 3]]);
  const pos = freeLandTile(g, 4, 5, zone);
  if (!pos || g.sites.some(t => cheb(t, pos) < 4)) return null;
  const k = rng(g) < 0.35 ? 'ruina' : 'cofre';
  const site = { id: g.nid++, x: pos.x, y: pos.y, k };
  g.sites.push(site);
  if (k === 'ruina') { // las ruinas tienen guardianes
    const n = zone >= 2 ? 2 : 1, ix = idx(g);
    for (let i = 0; i < n; i++) {
      for (const [dx, dy] of S.DIRS) {
        const x = pos.x + dx, y = pos.y + dy, kk = y * g.map.w + x;
        if (!inB(g, x, y) || !'gfhd'.includes(terrAt(g, x, y)) || idx(g).U.has(kk) || idx(g).C.has(kk) || idx(g).T.has(kk)) continue;
        spawnCreature(g, wpick(g, zoneTable(g, Math.max(1, zone))), x, y, 2 + zone + Math.floor(g.turn / 15));
        break;
      }
    }
  }
  return site;
}
function spawnHorde(g) {
  const cands = g.cities.filter(c => c.owner !== null && g.players[c.owner].alive);
  if (!cands.length) return null;
  const city = pick(g, cands), w = g.map.w;
  const strong = g.turn > 40;
  const types = strong ? ['orco', 'esqueleto', 'troll', 'goblin'] : ['goblin', 'lobo', 'esqueleto'];
  const winter = S.seasonIdx(g.turn) === 3;
  const n = 3 + Math.min(3, Math.floor(g.turn / 25)) + (winter ? 1 : 0);
  const lv = 1 + (strong ? 1 : 0) + Math.floor(g.turn / 18);
  let made = 0;
  for (let tries = 0; tries < 80 && made < n; tries++) {
    const ang = rng(g) * Math.PI * 2, r = 7 + Math.floor(rng(g) * 3);
    const x = Math.round(city.x + Math.cos(ang) * r), y = Math.round(city.y + Math.sin(ang) * r);
    if (!inB(g, x, y) || !'gfhd'.includes(terrAt(g, x, y))) continue;
    const k = y * w + x, ix = idx(g);
    if (ix.U.has(k) || ix.C.has(k) || ix.T.has(k)) continue;
    const c = spawnCreature(g, pick(g, types), x, y, lv);
    c.tg = city.id; c.ttl = 14; made++;
  }
  if (!made) return null;
  ev(g, `🐺 ¡Una horda de ${made} criaturas avanza hacia ${city.name}! Defiende la ciudad con tus unidades.`, [city.owner], 'horde', 'horde');
  const others = g.players.filter(x => x.id !== city.owner).map(x => x.id);
  if (others.length) ev(g, `🐺 Una horda se dirige a ${city.name} (de ${g.players[city.owner].name}).`, others, 'horde');
  botReact(g, 'horda', g.players[city.owner], {}, 0.6);
  return made;
}
function rareItem(g, o) {
  o = o || {};
  const kind = pick(g, Object.keys(K));
  const tw = [[2, 3], [3, 4], [4, g.turn > 30 ? 2 : 1]]; if (o.t5) tw.push([5, o.t5]);
  const t = wpick(g, tw);
  const pool = (K[kind].slot === 'arma' ? S.WEAPON_FX : S.ARMOR_FX).slice();
  // rareza = nº de efectos (1 Poco común … 5 Mítico); pesos según el origen del botín
  const r = wpick(g, (o.w || [60, 30, 9, 1, 0]).map((w, i) => [i + 1, w]).filter(x => x[1] > 0));
  const fx = [];
  for (let i = 0; i < r; i++) fx.push(pool.splice(Math.floor(rng(g) * pool.length), 1)[0]);
  return { id: g.nid++, k: kind, t, r, fx, so: S.SOCKETS_BY_R[r] || 0, gm: [] };
}
// gema al azar: power 0..1 inclina hacia calidades altas (1 astillada, 2 normal, 3 perfecta); el diamante es más raro
function rollGem(g, power) {
  const id = wpick(g, S.GEM_IDS.map(k => [k, k === 'diamante' ? 0.5 : 1]));
  const l = wpick(g, [[1, 70 - 45 * power], [2, 25 + 25 * power], [3, 5 + 20 * power]]);
  return id + l;
}
function collectSite(g, u, site) {
  if (invW(u) + 2 > capOf(u)) { ev(g, `🎒 ${u.name} encuentra ${S.SITES[site.k].n} pero lleva la mochila llena. Deposita en una ciudad y vuelve.`, [u.o], 'site'); return; }
  g.sites.splice(g.sites.indexOf(site), 1);
  const mats = {};
  let item = null;
  if (site.k === 'tesoro') {
    const T = site.t || 1;
    mats.hierro = ri(g, 2, 3 + T); mats.acero = ri(g, 1 + (T >> 1), 2 + T); mats.cuero = ri(g, 2, 4 + T); mats.alma = ri(g, 1, 1 + T);
    for (let i = 0, n = 1 + (T >= 3 ? 1 : 0) + (T >= 5 ? 1 : 0); i < n; i++) { const gk = rollGem(g, 0.25 + 0.12 * T); mats[gk] = (mats[gk] || 0) + 1; }
    item = rareItem(g, { w: [[30, 40, 22, 7, 1], [15, 35, 30, 17, 3], [5, 25, 35, 28, 7], [0, 15, 35, 35, 15], [0, 5, 25, 40, 30]][T - 1], t5: T >= 5 ? 0.25 : 0 });
  } else if (site.k === 'cofre') {
    mats.cuero = ri(g, 2, 5); mats.hierro = ri(g, 1, 4);
    if (rng(g) < 0.3) mats.acero = ri(g, 1, 3);
    if (rng(g) < 0.15) mats.alma = 1;
    if (rng(g) < 0.35) item = rareItem(g, { w: [65, 28, 6, 1, 0] });
    if (rng(g) < 0.3) mats[rollGem(g, 0.1)] = 1;
  } else {
    mats.acero = ri(g, 1, 3); mats.alma = ri(g, 1, 2);
    mats[rollGem(g, 0.45)] = 1; if (rng(g) < 0.4) { const g2 = rollGem(g, 0.45); mats[g2] = (mats[g2] || 0) + 1; }
    item = rareItem(g, { w: [35, 35, 22, 7, 1] });
  }
  const dropped = {}, putOk = item ? putItem(u, item, dropped) : false;
  const lost = addMats(u, mats, dropped);
  const got = {}; for (const m in mats) { const n = mats[m] - (lost[m] || 0); if (n > 0) got[m] = n; }
  let msg = `${S.SITES[site.k].e} ${u.name} abre ${S.SITES[site.k].n.toLowerCase()}.` + (Object.keys(got).length ? ' Botín: ' + fmtMats(got) + '.' : '');
  if (Object.keys(lost).length) msg += ` ⚠️ Mochila llena, se perdió: ${fmtMats(lost)}.`;
  if (Object.keys(dropped).length) msg += ` 🗑️ Para hacer sitio se descartó: ${fmtMats(dropped)}.`;
  if (item) msg += putOk ? ` 🎁 Objeto raro: ${S.itemName(item)}.` : ' ⚠️ Sin espacio para el objeto raro.';
  ev(g, msg, [u.o], 'loot');
}
function bossCount(g) { return g.creatures.filter(c => S.CREATURES[c.t].boss && !c.dg).length; }
function spawnBoss(g, type0, lv0) {
  const pos = freeLandTile(g, 10, 10, 2) || freeLandTile(g, 8, 8) || (type0 && (freeLandTile(g, 6, 5) || freeLandTile(g, 4, 3) || freeLandTile(g, 2, 2)));
  if (!pos) return null;
  const type = type0 || pick(g, S.BOSS_IDS());
  let lv = lv0 || (g.cfg.mode === 'mundo' ? ri(g, 5, 15) : 3 + Math.floor(g.turn / 10));
  if (!lv0 && g.cfg.mode !== 'mundo') { // escala con el nivel de los jugadores: media de sus 3 mejores unidades × 0.9, sin pasarse de +6 sobre el ritmo normal
    const top = g.units.filter(u => !isAux(u) && !g.players[u.o].bot).map(u => u.lv).sort((a, b) => b - a).slice(0, 3); if (top.length) lv = Math.max(lv, Math.min(lv + 6, Math.round(top.reduce((a, b) => a + b, 0) / top.length * 0.9)));
  }
  const c = spawnCreature(g, type, pos.x, pos.y, lv);
  ev(g, `🐉 Ha aparecido un jefe: ${S.CREATURES[type].n} (nivel ${c.lv}) ${dirText(g, pos)} del mapa.`, null, 'boss');
  botAnyTalk(g, 'boss', { b: S.CREATURES[type].n }, 0.6);
  return c;
}

/* ---------- mazmorras (v1.29) ---------- */
// Cada mazmorra es un bloque aparte de la «franja» que se añade debajo del mapa, rodeado de muros y a 8 casillas del mundo: al entrar, la unidad desaparece
// del mapa y aparece allí (otro «mundo» con su propia niebla). Salas unidas en serpiente: entrada (salida) → … → sala del jefe.
function dgCount(g) { const w = g.map.w; return g.cfg.mode === 'mundo' ? Math.max(6, Math.min(30, Math.round(w * w / 2200))) : Math.max(2, Math.min(8, Math.round(1.5 + w / 14))); }
function addDungeonBand(g) {
  const D = S.DUNGEON, w = g.map.w, h0 = g.map.h, n = dgCount(g), per = Math.max(1, Math.floor(w / D.w)), rows = Math.ceil(n / per);
  const H = D.buf + rows * D.h, t = new Array(w * (h0 + H)).fill('k');
  for (let i = 0; i < w * h0; i++) t[i] = g.map.t.charAt(i);
  for (let y = h0; y < h0 + D.buf; y++) for (let x = 0; x < w; x++) t[y * w + x] = 'k';
  g.dungeons = [];
  for (let i = 0; i < n; i++) {
    const ox = (i % per) * D.w + Math.floor((w - per * D.w) / 2), oy = h0 + D.buf + Math.floor(i / per) * D.h;
    const lay = carveDungeon(g, t, w, ox, oy);
    g.dungeons.push({ id: g.nid++, tier: 1, x: -1, y: -1, ox, oy, rooms: lay.rooms, exit: lay.exit, cleared: 0, bossId: 0 });
  }
  g.map.h0 = h0; g.map.h = h0 + D.buf + rows * D.h; g.map.t = t.join('');
}
function carveDungeon(g, t, w, ox, oy) {
  const floor = (x, y) => { t[y * w + x] = 'r'; };
  const cols = [1, 8, 15], rws = [1, 8], order = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1]], rooms = [];
  order.forEach(([cx, cy], i) => {
    const boss = i === order.length - 1, rw = boss ? ri(g, 5, 6) : ri(g, 3, 5), rh = boss ? ri(g, 5, 6) : ri(g, 3, 5);
    const rx = ox + cols[cx] + ri(g, 0, 6 - rw), ry = oy + rws[cy] + ri(g, 0, 6 - rh);
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) floor(x, y);
    rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1), start: i === 0, boss });
  });
  const conn = (a, b) => { let x = a.cx, y = a.cy; while (x !== b.cx) { floor(x, y); x += x < b.cx ? 1 : -1; } while (y !== b.cy) { floor(x, y); y += y < b.cy ? 1 : -1; } floor(x, y); };
  for (let i = 1; i < rooms.length; i++) conn(rooms[i - 1], rooms[i]);
  if (rng(g) < 0.6) conn(rooms[1], rooms[4]); // atajo
  return { rooms, exit: { x: rooms[0].cx, y: rooms[0].y } };
}
function dgFree(g, x, y) { const k = y * g.map.w + x, ix = idx(g); return terrAt(g, x, y) === 'r' && !ix.U.has(k) && !ix.C.has(k); }
function dgRoomTile(g, r, avoid) {
  for (let t = 0; t < 40; t++) { const x = ri(g, r.x, r.x + r.w - 1), y = ri(g, r.y, r.y + r.h - 1); if (dgFree(g, x, y) && !g.sites.some(q => q.x === x && q.y === y) && !(avoid && cheb({ x, y }, avoid) < 2)) return { x, y }; }
  return null;
}
function fillDungeon(g, d) { // (re)crea criaturas, tesoros y trampas
  const T = S.DUNGEON.tiers[d.tier - 1];
  for (const c of g.creatures.slice()) if (c.dg === d.id) g.creatures.splice(g.creatures.indexOf(c), 1);
  g.sites = g.sites.filter(q => q.dg !== d.id); touch(g);
  const mk = (type, pos, lv) => { const c = spawnCreature(g, type, pos.x, pos.y, Math.max(1, lv)); c.dg = d.id; return c; };
  d.rooms.forEach(r => {
    if (r.start) return;
    if (r.boss) {
      const bt = wpick(g, T.boss), pos = dgRoomTile(g, r) || { x: r.cx, y: r.cy }, bc = mk(bt, pos, T.bossLv);
      d.bossId = bc.id; bc.bd = true;
      for (let i = 0; i < Math.min(3, 1 + Math.floor(d.tier / 2)); i++) { const p2 = dgRoomTile(g, r); if (p2) mk(wpick(g, T.pool), p2, ri(g, T.lv[0], T.lv[1])); }
      for (let i = 0; i < 2; i++) { const p2 = dgRoomTile(g, r); if (p2) g.sites.push({ id: g.nid++, x: p2.x, y: p2.y, k: 'tesoro', dg: d.id, t: d.tier }); }
      return;
    }
    for (let i = 0, n = ri(g, 2, 3) + (d.tier >= 3 ? 1 : 0); i < n; i++) { const pos = dgRoomTile(g, r); if (pos) mk(wpick(g, T.pool), pos, ri(g, T.lv[0], T.lv[1])); }
    if (rng(g) < 0.65) { const pos = dgRoomTile(g, r); if (pos) g.sites.push({ id: g.nid++, x: pos.x, y: pos.y, k: 'tesoro', dg: d.id, t: d.tier }); }
    if (rng(g) < 0.7) { const pos = dgRoomTile(g, r); if (pos) g.sites.push({ id: g.nid++, x: pos.x, y: pos.y, k: 'trampa', dg: d.id, t: d.tier, hid: true }); }
  });
  for (const r of d.rooms.slice(1)) { // trampas en los pasillos (entre salas)
    if (rng(g) < 0.5) { const x = r.cx + ri(g, -2, 2), y = r.cy; if (dgFree(g, x, y) && !g.sites.some(q => q.x === x && q.y === y) && !d.rooms.some(q => q.start && x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h)) g.sites.push({ id: g.nid++, x, y, k: 'trampa', dg: d.id, t: d.tier, hid: true }); }
  }
  d.cleared = 0; touch(g);
}
function setupDungeons(g) { // coloca las entradas en el mapa y llena las mazmorras
  const D = S.DUNGEON, world = g.cfg.mode === 'mundo';
  for (const d of g.dungeons) {
    let pos = null;
    for (let t = 0; t < 60 && !pos; t++) { const zone = ri(g, 0, 2), p = freeLandTile(g, 5, 5, zone); if (p && !g.dungeons.some(o => o.x >= 0 && cheb(o, p) < 6) && !g.sites.some(q => cheb(q, p) < 2)) { pos = p; d.zone = zone; } }
    if (!pos) { d.x = d.y = -1; d.off = true; continue; }
    d.x = pos.x; d.y = pos.y;
    d.tier = world ? ri(g, 1, 5) : wpick(g, [[[1, 3], [2, 4], [3, 1]], [[2, 2], [3, 3], [4, 2]], [[3, 2], [4, 3], [5, 2]]][d.zone].map(([a, b]) => [a, b])); 
    fillDungeon(g, d);
  }
  g.dungeons = g.dungeons.filter(d => !d.off);
}
const dgName = d => S.DUNGEON.tiers[d.tier - 1].n;
function dgSpot(g, cx, cy, wantTerr, maxR) { // casilla libre más cercana
  for (let r = 0; r <= maxR; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = cx + dx, y = cy + dy; if (!inB(g, x, y)) continue;
    const k = y * g.map.w + x, ix = idx(g), ch = terrAt(g, x, y);
    if (wantTerr.includes(ch) && !ix.U.has(k) && !ix.C.has(k) && !ix.T.has(k)) return { x, y };
  }
  return null;
}
function doDungeon(g, p, m) {
  const u = g.units.find(x => x.id === (m.u | 0) && x.o === p.id);
  if (!u) return 'Unidad no encontrada';
  if (u.cart) return 'La carreta no entra en mazmorras';
  if (m.d === 'enter') {
    if (u.dg) return 'Esta unidad ya está en una mazmorra';
    const d = g.dungeons.find(x => x.id === (m.id | 0));
    if (!d) return 'Esa entrada ya no existe';
    if (cheb(u, d) > 1) return 'Acerca la unidad a la entrada (a una casilla o menos)';
    const spot = dgSpot(g, d.exit.x, d.exit.y + 1, 'r', 3);
    if (!spot) return 'La entrada está bloqueada ahora mismo';
    const crew = u.sm ? [] : g.units.filter(v => v.sm && v.sm.by === u.id && !v.dg && cheb(v, u) <= 3); // sus invocaciones cercanas lo acompañan
    u.ret = { x: u.x, y: u.y }; u.dg = d.id; u.x = spot.x; u.y = spot.y; u.mp = 0; u.moved = true; touch(g);
    for (const v of crew) { const sp = dgSpot(g, d.exit.x, d.exit.y + 1, 'r', 4); if (!sp) break; v.ret = { x: v.x, y: v.y }; v.dg = d.id; v.x = sp.x; v.y = sp.y; v.mp = 0; v.moved = true; touch(g); }
    ev(g, `🕳️ ${u.name}${crew.length ? ' y sus invocaciones' : ''} entra en la ${dgName(d).toLowerCase()} (nivel recomendado ${S.DUNGEON.tiers[d.tier - 1].rec}).`, [u.o], 'site');
    return { msg: `${u.name} entra en la mazmorra` };
  }
  if (m.d === 'leave') {
    const d = g.dungeons.find(x => x.id === u.dg);
    if (!d) return 'Esta unidad no está en una mazmorra';
    if (cheb(u, d.exit) > 1) return 'Acércate a la puerta de salida';
    const spot = dgSpot(g, d.x, d.y, 'gfhd', 4);
    if (!spot) return 'No hay sitio fuera de la entrada ahora mismo';
    delete u.dg; u.x = spot.x; u.y = spot.y; u.mp = 0; u.moved = true; touch(g);
    if (!u.sm) for (const v of g.units.filter(v2 => v2.sm && v2.sm.by === u.id && v2.dg === d.id && cheb(v2, d.exit) <= 4)) { const sp = dgSpot(g, d.x, d.y, 'gfhd', 5); if (!sp) break; delete v.dg; v.x = sp.x; v.y = sp.y; v.mp = 0; v.moved = true; touch(g); }
    ev(g, `🚪 ${u.name} sale de la mazmorra.`, [u.o], 'site');
    return { msg: `${u.name} sale de la mazmorra` };
  }
  return 'Acción de mazmorra desconocida';
}
function springTrap(g, u, st) {
  st.hid = false; st.used = true; touch(g);
  const e = eff(g, u), dmg = Math.max(1, Math.round(e.maxHp * S.DUNGEON.tiers[(st.t || 1) - 1].trap));
  u.hp = Math.max(1, u.hp - dmg);
  let msg = `⚠️ ¡Trampa! ${u.name} pierde ${dmg} de salud.`;
  if ((st.t || 1) >= 3) { u.pz = { t: 3, d: Math.max(1, Math.round(e.maxHp * 0.03)) }; msg += ' ☠️ Envenenado.'; }
  ev(g, msg, [u.o], 'site');
}
function dgTick(g) { // las mazmorras despejadas se reabastecen pasado un tiempo si no hay nadie dentro
  for (const d of g.dungeons || []) {
    if (!d.cleared || g.turn - d.cleared < S.DUNGEON.reset) continue;
    if (g.units.some(u => u.dg === d.id)) continue;
    fillDungeon(g, d);
  }
}
function dgOnKill(g, c, u) {
  const d = (g.dungeons || []).find(x => x.id === c.dg);
  if (!d || c.id !== d.bossId) return;
  d.cleared = g.turn; if (g.story) g.story.dg = (g.story.dg || 0) + 1;
  const T = S.DUNGEON.tiers[d.tier - 1], p = g.players[u.o];
  const gems = {}; for (let i = 0; i < 1 + (d.tier >= 3 ? 1 : 0); i++) { const k = rollGem(g, 0.3 + 0.12 * d.tier); gems[k] = (gems[k] || 0) + 1; }
  const item = rareItem(g, { w: [0, 15, 35, 35, 15], t5: d.tier >= 5 ? 0.3 : 0 });
  giveLoot(g, u, gems, item);
  ev(g, `🏆 ¡${p.name} despeja la ${T.n.toLowerCase()}! ${S.CREATURES[c.t].n} cae. Premio extra: ${fmtMats(gems)} y ${S.itemName(item)}. Se reabastecerá en ${S.DUNGEON.reset} turnos.`, null, 'boss');
}

function startGame(g) {
  if (g.status !== 'lobby') return 'La partida ya empezó';
  if (g.players.length < 2 && g.cfg.mode !== 'mundo') return 'Se necesitan al menos 2 jugadores (agrega bots)';
  if (!g.players.some(p => !p.bot)) return 'Debe haber al menos un jugador humano';
  genMap(g);
  const w = g.map.w, h = g.map.h;
  if (g.cfg.mode === 'uno') { g.cfg.hero = 'no'; g.cfg.breed = 'apagado'; } // reto: una sola vida, sin protagonista ni crías
  if (g.cfg.mode === 'equipos') { // equipos al azar y equilibrados: los compañeros quedan aliados
    const nT = Math.max(2, Math.min(g.cfg.teams === 'cinco' ? 5 : 2, g.players.length));
    const ord = g.players.slice(); for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(rng(g) * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
    ord.forEach((p, i) => { p.team = i % nT; });
    g.nTeams = nT;
    for (const a of g.players) for (const b of g.players) if (a.id < b.id && a.team === b.team) g.dip[pkey(a.id, b.id)] = 'alianza';
  }
  if (g.cfg.victory === 'tiempo' && !(g.cfg.maxTurns > 0)) g.cfg.maxTurns = S.VICTORY.tiempo.turns; // final por tiempo sin límite elegido: 40 turnos
  if (g.cfg.mode === 'mundo') for (const p of g.players) p.prot = g.turn + S.WORLD.prot; // protección de novato
  if (g.cfg.mode === 'mundo') { g.cfg.maxTurns = 0; g.cfg.idleTurns = 0; if (!g.cfg.breed || g.cfg.breed === 'apagado') g.cfg.breed = 'tres'; } // mundo abierto: sin fin, sin relevo de ausentes, siempre con crías
  if (g.cfg.mode === 'historia') storyStart(g);
  if (g.cfg.mode === 'rey') { // un jugador al azar es el Rey Demonio; los demás quedan aliados entre sí
    g.king = Math.floor(rng(g) * g.players.length);
    for (const a of g.players) for (const b of g.players) if (a.id < b.id && a.id !== g.king && b.id !== g.king) g.dip[pkey(a.id, b.id)] = 'alianza';
  }
  const nStart0 = g.cfg.mode === 'uno' ? 1 : Math.max(1, Math.min(14, g.cfg.startUnits | 0 || 4)), nStart = nStart0, lvStart = Math.max(1, Math.min(20, g.cfg.startLevel | 0 || 1)), armT = ({ hierro: 2, acero: 3 })[g.cfg.startArmor] || 0;
  for (const p of g.players) p.ex = new Uint8Array(w * h);
  g.cities.filter(c => c.cap).forEach(c => {
    const spots = [];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (!dx && !dy) continue;
      spots.push({ x: c.x + dx, y: c.y + dy, d: Math.abs(dx) + Math.abs(dy) });
    }
    spots.sort((a, b) => a.d - b.d || rng(g) - 0.5);
    let placed = 0;
    for (const s of spots) {
      if (placed >= (g.cfg.mode === 'rey' && c.owner === g.king ? Math.max(nStart, S.KING.n) : nStart)) break;
      if (!inB(g, s.x, s.y) || !'gfhd'.includes(terrAt(g, s.x, s.y))) continue;
      if (idx(g).U.has(s.y * w + s.x) || idx(g).T.has(s.y * w + s.x)) continue;
      const kingC = g.cfg.mode === 'rey' && c.owner === g.king;
      const kh = kingC && placed === 0 && g.cfg.hero !== 'no';
      if (kh) g.kingBoss = pick(g, S.KING.heroes); // protagonista del Rey: un jefe al azar
      const nu = kingC ? newBeast(g, c.owner, s.x, s.y, kh ? g.kingBoss : S.KING.start[placed % S.KING.start.length]) : newUnit(g, c.owner, s.x, s.y); placed++;
      if (kh) { nu.name = S.CREATURES[g.kingBoss].n; }
      const lv0 = kingC ? Math.max(lvStart, S.KING.lv) : lvStart;
      if (lv0 > 1) { nu.lv = lv0; nu.pts = lv0; }
      if (kingC) nu.hp = eff(g, nu).maxHp;
      if (armT && !kingC) for (const slot of ['casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas']) nu.eq[slot] = { id: g.nid++, k: slot, t: armT };
    }
  });
  const cap = Math.round(w * mapH0(g) / 55);
  const n0 = Math.round(cap * 0.6);
  for (let i = 0; i < n0; i++) spawnNormal(g, true);
  g.sites = [];
  for (let i = 0, want = siteWant(g), tr = 0; i < want && tr < 200; tr++) if (spawnSite(g)) i++;
  setupDungeons(g);
  g.status = 'playing'; g.turn = 1; weatherTick(g);
  g.hist = []; g.chron = []; recordHist(g);
  g.endsAt = Date.now() + g.cfg.turnHours * 3600000;
  for (const p of g.players) p.ready = false;
  refreshUnits(g);
  const heroOn = g.cfg.hero !== 'no';
  if (heroOn) for (const p of g.players.filter(x => !isKing(g, x.id))) { // cada jugador empieza con un protagonista (se puede cambiar en el turno 1)
    const f = g.units.find(u => u.o === p.id); if (f) { f.hero = S.HERO.emb[0]; p.hero = f.id; }
  }
  if (heroOn && g.cfg.mode === 'rey') { // el protagonista del Rey Demonio es un jefe al azar y no se puede cambiar
    const f = g.units.find(u => u.o === g.king && u.bs === g.kingBoss); if (f) { f.hero = S.CREATURES[g.kingBoss].e; g.players[g.king].hero = f.id; }
  }
  { const bs = g.players.filter(b => b.bot); for (let i = bs.length - 1; i > 0; i--) { const j = Math.floor(rng(g) * (i + 1)); [bs[i], bs[j]] = [bs[j], bs[i]]; } for (const b of bs.slice(0, 2)) botTalk(g, b, 'start', {}, true); }
  if (g.cfg.mode === 'rey') ev(g, `👑 ¡Reto del Rey Demonio! ${g.players[g.king].name} es el Rey Demonio${g.kingBoss ? ' y su protagonista es ' + S.CREATURES[g.kingBoss].e + ' ' + S.CREATURES[g.kingBoss].n : ''}: solo recluta bestias y está solo contra todos. Los otros ${g.players.length - 1} jugadores están aliados: ¡derrótenlo antes de que los destruya!`, null, 'sys');
  else ev(g, g.cfg.mode === 'uno' ? '⚔️ ¡Reto de una unidad! Cada jugador tiene una sola unidad: no se puede reclutar ni invocar y, si cae, quedas eliminado. ¡Cuídala!' : `⚔️ ¡Comienza Aventura de almas! Cada jugador empieza con ${nStart} unidades idénticas${lvStart > 1 ? ' de nivel ' + lvStart : ''}${armT ? ' con armadura de ' + (armT === 2 ? 'hierro' : 'acero') + ' completa' : ''}.`, null, 'sys');
  { const vk = (g.cfg.mode === 'normal' || g.cfg.mode === 'uno') ? g.cfg.victory : 'ultimo'; if (vk && vk !== 'ultimo' && S.WORLD_OPTS.victory.o[vk]) ev(g, '🎯 Final de esta partida — ' + S.WORLD_OPTS.victory.o[vk] + '.', null, 'sys'); }
  return null;
}

/* ---------- visibilidad ---------- */
function visFor(g, pid) {
  const w = g.map.w, h = g.map.h, v = new Uint8Array(w * h);
  const mark = (x, y, r2, rr) => {
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < w && Y < h) v[Y * w + X] = 1;
    }
  };
  const mine = o => o === pid || (o !== null && pactOf(g, pid, o) === 'alianza');
  for (const u of g.units) if (mine(u.o)) mark(u.x, u.y, 20, 4);
  for (const c of g.cities) if (mine(c.owner)) { const L = (c.b && c.b.atalaya) || 0, rr = 5 + 2 * L; mark(c.x, c.y, L ? (rr + 0.5) * (rr + 0.5) : 30, rr); }
  return v;
}

/* ---------- inventario, ciudad y equipo ---------- */
function cityZone(g, u) { // 0 = en el centro de una ciudad tuya, 1 = en su anillo de 3×3, null = fuera
  let d = null;
  for (const c of g.cities) if (c.owner === u.o) { const k = cheb(c, u); if (k <= 1 && (d === null || k < d)) d = k; }
  return d;
}
const guardPvp = (g, u) => { const z = cityZone(g, u); return z === null ? 0 : S.CITY_GUARD.pvp[z]; };
const guardHDef = (g, u, c) => { const z = c && c.tg ? cityZone(g, u) : null; return z === null ? 0 : S.CITY_GUARD.hordeDef[z]; };
const guardHAtk = (g, u, c) => { const z = c && c.tg ? cityZone(g, u) : null; return z === null ? 0 : S.CITY_GUARD.hordeAtk[z]; };
function cartNear(g, u) { // estación de suministros: una carreta tuya a 1 casilla (la carreta no se sirve a sí misma)
  if (u.cart || u.sm) return null;
  for (const v of g.units) if (v.cart && v.o === u.o && v !== u && cheb(u, v) <= 1 && !v.dg) return v;
  return null;
}
function stationOf(g, u) { // ciudad cercana o, si no, carreta cercana (almacén = su carga)
  const c = cityNear(g, u); if (c) return c;
  const v = cartNear(g, u); return v ? { st: v.inv, cartU: v, name: v.name } : null;
}
function cityNear(g, u) {
  for (const c of g.cities) if (c.owner === u.o && cheb(u, c) <= 1) return c;
  return null;
}
function depositAll(g, u, c) {
  if (c.cartU) { // la carreta tiene capacidad limitada
    const cu = c.cartU;
    for (const m of Object.keys(u.inv.m)) { const n = Math.min(u.inv.m[m], capOf(cu) - invW(cu)); if (n <= 0) break; cu.inv.m[m] = (cu.inv.m[m] || 0) + n; u.inv.m[m] -= n; if (!u.inv.m[m]) delete u.inv.m[m]; }
    while (u.inv.it.length && invW(cu) + 2 <= capOf(cu)) cu.inv.it.push(u.inv.it.shift());
    return;
  }
  for (const m in u.inv.m) c.st.m[m] = (c.st.m[m] || 0) + u.inv.m[m];
  u.inv.m = {};
  for (const it of u.inv.it) c.st.it.push(it);
  u.inv.it = [];
}
function doEquip(g, u, itemId) {
  const i = u.inv.it.findIndex(x => x.id === itemId);
  if (i < 0) return 'Ese objeto no está en la mochila';
  const it = u.inv.it[i], k = K[it.k], slot = k.slot;
  if (slot === 'escudo' && u.eq.arma && K[u.eq.arma.k].two) return 'Tu arma usa las dos manos: quítala para usar escudo';
  u.inv.it.splice(i, 1);
  const old = u.eq[slot];
  if (old) u.inv.it.push(old);
  u.eq[slot] = it;
  if (slot === 'mochila' && invW(u) > capOf(u)) { u.eq[slot] = old; if (old) u.inv.it.pop(); u.inv.it.splice(i, 0, it); return 'La mochila actual tiene demasiada carga para cambiarla por una más pequeña'; }
  if (slot === 'arma' && k.two && u.eq.escudo) { u.inv.it.push(u.eq.escudo); delete u.eq.escudo; }
  return null;
}
function doUnequip(g, u, slot) {
  const it = u.eq[slot];
  if (!it) return 'Nada equipado ahí';
  if (invW(u) + 2 > capOf(u)) return 'Mochila llena';
  if (slot === 'mochila' && invW(u) + 2 > INV_CAP) return 'Vacía algo de carga antes de quitarte la mochila';
  delete u.eq[slot]; u.inv.it.push(it);
  return null;
}
const isKing = (g, pid) => g.cfg.mode === 'rey' && g.king === pid;
function beastCost(g, city, kind) {
  const c = Object.assign({}, S.KING.beasts[kind].cost), L = (city && city.b && city.b.cuartel) || 0;
  if (L) for (const k in c) c[k] = Math.max(1, Math.ceil(c[k] * (1 - 0.2 * L)));
  return holyCost(city, c);
}
function newBeast(g, owner, x, y, kind) {
  const u = newUnit(g, owner, x, y); u.bs = kind; u.name = S.CREATURES[kind].n + ' ' + (g.units.filter(v => v.o === owner && v.bs === kind).length);
  return u;
}
function recruitCost(g, pid, city) {
  if (isKing(g, pid)) return beastCost(g, city, 'lobo');
  const n = g.units.filter(u => u.o === pid).length;
  const c = { cuero: 2 + n, hueso: 2 + Math.floor(n / 2) };
  if (n >= 6) c.hierro = n - 4;
  const L = (city && city.b && city.b.cuartel) || 0;
  if (L) for (const k in c) c[k] = Math.max(1, Math.ceil(c[k] * (1 - 0.2 * L)));
  return holyCost(city, c);
}
/* ---------- invocaciones (invocador y nigromante) ---------- */
const summonsOf = (g, o) => g.units.filter(x => x.o === o && x.sm);
function summonCity(g, u) {
  let best = null, bd = 99;
  for (const c of g.cities) if (c.owner === u.o) { const d = cheb(u, c); if (d <= S.SUMMON.range && d < bd) { best = c; bd = d; } }
  return best;
}
function summonInfo(g, u) {
  const cl = u.cls && S.CLASSES[u.cls];
  if (u.sm || !cl || !cl.summons || g.cfg.mode === 'uno') return null;
  const c = summonCity(g, u);
  return { n: summonsOf(g, u.o).length, max: S.SUMMON.max, near: !!c, bones: c ? (c.st.m.hueso || 0) : 0, opts: cl.summons.map(k => ({ k, cost: holyCost(c, S.SUMMON.cost[k]) })) };
}
function doSummon(g, u, k) {
  if (g.cfg.mode === 'uno') return 'En el reto de una unidad no se puede invocar';
  const cl = u.cls && S.CLASSES[u.cls];
  if (u.sm || !cl || !cl.summons || !cl.summons.includes(k)) return 'Tu clase no puede invocar eso';
  if (summonsOf(g, u.o).length >= S.SUMMON.max) return `Ya tienes ${S.SUMMON.max} invocaciones (el máximo por jugador)`;
  const c = summonCity(g, u);
  if (!c) return `Debes estar a ${S.SUMMON.range} casillas o menos de una ciudad tuya`;
  const cost = holyCost(c, S.SUMMON.cost[k]);
  if (!canAfford(c.st.m, cost)) return 'Faltan huesos en el almacén de la ciudad: ' + fmtMats(cost);
  const ix = idx(g); let spot = null;
  for (let r = 1; r <= 2 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
    const x = u.x + dx, y = u.y + dy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inB(g, x, y)) continue;
    const key = y * g.map.w + x;
    if (!'gfhd'.includes(terrAt(g, x, y)) || ix.U.has(key) || ix.C.has(key) || ix.T.has(key)) continue;
    spot = { x, y };
  }
  if (!spot) return 'No hay espacio libre junto a la unidad';
  spend(c.st.m, cost);
  const d = S.CREATURES[k], s = newUnit(g, u.o, spot.x, spot.y);
  s.name = d.n + ' de ' + u.name.slice(0, 10); s.sm = { k, by: u.id }; s.pts = 0; s.lv = u.lv;
  s.hp = eff(g, s).maxHp; s.mp = 0; s.at = 0; s.moved = true; s.acted = true;
  ev(g, `🔮 ${u.name} invoca a ${d.n} (${cost.hueso} huesos).`, [u.o], 'summon');
  return null;
}
/* ---------- carreta: almacén móvil, una por ciudad ---------- */
const cartOf = (g, c) => g.units.find(u => u.cart && u.cart.c === c.id);
function doCart(g, p, c) {
  if (g.cfg.mode === 'uno') return 'En el reto de una unidad no hay carretas';
  if (cartOf(g, c)) return 'Esta ciudad ya tiene su carreta';
  if (!canAfford(c.st.m, S.CART.cost)) return 'Faltan materiales en el almacén: ' + fmtMats(S.CART.cost);
  const ix = idx(g); let spot = null;
  for (let r = 1; r <= 2 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
    const x = c.x + dx, y = c.y + dy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inB(g, x, y)) continue;
    const k = y * g.map.w + x;
    if (!'gfhd'.includes(terrAt(g, x, y)) || ix.U.has(k) || ix.C.has(k) || ix.T.has(k)) continue;
    spot = { x, y };
  }
  if (!spot) return 'No hay espacio libre junto a la ciudad';
  spend(c.st.m, S.CART.cost);
  const u = newUnit(g, p.id, spot.x, spot.y);
  u.name = 'Carreta de ' + c.name.slice(0, 10); u.cart = { c: c.id }; u.pts = 0; u.hp = S.CART.hp; u.mp = 0; u.at = 0; u.moved = true; u.acted = true;
  ev(g, `🛒 ${c.name} construye una carreta (almacén móvil de ${S.CART.cap} de capacidad).`, [p.id], 'city');
  return null;
}
/* ---------- mundo abierto fase 2: protección de novato, jefes mundiales y gremios ---------- */
const protLeft = (g, pid) => { if (g.cfg.mode !== 'mundo') return 0; const p = g.players[pid]; return p && p.prot > g.turn ? p.prot - g.turn : 0; };
const guildOf = (g, pid) => { const p = g.players[pid]; return p && p.gd && g.guilds ? g.guilds.find(x => x.id === p.gd) || null : null; };
function wbTick(g) { // cada cierto tiempo aparece un jefe gigante en las tierras salvajes: quien lo dañe se lleva recompensa
  const W = S.WORLD.wb; g.wb = g.wb || { next: g.turn + W.first };
  const cur = g.creatures.find(c => c.wb);
  if (cur) {
    if (g.turn >= cur.wbEnd) { removeCreature(g, cur); g.wb.next = g.turn + W.every; ev(g, `🌋 El jefe mundial ${S.CREATURES[cur.t].n} se retira a las profundidades. Volverá a aparecer en ${W.every} turnos.`, null, 'boss'); }
    return;
  }
  if (g.turn < g.wb.next || !g.players.some(p => p.alive)) return;
  const pos = freeLandTile(g, 10, 10, 2) || freeLandTile(g, 8, 8) || freeLandTile(g, 4, 4); if (!pos) return;
  const type = pick(g, S.BOSS_IDS()), lv = Math.max(1, Math.round(S.CREATURES[type].max * (0.8 + 0.2 * rng(g)))); // del 80% al 100% del nivel máximo de la criatura
  const c = spawnCreature(g, type, pos.x, pos.y, lv); c.wb = 1; c.wbEnd = g.turn + W.stay; c.hp = cstats(c, g).mhp; touch(g);
  g.wb.next = g.turn + W.every;
  ev(g, `🌋 ¡JEFE MUNDIAL! ${S.CREATURES[type].n} (nivel ${c.lv}, ${cstats(c, g).mhp} de vida) ha aparecido ${dirText(g, pos)} del mapa, en (${pos.x}, ${pos.y}). Todos los que le hagan daño reciben recompensa. Se retira en ${W.stay} turnos.`, null, 'boss');
  botAnyTalk(g, 'boss', { b: S.CREATURES[type].n }, 0.6);
}
function wbReward(g, c) { // al caer el jefe mundial, todos los que lo dañaron cobran en su ciudad (más cuanto más daño)
  const W = S.WORLD.wb, pt = c.pt || {}, ids = Object.keys(pt).map(Number).filter(id => g.players[id] && pt[id] > 0).sort((a, b) => pt[b] - pt[a]);
  const tot = ids.reduce((a, id) => a + pt[id], 0) || 1;
  ids.forEach((id, i) => {
    const city = g.cities.filter(x => x.owner === id).sort((a, b) => (b.cap ? 1 : 0) - (a.cap ? 1 : 0))[0], share = pt[id] / tot, mats = {};
    for (const m in W.reward) mats[m] = Math.max(1, Math.round(W.reward[m] * (1 + share)));
    const gk = rollGem(g, 0.9); mats[gk] = (mats[gk] || 0) + 1;
    const best = g.units.filter(u => u.o === id && !isAux(u) && !u.bs).sort((a, b) => b.lv - a.lv)[0]; if (best) gainXp(g, best, 40 + 4 * c.lv);
    if (city) { for (const m in mats) city.st.m[m] = (city.st.m[m] || 0) + mats[m]; if (i === 0) city.st.it.push(rareItem(g, { w: [0, 10, 30, 35, 25], t5: 0.4 })); }
    ev(g, `🌋 Recompensa del jefe mundial (${Math.round(share * 100)}% del daño): ${fmtMats(mats)}${i === 0 ? ' y un objeto raro' : ''}${city ? ' en ' + city.name : ' (no tienes ciudad donde recibirlo)'}.`, [id], 'loot');
  });
  g.wb = g.wb || {}; g.wb.next = g.turn + W.every;
  ev(g, `🌋 ¡El jefe mundial ${S.CREATURES[c.t].n} ha caído! ${ids.length} jugador${ids.length === 1 ? '' : 'es'} reciben recompensa${ids.length ? '; mayor daño: ' + g.players[ids[0]].name : ''}.`, null, 'boss');
}
function guildPact(g, a, b, on) { const key = pkey(a, b); if (on) { g.dip[key] = 'alianza'; delete g.brk[key]; g.props = g.props.filter(x => pkey(x.from, x.to) !== key); } else delete g.dip[key]; }
function guildSay(g, gd, text) { ev(g, text, gd.m.slice(), 'dip'); }
function leaveGuild(g, gd, p, kicked) {
  gd.m = gd.m.filter(x => x !== p.id); p.gd = null;
  for (const o of gd.m) guildPact(g, p.id, o, false);
  if (!gd.m.length) { g.guilds = g.guilds.filter(x => x !== gd); ev(g, `🏰 El gremio [${gd.tag}] ${gd.n} se disuelve.`, [p.id], 'dip'); return; }
  if (gd.lead === p.id) gd.lead = gd.m[0];
  guildSay(g, gd, `🏰 ${p.name} ${kicked ? 'es expulsado del' : 'deja el'} gremio [${gd.tag}].${gd.lead !== p.id && !kicked ? '' : ''}`);
  if (kicked) ev(g, `🏰 Te expulsaron del gremio [${gd.tag}] ${gd.n}.`, [p.id], 'dip');
}
function doGuild(g, p, m) {
  if (g.cfg.mode !== 'mundo') return 'Los gremios solo existen en el mundo abierto';
  g.guilds = g.guilds || [];
  const gd = guildOf(g, p.id), G = S.WORLD.guild, clean = (x, n) => String(x === undefined ? '' : x).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  switch (m.d) {
    case 'create': {
      if (gd) return 'Ya estás en un gremio';
      const n = clean(m.n, 16), tag = clean(m.t, 8).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4);
      if (n.length < 3) return 'El nombre debe tener al menos 3 letras';
      if (tag.length < 2) return 'La etiqueta debe tener de 2 a 4 letras o números';
      if (g.guilds.some(x => x.tag === tag || x.n.toLowerCase() === n.toLowerCase())) return 'Ya existe un gremio con ese nombre o etiqueta';
      const id = g.nid++; g.guilds.push({ id, n, tag, lead: p.id, m: [p.id], inv: [] }); p.gd = id; touch(g);
      ev(g, `🏰 Fundas el gremio [${tag}] ${n}. Invita a otros jugadores desde el menú 🌍: los miembros son aliados permanentes y comparten visión.`, [p.id], 'dip');
      return { msg: `Gremio [${tag}] ${n} fundado` };
    }
    case 'invite': {
      if (!gd) return 'No tienes gremio'; if (gd.lead !== p.id) return 'Solo el líder puede invitar';
      const to = g.players[m.to | 0]; if (!to || to === p || !to.alive || to.bot) return 'Jugador no válido';
      if (to.gd) return 'Ese jugador ya está en un gremio';
      if (gd.m.length >= G.max) return `El gremio está lleno (máx. ${G.max})`;
      if (!gd.inv.includes(to.id)) gd.inv.push(to.id);
      ev(g, `🏰 ${p.name} te invita al gremio [${gd.tag}] ${gd.n}. Acepta desde el menú 🌍.`, [to.id], 'dip', true);
      return { msg: 'Invitación enviada' };
    }
    case 'accept': {
      if (gd) return 'Ya estás en un gremio';
      const t = g.guilds.find(x => x.id === (m.id | 0)); if (!t || !t.inv.includes(p.id)) return 'Esa invitación ya no es válida';
      if (t.m.length >= G.max) return 'El gremio está lleno';
      for (const o of t.m) guildPact(g, p.id, o, true);
      t.m.push(p.id); t.inv = t.inv.filter(x => x !== p.id); p.gd = t.id; touch(g);
      guildSay(g, t, `🏰 ${p.name} se une al gremio [${t.tag}] ${t.n}.`);
      return { msg: `Ahora eres del gremio [${t.tag}] ${t.n}` };
    }
    case 'decline': { const t = g.guilds.find(x => x.id === (m.id | 0)); if (t) t.inv = t.inv.filter(x => x !== p.id); return { msg: 'Invitación rechazada' }; }
    case 'leave': { if (!gd) return 'No tienes gremio'; leaveGuild(g, gd, p, false); touch(g); return { msg: 'Has dejado el gremio' }; }
    case 'kick': {
      if (!gd || gd.lead !== p.id) return 'Solo el líder puede expulsar';
      const t = g.players[m.to | 0]; if (!t || t === p || !gd.m.includes(t.id)) return 'Ese jugador no es del gremio';
      leaveGuild(g, gd, t, true); touch(g); return { msg: `${t.name} expulsado` };
    }
  }
  return 'Acción de gremio desconocida';
}
/* ---------- asedios: muralla con vida, brechas, cercos y máquinas de asedio ---------- */
const siegeOn = g => g.cfg.siege === 'si';
const wallMax = c => { const L = (c.b && c.b.muralla) || 0; return L ? S.SIEGE.wall[L - 1] : 0; };
const wallHp = c => { const m = wallMax(c); return m ? (c.wh === undefined ? m : Math.max(0, Math.min(m, c.wh))) : 0; };
const wallUp = (g, c) => siegeOn(g) ? wallHp(c) > 0 : !!(c.b && c.b.muralla);
function freeSpotNear(g, x0, y0, rmax) {
  const ix = idx(g);
  for (let r = 1; r <= (rmax || 2); r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = x0 + dx, y = y0 + dy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inB(g, x, y)) continue;
    const k = y * g.map.w + x;
    if (!'gfhd'.includes(terrAt(g, x, y)) || ix.U.has(k) || ix.C.has(k) || ix.T.has(k)) continue;
    return { x, y };
  }
  return null;
}
function neutralLoot(g, u, c, p) { // capturar una aldea neutral por primera vez: una construcción al azar y un soldado de nivel 3
  if (g.cfg.mode === 'uno') return;
  c.b = c.b || {};
  const opts = S.BUILD_ORDER.filter(k => (k !== 'asedio' || siegeOn(g)) && !c.b[k]);
  let txt = '';
  if (opts.length) { const k = pick(g, opts); c.b[k] = 1; txt = `${S.BUILDINGS[k].e} ${S.BUILDINGS[k].n} (nivel 1)`; }
  let un = '';
  const spot = !isKing(g, u.o) && g.units.filter(x => x.o === u.o && !isAux(x)).length < BREED_MAX ? freeSpotNear(g, c.x, c.y, 2) : null;
  if (spot) { const nu = newUnit(g, u.o, spot.x, spot.y); nu.lv = 3; nu.pts = 3; nu.hp = eff(g, nu).maxHp; nu.moved = true; nu.acted = true; nu.mp = 0; nu.at = 0; un = `${nu.name} (nivel 3)`; }
  if (txt || un) ev(g, `🎁 Los aldeanos de ${c.name} te reciben con regalos${txt ? ': ' + txt : ''}${un ? (txt ? ' y ' : ': ') + 'un nuevo soldado, ' + un : ''}.`, [u.o], 'city');
  touch(g);
}
const hostileTo = (g, a, b) => a !== b && !pactOf(g, a, b) && !protLeft(g, a) && !protLeft(g, b);
function doSiegeUnit(g, p, c, k) {
  if (!siegeOn(g)) return 'Los asedios están desactivados en esta partida';
  if (g.cfg.mode === 'uno') return 'En el reto de una unidad no hay máquinas de asedio';
  if (isKing(g, p.id)) return 'El Rey Demonio solo recluta bestias';
  const D = S.SIEGE[k]; if (!D || !D.cost) return 'Máquina desconocida';
  if (!c.b || (c.b.asedio || 0) < D.lv) return `Necesitas el Taller de asedio nivel ${D.lv}`;
  if ((c.sg || 0) >= 1) return 'La ciudad está en cerco';
  if (g.units.filter(x => x.sg && x.sg.c === c.id).length >= S.SIEGE.maxPerCity) return `Esta ciudad ya tiene ${S.SIEGE.maxPerCity} máquinas de asedio`;
  if (!canAfford(c.st.m, D.cost)) return 'Faltan materiales en el almacén: ' + fmtMats(D.cost);
  const spot = freeSpotNear(g, c.x, c.y, 2); if (!spot) return 'No hay espacio libre junto a la ciudad';
  spend(c.st.m, D.cost);
  const u = newUnit(g, p.id, spot.x, spot.y);
  u.name = D.n + ' de ' + c.name.slice(0, 10); u.sg = { k, c: c.id }; u.pts = 0; u.hp = D.hp; u.mp = 0; u.at = 0; u.moved = true; u.acted = true;
  ev(g, `${D.e} ${c.name} construye ${k === 'ram' ? 'un' : 'una'} ${D.n.toLowerCase()}.`, [p.id], 'city');
  return null;
}
function doSiegeWall(g, u, cid) {
  if (!u.sg) return 'Solo las máquinas de asedio rompen murallas';
  if (!siegeOn(g)) return 'Los asedios están desactivados en esta partida';
  const c = g.cities.find(x => x.id === cid); if (!c || c.owner === null || c.owner === u.o) return 'Objetivo no válido';
  if (pactOf(g, u.o, c.owner)) return `Tienes un pacto con ${g.players[c.owner].name}`;
  if (protLeft(g, c.owner)) return `${g.players[c.owner].name} está bajo protección de novato`;
  if (protLeft(g, u.o)) return 'Estás bajo protección de novato: no puedes atacar a jugadores';
  if (!c.b || !c.b.muralla) return 'Esa ciudad no tiene muralla: entra directamente';
  if (wallHp(c) <= 0) return 'La muralla ya está rota: ¡entra!';
  if (u.at <= 0) return 'Esta máquina ya no tiene ataques este turno';
  const D = S.SIEGE[u.sg.k], inR = d => d - 1 >= D.min && d - 1 <= D.range;
  if (!inR(cheb(u, c))) {
    const r = S.reach(envFor(g, u), u.x, u.y, u.mp); let best = null;
    for (const [k, v] of r) { if (!v.end) continue; const x = k % g.map.w, y = (k - x) / g.map.w; if (inR(cheb({ x, y }, c)) && (!best || v.c < best.c)) best = { x, y, c: v.c }; }
    if (!best) return 'Colócate más cerca (ariete: pegado a la muralla; catapulta: a 3–4 casillas del centro)';
    const err = doMove(g, u, best.x, best.y); if (err) return err;
  }
  const was = wallHp(c), now = Math.max(0, was - D.wall);
  c.wh = now; u.at--; u.mp = 0; u.acted = true; touch(g);
  const pw = g.players[c.owner]; if (pw.wr) pw.wr[u.o] = g.turn; botNote(g, pw, u.o, 'gr', now <= 0 ? 3 : 1);
  if (now <= 0) { ev(g, `💥 ¡${g.players[u.o].name} abre una brecha en la muralla de ${c.name}!`, null, 'city'); return { msg: `¡Brecha en la muralla de ${c.name}! Ya se puede entrar.` }; }
  ev(g, `🧱 ${g.players[u.o].name} golpea la muralla de ${c.name} (−${D.wall}, quedan ${now}/${wallMax(c)}).`, [c.owner], 'phit');
  return { msg: `${u.name} golpea la muralla (−${D.wall}). Quedan ${now}/${wallMax(c)}.` };
}
function doRepair(g, p, c) {
  if (!siegeOn(g)) return 'Los asedios están desactivados en esta partida';
  const m = wallMax(c); if (!m) return 'Esta ciudad no tiene muralla';
  if (wallHp(c) >= m) return 'La muralla está entera';
  if (c.rep === g.turn) return 'Ya reparaste la muralla este turno';
  const L = c.b.muralla, cost = {}; for (const k in S.SIEGE.repair) cost[k] = S.SIEGE.repair[k] * L;
  if (!canAfford(c.st.m, cost)) return 'Faltan materiales en el almacén: ' + fmtMats(cost);
  spend(c.st.m, cost); c.wh = Math.min(m, wallHp(c) + Math.ceil(m / 2)); c.rep = g.turn; if (c.wh >= m) delete c.wh; touch(g);
  return null;
}
function siegeTick(g) {
  if (!siegeOn(g)) return;
  for (const c of g.cities) {
    if (c.owner === null) continue;
    const own = g.players[c.owner]; if (!own) continue;
    const foes = g.units.filter(v => v.o !== c.owner && !v.cart && !v.dg && hostileTo(g, c.owner, v.o) && cheb(v, c) <= S.SIEGE.besiege.dist);
    const was = c.sg || 0;
    if (foes.length >= S.SIEGE.besiege.min) {
      const fed = g.units.some(v => v.cart && v.o === c.owner && cheb(v, c) <= 2);
      if (!fed) c.sg = was + 1; else c.sg = Math.max(1, was);
      if (!was) ev(g, `🔒 ${c.name} está en cerco: no produce ni recluta mientras la rodeen.`, [c.owner], 'city');
    } else if (was) { c.sg = was - 1 || 0; if (!c.sg) delete c.sg; }
    if ((c.sg || 0) >= S.SIEGE.hunger) {
      let n = 0;
      for (const v of g.units) if (v.o === c.owner && !v.cart && cheb(v, c) <= 1) { const m = eff(g, v).maxHp, d = Math.max(1, Math.round(m * S.SIEGE.hungerHp)); if (v.hp > 1) { v.hp = Math.max(1, v.hp - d); n++; } }
      if (n) ev(g, `🍞 Hambre en ${c.name}: las unidades dentro pierden fuerzas (${c.sg} turnos de cerco). Una carreta cerca lo evita.`, [c.owner], 'city');
    }
    const m = wallMax(c);
    if (m && c.wh !== undefined && c.wh > 0 && c.wh < m && !c.sg) { c.wh = Math.min(m, c.wh + Math.ceil(m * S.SIEGE.regen)); if (c.wh >= m) delete c.wh; }
    const L = (c.b && c.b.atalaya) || 0;
    if (L) { // las atalayas disparan a las máquinas de asedio cercanas (y a cualquier enemigo si la ciudad está en cerco)
      const R = S.SIEGE.towerRange + L, tg = g.units.filter(v => hostileTo(g, c.owner, v.o) && v.o !== c.owner && cheb(v, c) <= R && !v.dg && (v.sg || c.sg)).sort((a, b) => (b.sg ? 1 : 0) - (a.sg ? 1 : 0) || cheb(a, c) - cheb(b, c))[0];
      if (tg) {
        const d = calcDamage(S.SIEGE.tower * L, eff(g, tg).def, 0); tg.hp -= d; touch(g);
        ev(g, `🔭 Las atalayas de ${c.name} disparan a ${tg.name} (−${d}).`, [tg.o, c.owner], 'phit');
        if (tg.hp <= 0) killUnit(g, tg, { city: c });
      }
    }
  }
}
function siegeInfo(g, c) { // datos públicos de la muralla y del cerco de una ciudad para el cliente
  if (!siegeOn(g)) return {};
  const m = wallMax(c); return m ? { wm: m, wh: wallHp(c), sg: c.sg || 0 } : { sg: c.sg || 0 };
}
/* ---------- taller del constructor: carreteras y estaciones de suministros ---------- */
const builderOf = (g, c) => g.units.find(u => u.bld && u.bld.c === c.id);
function doBuilder(g, p, c) {
  if (g.cfg.mode === 'uno') return 'En el reto de una unidad no hay constructores';
  if (!c.b || !c.b.taller) return 'Construye primero el Taller del constructor';
  if (builderOf(g, c)) return 'Esta ciudad ya tiene su constructor';
  if (!canAfford(c.st.m, S.BUILDER.cost)) return 'Faltan materiales en el almacén: ' + fmtMats(S.BUILDER.cost);
  const ix = idx(g); let spot = null;
  for (let r = 1; r <= 2 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
    const x = c.x + dx, y = c.y + dy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inB(g, x, y)) continue;
    const k = y * g.map.w + x;
    if (!'gfhd'.includes(terrAt(g, x, y)) || ix.U.has(k) || ix.C.has(k) || ix.T.has(k)) continue;
    spot = { x, y };
  }
  if (!spot) return 'No hay espacio libre junto a la ciudad';
  spend(c.st.m, S.BUILDER.cost);
  const u = newUnit(g, p.id, spot.x, spot.y);
  u.name = 'Constructor de ' + c.name.slice(0, 10); u.bld = { c: c.id }; u.pts = 0; u.hp = S.BUILDER.hp; u.mp = 0; u.at = 0; u.moved = true; u.acted = true;
  ev(g, `👷 ${c.name} contrata a un constructor: traza carreteras${c.b.taller >= 2 ? ' y estaciones de suministros' : ''}.`, [p.id], 'city');
  return null;
}
const stationNear = (g, c) => { // ¿hay una estación de suministros a 2 casillas o menos de la ciudad?
  if (!g.rd) return false; const w = g.map.w, N = S.BUILDER.near;
  for (let dy = -N - 1; dy <= N + 1; dy++) for (let dx = -N - 1; dx <= N + 1; dx++) { const x = c.x + dx, y = c.y + dy; if (inB(g, x, y) && g.rd[y * w + x] === 2) return true; }
  return false;
};
function unlinkCity(g, c) { // la ciudad deja de compartir inventario (si era la última, se queda con el inventario común)
  if (!c.nl) return;
  const o = c.nl - 1, net = g.nets && g.nets[o], rest = g.cities.filter(x => x !== c && x.nl === c.nl && x.owner === o).length;
  delete c.st; c.st = (rest || c.owner !== o) ? { m: {}, it: [] } : (net || { m: {}, it: [] });
  if (!rest && g.nets) delete g.nets[o];
  delete c.nl;
}
function relinkStores(g) { // las ciudades de un mismo dueño con estación de suministros comparten un único inventario
  g.nets = g.nets || {}; g.rd = g.rd || {};
  const want = {};
  for (const c of g.cities) if (c.owner !== null && stationNear(g, c)) (want[c.owner] = want[c.owner] || []).push(c);
  for (const c of g.cities) if (c.nl && !(want[c.nl - 1] && want[c.nl - 1].length >= 2 && c.owner === c.nl - 1)) unlinkCity(g, c);
  for (const o in want) {
    const L = want[o]; if (L.length < 2) continue;
    const net = g.nets[o] = g.nets[o] || { m: {}, it: [] };
    for (const c of L) {
      const d = Object.getOwnPropertyDescriptor(c, 'st');
      if (d && d.get) continue;
      if (c.nl !== +o + 1) { const own = c.st; if (own) { for (const m in own.m) net.m[m] = (net.m[m] || 0) + own.m[m]; for (const it of own.it) net.it.push(it); } }
      delete c.st; c.nl = +o + 1;
      Object.defineProperty(c, 'st', { get() { return g.nets[o]; }, configurable: true, enumerable: false });
    }
  }
}
function doRoad(g, p, u) {
  const c = g.cities.find(x => x.id === u.bld.c); if (!c || c.owner !== p.id || !c.b || !c.b.taller) return 'El taller de este constructor ya no es tuyo';
  if (u.bt === g.turn) return 'Ya construiste algo este turno';
  if (u.dg) return 'No se construye en mazmorras';
  const k = u.y * g.map.w + u.x, ix = idx(g);
  if (!'gfhd'.includes(terrAt(g, u.x, u.y)) || ix.T.has(k)) return 'Aquí no se puede trazar una carretera';
  g.rd = g.rd || {}; if (g.rd[k]) return 'Aquí ya hay una carretera';
  if (!canAfford(c.st.m, S.BUILDER.road)) return 'Faltan materiales en ' + c.name + ': ' + fmtMats(S.BUILDER.road);
  spend(c.st.m, S.BUILDER.road); g.rd[k] = 1; u.bt = g.turn; touch(g);
  return null;
}
function doStation(g, p, u) {
  const c = g.cities.find(x => x.id === u.bld.c); if (!c || c.owner !== p.id || !c.b || !c.b.taller) return 'El taller de este constructor ya no es tuyo';
  if (c.b.taller < 2) return 'Necesitas el Taller del constructor nivel 2';
  if (u.bt === g.turn) return 'Ya construiste algo este turno';
  const k = u.y * g.map.w + u.x;
  if (!g.rd || g.rd[k] !== 1) return 'La estación se levanta sobre una carretera: traza una primero';
  const near = g.cities.filter(x => x.owner === p.id && cheb(x, u) <= S.BUILDER.near + 1).sort((a, b) => cheb(a, u) - cheb(b, u))[0];
  if (!near) return 'La estación debe estar a ' + S.BUILDER.near + ' casillas o menos de una ciudad tuya';
  if (!canAfford(c.st.m, S.BUILDER.station)) return 'Faltan materiales en ' + c.name + ': ' + fmtMats(S.BUILDER.station);
  spend(c.st.m, S.BUILDER.station); g.rd[k] = 2; u.bt = g.turn; touch(g);
  const before = g.cities.filter(x => x.nl).length; relinkStores(g);
  const linked = g.cities.filter(x => x.owner === p.id && x.nl).length;
  ev(g, `📦 Estación de suministros junto a ${near.name}.` + (linked >= 2 ? ` ${linked} ciudades comparten ahora el inventario.` : ' Levanta otra junto a una segunda ciudad para unir sus inventarios.'), [p.id], 'city');
  return null;
}
function doRecruit(g, p, c, kind) {
  if (siegeOn(g) && (c.sg || 0) >= 1) return 'La ciudad está en cerco: no se puede reclutar';
  if (g.cfg.mode === 'mundo') return 'En el mundo abierto no se recluta: las unidades nuevas nacen por reproducción (junto a una ciudad tuya)';
  if (g.cfg.mode === 'uno') return 'En el reto de una unidad no se puede reclutar';
  if (isKing(g, p.id)) { // el Rey Demonio solo recluta bestias
    if (kind && !S.KING.beasts[kind]) return 'Esa bestia no existe';
    if (!kind) { const aff = Object.keys(S.KING.beasts).filter(k => canAfford(c.st.m, beastCost(g, c, k))); kind = aff.sort((a, b) => S.CREATURES[b].hp * S.CREATURES[b].dmg - S.CREATURES[a].hp * S.CREATURES[a].dmg)[0] || 'lobo'; }
    const nb = g.units.filter(u => u.o === p.id && !isAux(u)).length;
    if (nb >= MAX_UNITS) return `Máximo ${MAX_UNITS} unidades`;
    const bc = beastCost(g, c, kind);
    if (!canAfford(c.st.m, bc)) return 'Faltan materiales en el almacén: ' + fmtMats(bc);
    const ix0 = idx(g); let sp = null;
    for (let r = 1; r <= 2 && !sp; r++) for (let dy = -r; dy <= r && !sp; dy++) for (let dx = -r; dx <= r && !sp; dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inB(g, x, y)) continue;
      const k2 = y * g.map.w + x;
      if (!'gfhd'.includes(terrAt(g, x, y)) || ix0.U.has(k2) || ix0.C.has(k2)) continue;
      if (ix0.T.has(k2) && !(x === c.x && y === c.y)) continue;
      sp = { x, y };
    }
    if (!sp) return 'No hay espacio libre alrededor de la ciudad';
    spend(c.st.m, bc);
    const b = newBeast(g, p.id, sp.x, sp.y, kind);
    if (c.b && c.b.cuartel >= 2) { b.lv = 2; b.pts = 2; }
    b.hp = eff(g, b).maxHp; b.mp = 0; b.at = 0;
    return null;
  }
  const n = g.units.filter(u => u.o === p.id && !isAux(u)).length;
  if (n >= MAX_UNITS) return `Máximo ${MAX_UNITS} unidades`;
  const cost = recruitCost(g, p.id, c);
  if (!canAfford(c.st.m, cost)) return 'Faltan materiales en el almacén: ' + fmtMats(cost);
  const w = g.map.w, ix = idx(g);
  let spot = null;
  for (let r = 1; r <= 2 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
    const x = c.x + dx, y = c.y + dy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inB(g, x, y)) continue;
    const k = y * w + x;
    if (!'gfhd'.includes(terrAt(g, x, y)) || ix.U.has(k) || ix.C.has(k)) continue;
    if (ix.T.has(k) && !(x === c.x && y === c.y)) continue;
    spot = { x, y };
  }
  if (!spot) return 'No hay espacio libre alrededor de la ciudad';
  spend(c.st.m, cost);
  const u = newUnit(g, p.id, spot.x, spot.y);
  if (c.b && c.b.cuartel >= 2) { u.lv = 2; u.pts = 2; }
  u.mp = 0; u.at = 0; // llega cansada
  return null;
}
function doCraft(g, p, c, kind, tier) {
  if (!K[kind] || !(tier >= 1 && tier <= S.MAX_TIER)) return 'Receta inválida';
  if (c.crafts >= cityCrafts(c)) return 'Esta ciudad ya forjó el máximo este turno';
  const cost = S.recipe(kind, tier);
  if (!canAfford(c.st.m, cost)) return 'Faltan materiales: ' + fmtMats(cost);
  spend(c.st.m, cost);
  const it = { id: g.nid++, k: kind, t: tier };
  c.st.it.push(it); c.crafts++;
  return it;
}

function doUpgrade(g, c, itemId) {
  const it = c.st.it.find(x => x.id === itemId);
  if (!it) return 'Ese objeto no está en el almacén';
  if (it.t >= S.MAX_TIER) return 'Ya es de la mejor calidad';
  if (c.crafts >= cityCrafts(c)) return 'Esta ciudad ya trabajó el máximo este turno';
  const cost = S.upgradeCost(it.k, it.t + 1);
  if (!canAfford(c.st.m, cost)) return 'Faltan materiales: ' + fmtMats(cost);
  spend(c.st.m, cost);
  it.t++; c.crafts++;
  return it;
}
function doEnchant(g, c, itemId, fxKey) {
  const it = c.st.it.find(x => x.id === itemId);
  if (!it) return 'Ese objeto no está en el almacén';
  it.fx = it.fx || [];
  if (it.fx.length >= S.MAX_FX) return 'Ya es Mítico: tiene cinco efectos';
  const step = S.ENCHANT_STEPS[it.fx.length];
  if (it.t < step.tier) return `El efecto nº ${it.fx.length + 1} (${S.RARITY[it.fx.length + 1].n}) exige calidad ${S.tierName(it.k, step.tier)} o superior`;
  if (c.crafts >= cityCrafts(c)) return 'Esta ciudad ya trabajó el máximo este turno';
  const pool = (K[it.k].slot === 'arma' ? S.WEAPON_FX : S.ARMOR_FX).filter(f => !it.fx.includes(f));
  if (fxKey && !pool.includes(fxKey)) return 'Ese efecto no sirve para este objeto';
  if (!canAfford(c.st.m, step.cost)) return 'Faltan materiales: ' + fmtMats(step.cost);
  spend(c.st.m, step.cost);
  it.fx.push(fxKey || pick(g, pool));
  it.r = it.fx.length; c.crafts++;
  return it;
}
function doSocket(g, c, itemId) { // perfora un engarce nuevo
  const it = c.st.it.find(x => x.id === itemId);
  if (!it) return 'Ese objeto no está en el almacén';
  const n = it.so || 0;
  if (n >= S.MAX_SOCKETS) return 'Ya tiene el máximo de engarces (' + S.MAX_SOCKETS + ')';
  const st = S.SOCKET_STEPS[n];
  if (it.t < st.tier) return `El engarce nº ${n + 1} exige calidad ${S.tierName(it.k, st.tier)} o superior`;
  if (c.crafts >= cityCrafts(c)) return 'Esta ciudad ya trabajó el máximo este turno';
  if (!canAfford(c.st.m, st.cost)) return 'Faltan materiales: ' + fmtMats(st.cost);
  spend(c.st.m, st.cost);
  it.so = n + 1; it.gm = it.gm || []; c.crafts++;
  return it;
}
function doGem(g, c, itemId, key, x) { // engasta una gema del almacén; si no hay engarce libre, x elige cuál sustituir (la gema vieja se pierde)
  const it = c.st.it.find(y => y.id === itemId);
  if (!it) return 'Ese objeto no está en el almacén';
  if (!S.gemOf(key)) return 'Gema inválida';
  if (!(c.st.m[key] > 0)) return 'No tienes esa gema en el almacén';
  if (!it.so) return 'Ese objeto no tiene engarces';
  it.gm = it.gm || [];
  let slot = -1;
  for (let i = 0; i < it.so; i++) if (!it.gm[i]) { slot = i; break; }
  if (x !== undefined && x !== null && x >= 0 && x < it.so) slot = x; // sustituir elegida
  if (slot < 0) return 'No quedan engarces libres: elige una gema para sustituir';
  if (c.crafts >= cityCrafts(c)) return 'Esta ciudad ya trabajó el máximo este turno';
  spend(c.st.m, { [key]: 1 });
  it.gm[slot] = key; c.crafts++;
  return it;
}
function doGemUp(g, c, key) { // 3 gemas iguales → 1 de la calidad siguiente
  const m = S.gemOf(key);
  if (!m) return 'Gema inválida';
  if (m.lv >= 3) return 'Esa gema ya es perfecta';
  if ((c.st.m[key] || 0) < S.GEM_UP) return `Hacen falta ${S.GEM_UP} gemas iguales`;
  spend(c.st.m, { [key]: S.GEM_UP });
  const nk = m.gem + (m.lv + 1); c.st.m[nk] = (c.st.m[nk] || 0) + 1;
  return nk;
}
function doReforge(g, c, itemId, x) { // cambia el efecto número x por otro al azar
  const it = c.st.it.find(y => y.id === itemId);
  if (!it) return 'Ese objeto no está en el almacén';
  if (!it.fx || !it.fx.length) return 'Ese objeto no tiene efectos que reforjar';
  if (!(x >= 0 && x < it.fx.length)) return 'Efecto inválido';
  if (c.crafts >= cityCrafts(c)) return 'Esta ciudad ya trabajó el máximo este turno';
  const pool = (K[it.k].slot === 'arma' ? S.WEAPON_FX : S.ARMOR_FX).filter(f => !it.fx.includes(f));
  if (!pool.length) return 'No hay otros efectos disponibles';
  if (!canAfford(c.st.m, S.REFORGE_COST)) return 'Faltan materiales: ' + fmtMats(S.REFORGE_COST);
  spend(c.st.m, S.REFORGE_COST);
  it.fx[x] = pick(g, pool); c.crafts++;
  return it;
}

/* ---------- movimiento y combate ---------- */
function envFor(g, u) {
  const ix = idx(g), w = g.map.w, t = g.map.t;
  return {
    w, h: g.map.h,
    terr: (x, y) => t.charAt(y * w + x),
    road: (x, y) => !!(g.rd && g.rd[y * w + x]),
    occ: (x, y) => {
      const k = y * w + x;
      if (ix.C.has(k)) return 2;
      const ct = ix.T.get(k);
      if (ct && ct.owner !== null && ct.owner !== u.o && pactOf(g, u.o, ct.owner)) return 2; // ciudades de pactos: no se pisan
      if (ct && ct.owner !== null && ct.owner !== u.o && protLeft(g, ct.owner)) return 2; // ciudades de jugadores nuevos: no se pisan
      if (ct && ct.owner !== null && ct.owner !== u.o && siegeOn(g) && wallHp(ct) > 0) return 2; // con asedios, no se entra a una ciudad con la muralla en pie
      const o = ix.U.get(k);
      if (!o) return 0;
      if (o.o === u.o) return 1;
      return pactOf(g, u.o, o.o) === 'alianza' ? 1 : 2;
    },
    stop: (x, y) => { const c = ix.T.get(y * w + x); return !!c && c.owner !== u.o; },
  };
}
function capture(g, u, c) {
  const prev = c.owner;
  unlinkCity(g, c);
  if (prev !== null) {
    for (const m in c.st.m) c.st.m[m] = Math.floor(c.st.m[m] / 2);
    c.st.it = c.st.it.filter(() => rng(g) < 0.5);
  }
  const first = prev === null && !c.lt; // primera captura de una ciudad neutral: botín
  c.owner = u.o; delete c.wh; delete c.sg;
  relinkStores(g);
  u.mp = 0;
  const p = g.players[u.o];
  ev(g, `🏰 ${p.name} conquista ${c.name}.`, null, 'city');
  if (first) { c.lt = 1; neutralLoot(g, u, c, p); }
  if (prev !== null) { const pp = g.players[prev]; if (pp.wr) pp.wr[u.o] = g.turn; botNote(g, pp, u.o, 'gr', 3); botReact(g, 'city_lose', pp, { c: c.name, n: p.name }, 0.7); }
  botReact(g, 'city_win', p, { c: c.name }, 0.7);
}
function doMove(g, u, x, y) {
  if (x === u.x && y === u.y) return 'Ya estás ahí';
  if (!inB(g, x, y)) return 'Fuera del mapa';
  const r = S.reach(envFor(g, u), u.x, u.y, u.mp);
  const e = r.get(y * g.map.w + x);
  if (!e || !e.end) return 'No puedes llegar ahí este turno';
  u.mp -= e.c; u.x = x; u.y = y; u.moved = true; touch(g);
  const c = idx(g).T.get(y * g.map.w + x);
  if (c && c.owner !== u.o) capture(g, u, c);
  const st = g.sites.find(q => q.x === x && q.y === y);
  if (st) { if (st.k === 'trampa') { if (!st.used) springTrap(g, u, st); } else if (st.k === 'tumba') takeTomb(g, u, st); else collectSite(g, u, st); }
  return null;
}
function rollDrops(g, c) {
  const d = S.CREATURES[c.t], out = {};
  const mul = (1 + 0.25 * (c.lv - 1)) * (S.seasonIdx(g.turn) === 2 ? 1.25 : 1) * (c.el ? 2 : 1) * (g.cfg.mode === 'mundo' ? S.WORLD.regions[regionIdx(g, c.x, c.y)].loot : 1);
  for (const m in d.drops) {
    const lo = d.drops[m][0], hi = d.drops[m][1];
    const n = Math.round(ri(g, lo, hi) * mul);
    if (n > 0) out[m] = n;
  }
  if (d.boss && !d.drops.escama && rng(g) < 0.35) out.escama = 1;
  if (d.soul && rng(g) < d.soul * c.lv * (c.el ? 1.5 : 1)) out.alma = (out.alma || 0) + 1;
  return out;
}
function removeCreature(g, c) {
  g.creatures.splice(g.creatures.indexOf(c), 1); touch(g);
  for (const o of g.creatures) if (o.prov === c.id) o.prov = null;
}
function killCreature(g, c, u) {
  const d = S.CREATURES[c.t], p = g.players[u.o];
  removeCreature(g, c);
  if (c.min) { p.stats.kills++; gainXp(g, u, 4 + 2 * c.lv); return; } // secuaces de jefe: solo experiencia
  if (d.boss || c.bd) for (const m of g.creatures.filter(x => x.bo === c.id)) removeCreature(g, m);
  if (c.dg) dgOnKill(g, c, u);
  p.stats.kills++; if (d.boss) { p.stats.boss++; if (g.story) g.story.killed[c.t] = true; }
  const gemsDrop = {};
  { // gemas: los jefes y élites casi siempre; las demás criaturas, de vez en cuando (se guardan antes que los materiales)
    const pg = d.boss ? 1 : c.el ? 0.6 : Math.min(0.22, 0.05 + 0.008 * c.lv);
    const n = d.boss ? 2 : 1;
    for (let i = 0; i < n; i++) if (rng(g) < (i ? 0.5 : pg)) { const gk = rollGem(g, d.boss ? 0.8 : c.el ? 0.5 : Math.min(1, c.lv / 25)); gemsDrop[gk] = (gemsDrop[gk] || 0) + 1; }
  }
  const drops = rollDrops(g, c);
  let rare = null; const dropped = {};
  if (d.boss || c.el) {
    rare = rareItem(g, { w: d.boss ? [15, 30, 30, 18, 7] : [45, 35, 15, 4, 1], t5: c.t === 'dragon' ? 3 : d.boss ? 0.4 : 0 });
    if (!putItem(u, rare, dropped)) rare = { lost: true }; else rare = { ok: rare }; // el objeto raro va primero
  }
  const gemLost = addMats(u, gemsDrop, dropped);
  const lost = addMats(u, drops, dropped);
  gainXp(g, u, (d.xp + 3 * c.lv) * (c.el ? 2 : 1));
  const got = {}; for (const m in drops) { const n = drops[m] - (lost[m] || 0); if (n > 0) got[m] = n; }
  let msg = `${u.name} derrota a ${c.el ? c.el + ' (' + d.n + ')' : d.n} (niv. ${c.lv}).` + (Object.keys(got).length ? ' Botín: ' + fmtMats(got) + '.' : '');
  if (Object.keys(lost).length) msg += ` ⚠️ Mochila llena, se perdió: ${fmtMats(lost)}.`;
  if (Object.keys(dropped).length) msg += ` 🗑️ Para hacer sitio se descartó: ${fmtMats(dropped)}.`;
  if (rare) msg += rare.ok ? ` 🎁 Objeto raro: ${S.itemName(rare.ok)}.` : ' ⚠️ Mochila llena: se perdió un objeto raro.';
  for (const gk in gemsDrop) { const k2 = gemsDrop[gk] - (gemLost[gk] || 0); if (k2 > 0) msg += ` 💎 ${k2} ${S.MATS[gk].n.toLowerCase()}.`; else msg += ' ⚠️ Mochila llena: se perdió una gema.'; }
  ev(g, msg, [u.o], 'loot');
  if (d.boss) { ev(g, `🏆 ${p.name} ha derrotado al jefe ${d.n}.`, null, 'boss'); botAnyTalk(g, 'boss_kill', { n: p.name, b: d.n }, 0.5); }
  if (c.el) ev(g, `⭐ ${p.name} abate a la criatura élite ${c.el}.`, null, 'boss');
  if (c.wb) wbReward(g, c);
}
function killUnit(g, u, by) { // by: {unit} o {creature}
  g.units.splice(g.units.indexOf(u), 1); touch(g);
  if (!u.sm) { const mine = g.units.filter(x => x.sm && x.sm.by === u.id); if (mine.length) { g.units = g.units.filter(x => !(x.sm && x.sm.by === u.id)); ev(g, `🌫️ Las invocaciones de ${u.name} se desvanecen.`, [u.o], 'summon'); } }
  const p = g.players[u.o];
  if (u.hero && !u.sm && g.cfg.hero !== 'no') { // el protagonista reaparece en la capital
    g.rv = g.rv || [];
    g.rv.push({ o: u.o, name: u.name, bs: u.bs || null, emb: u.hero, lv: u.lv, pts: u.pts, sk: Object.assign({}, u.sk), cls: u.cls || null, sub: u.sub || null, bn: u.bn || null, gen: u.gen || 0, keep: by.unit ? null : { eq: u.eq, inv: u.inv }, due: g.turn + S.HERO.wait }); // si lo mata una criatura conserva su equipo
    ev(g, `${u.hero} ¡Tu protagonista ${u.name} ha caído! Volverá a tu ciudad en ${S.HERO.wait} turnos, ${S.HERO.loss} niveles más débil.`, [u.o], 'dead');
  }
  if (by.unit && by.unit.o !== u.o) { botReact(g, 'kill_win', g.players[by.unit.o], { n: g.players[u.o].name }, 0.35); botReact(g, 'kill_lose', g.players[u.o], { n: g.players[by.unit.o].name }, 0.3); }
  if (by.unit) {
    const k = by.unit, kp = g.players[k.o];
    kp.stats.pk++;
    addMats(k, u.inv.m);
    for (const it of u.inv.it) if (invW(k) + 2 <= capOf(k)) k.inv.it.push(it);
    for (const s in u.eq) if (rng(g) < 0.5 && invW(k) + 2 <= capOf(k)) k.inv.it.push(u.eq[s]);
    gainXp(g, k, 12 + 3 * u.lv);
    ev(g, `💀 ${kp.name} abate a ${u.name} de ${p.name}.`, null, 'pvp');
  } else if (by.city) {
    ev(g, `💀 ${u.name} cae bajo el fuego de las atalayas de ${by.city.name}.`, [u.o], 'dead');
  } else {
    ev(g, `💀 ${u.name} ha caído ante ${S.CREATURES[by.creature.t].n}.`, [u.o], 'dead');
  }
  if (!u.sm && !u.cart && !u.bld && !u.sg && !u.bs && !u.hero && g.cfg.mode !== 'uno') { // lápida: se puede resucitar en una ciudad; si cayó ante una criatura deja su equipo en una tumba
    g.graves = g.graves || [];
    g.graves.push({ id: g.nid++, o: u.o, name: u.name, lv: u.lv, pts: u.pts, sk: Object.assign({}, u.sk), cls: u.cls || null, sub: u.sub || null, bn: u.bn || null, gen: u.gen || 0, turn: g.turn });
    const mine = g.graves.filter(x => x.o === u.o); if (mine.length > 8) g.graves.splice(g.graves.indexOf(mine[0]), 1);
    if (!by.unit) dropTomb(g, u);
    if (!by.unit || by.unit.o === u.o) ev(g, `🪦 Puedes resucitar a ${u.name} en una ciudad tuya (cuesta ${fmtMats(reviveCost({ lv: u.lv }))}).`, [u.o], 'dead');
  }
}
function doAttack(g, u, tt, tid) {
  if (u.cart) return 'La carreta no puede atacar';
  const tgt = tt === 'c' ? g.creatures.find(c => c.id === tid) : g.units.find(x => x.id === tid && x.o !== u.o);
  if (!tgt) return 'Objetivo no válido';
  if (tt === 'u') {
    const pk = pactOf(g, u.o, tgt.o);
    if (pk) return `Tienes ${pk === 'paz' ? 'paz' : 'una alianza'} con ${g.players[tgt.o].name}`;
    if (protLeft(g, tgt.o)) return `${g.players[tgt.o].name} está bajo protección de novato (${protLeft(g, tgt.o)} turnos)`;
    if (protLeft(g, u.o)) return 'Estás bajo protección de novato: no puedes atacar a jugadores (puedes terminarla antes desde el menú 🌍)';
  }
  if (u.at <= 0) return 'Esta unidad ya no tiene ataques este turno';
  const e = eff(g, u);
  let dist = cheb(u, tgt);
  if (dist < e.min || dist > e.range) {
    const w = g.map.w;
    const r = S.reach(envFor(g, u), u.x, u.y, u.mp);
    let best = null;
    for (const [k, v] of r) {
      if (!v.end) continue;
      const x = k % w, y = (k - x) / w, d = cheb({ x, y }, tgt);
      if (d >= e.min && d <= e.range && (!best || v.c < best.c || (v.c === best.c && d > best.d))) best = { x, y, c: v.c, d };
    }
    if (!best) return dist < e.min ? 'Demasiado cerca para esta arma' : 'Fuera de alcance';
    const err = doMove(g, u, best.x, best.y);
    if (err) return err;
    dist = cheb(u, tgt);
  }
  const factor = u.hits === 0 ? 1 : 0.6;
  let raw = e.dmg * factor;
  if (e.range > 1 && !e.reach && dist === 1) raw *= 0.6;
  let defv, te = null;
  if (tt === 'c') defv = cstats(tgt, g).def + terrDef(g, tgt.x, tgt.y);
  else { te = eff(g, tgt); defv = te.def + terrDef(g, tgt.x, tgt.y) + guardPvp(g, tgt); }
  if (tt === 'c') raw *= 1 + guardHAtk(g, u, tgt); // defender la ciudad de una horda da ataque
  const mo = e.mods || {};
  if (u.hits === 0 && mo.first) raw *= 1 + mo.first;
  if (tt === 'c' && mo.vsCre) raw *= 1 + mo.vsCre;
  if (mo.execute && tgt.hp < (tt === 'c' ? cstats(tgt, g).mhp : te.maxHp) * 0.5) raw *= 1 + mo.execute;
  const wk = e.kind ? K[e.kind] : null;
  if (wk && wk.exe && tgt.hp < (tt === 'c' ? cstats(tgt, g).mhp : te.maxHp) * 0.5) raw *= 1 + wk.exe;
  let crit = false;
  const wxa = wxNow(g);
  if (e.fx.critico && !(wxa && !wxa.crit) && rng(g) < e.fx.critico) { raw *= 1.8; crit = true; }
  let dmg = calcDamage(raw, defv, e.pierce), blocked = false;
  if (te && te.fx.bloqueo && rng(g) < te.fx.bloqueo) { dmg = Math.max(1, Math.round(dmg / 2)); blocked = true; }
  tgt.hp -= dmg; tgt.hit = true;
  if (tt === 'c' && tgt.wb) { tgt.pt = tgt.pt || {}; tgt.pt[u.o] = (tgt.pt[u.o] || 0) + dmg; }
  u.at--; u.hits++; u.mp = 0; u.acted = true;
  gainXp(g, u, 1);
  let msg = `${u.name} golpea a ${tt === 'c' ? (tgt.el || S.CREATURES[tgt.t].n) : tgt.name} (−${dmg}).`;
  if (e.fx.vida) { const hh = Math.max(1, Math.round(dmg * e.fx.vida)); u.hp = Math.min(e.maxHp, u.hp + hh); msg += ` 🩸 +${hh}.`; }
  if (crit) msg += ' 💥 ¡Crítico!';
  if (blocked) msg += ' 🛡️ Bloqueado.';
  if (e.fx.fuego && tgt.hp > 0 && !(wxa && !wxa.fire)) { const d = Math.max(1, Math.round(e.dmg * e.fx.fuego)); if (!tgt.pz || tgt.pz.d < d) tgt.pz = { t: 2, d }; msg += ' 🔥 Quemado.'; }
  if (e.fx.hielo && tgt.hp > 0 && ((wxa && wxa.ice) || rng(g) < e.fx.hielo)) { tgt.sl = 1; msg += ' ❄️ Ralentizado.'; }
  if (wk && wk.slow && tgt.hp > 0 && rng(g) < wk.slow) { tgt.sl = 1; msg += ' 💫 Aturdido.'; }
  if (e.fx.veneno && tgt.hp > 0) { tgt.pz = { t: 3, d: Math.max(1, Math.round(e.dmg * e.fx.veneno)) }; msg += ' ☠️ Envenenado.'; }
  if (tt === 'c') {
    if (tgt.hp <= 0) { killCreature(g, tgt, u); return { msg: msg + ' ¡Derrotado!' }; }
    tgt.prov = u.id;
    const cs = cstats(tgt, g);
    if (dist >= cs.min && dist <= cs.rng) {
      const rd = calcDamage(cs.dmg * factor, e.def + terrDef(g, u.x, u.y) + guardHDef(g, u, tgt), 0); // el segundo golpe del turno recibe un contraataque al 60%
      u.hp -= rd; msg += ` Contraataque −${rd}.`;
      if (u.hp <= 0) { killUnit(g, u, { creature: tgt }); return { msg: msg + ' Tu unidad cae.' }; }
    }
  } else {
    const pw = g.players[tgt.o];
    if (pw.wr) pw.wr[u.o] = g.turn;
    botNote(g, pw, u.o, 'gr', tgt.hp <= 0 ? 2 : 1);
    if (tgt.hp <= 0) { killUnit(g, tgt, { unit: u }); return { msg: msg + ' ¡Eliminada!' }; }
    ev(g, `⚔️ ${g.players[u.o].name} ataca a ${tgt.name} (−${dmg}).`, [tgt.o], 'phit');
    if (dist === 1 && te.fx.espinas) {
      const th = Math.max(1, Math.round(dmg * te.fx.espinas));
      u.hp -= th; msg += ` 🌵 Espinas −${th}.`;
      if (u.hp <= 0) { killUnit(g, u, { unit: tgt }); return { msg: msg + ' Tu unidad cae.' }; }
    }
    if (dist >= te.min && dist <= te.range) {
      let rraw = te.dmg * factor;
      if (te.range > 1 && !te.reach && dist === 1) rraw *= 0.6;
      const rd = calcDamage(rraw, e.def + terrDef(g, u.x, u.y) + guardPvp(g, u), te.pierce);
      u.hp -= rd; msg += ` Contraataque −${rd}.`;
      if (u.hp <= 0) { killUnit(g, u, { unit: tgt }); return { msg: msg + ' Tu unidad cae.' }; }
    }
  }
  return { msg };
}

/* ---------- clases, edificios, órdenes y resumen ---------- */
function doClass(u, k) {
  if (u.lv < S.CLASS_LV) return `Necesitas nivel ${S.CLASS_LV} para elegir una clase`;
  if (u.cls) return 'Esta unidad ya tiene clase';
  if (!S.CLASSES[k]) return 'Clase desconocida';
  u.cls = k; return null;
}
function doSub(u, k) {
  if (!u.cls) return 'Primero elige una clase';
  if (u.lv < S.SUB_LV) return `Necesitas nivel ${S.SUB_LV} para especializarte`;
  if (u.sub) return 'Ya tiene especialización';
  if (!S.CLASSES[u.cls].sub[k]) return 'Especialización desconocida';
  u.sub = k; return null;
}
function doBuild(g, p, c, k) {
  const B = S.BUILDINGS[k];
  if (!B) return 'Edificio desconocido';
  if (k === 'asedio' && !siegeOn(g)) return 'Los asedios están desactivados en esta partida';
  c.b = c.b || {};
  const lv = c.b[k] || 0;
  if (lv >= S.bMax(k)) return 'Ya está al máximo';
  if (c.built) return 'Esta ciudad ya construyó este turno';
  const cost = B.cost[lv];
  if (!canAfford(c.st.m, cost)) return 'Faltan materiales: ' + fmtMats(cost);
  spend(c.st.m, cost);
  c.b[k] = lv + 1; c.built = 1;
  ev(g, `${B.e} ${c.name}: ${B.n} nivel ${lv + 1}.`, [p.id], 'city');
  return null;
}
function doOrder(g, u, m) {
  if (m.o === 'clear') { u.ord = null; return null; }
  if (m.o === 'guard') { u.ord = { t: 'guard' }; return null; }
  if (m.o === 'home') { if (!g.cities.some(c => c.owner === u.o)) return 'No tienes ciudades'; u.ord = { t: 'home' }; return null; }
  if (m.o === 'goto') {
    const x = m.x | 0, y = m.y | 0;
    if (!inB(g, x, y) || S.TERR[terrAt(g, x, y)].c >= 99) return 'No se puede ir a esa casilla';
    if (x === u.x && y === u.y) return 'Ya estás ahí';
    u.ord = { t: 'goto', x, y, st: 0 }; return null;
  }
  return 'Orden desconocida';
}
function runOrder(g, u) {
  const o = u.ord;
  if (!o || !g.units.includes(u)) return;
  if (o.t === 'guard') {
    for (let i = 0; i < 2 && u.at > 0 && g.units.includes(u); i++) {
      const e = eff(g, u); let best = null;
      for (const c of g.creatures) { const d = cheb(c, u); if (d >= e.min && d <= e.range && (!best || c.hp < best.hp)) best = c; }
      if (!best || typeof doAttack(g, u, 'c', best.id) === 'string') break;
    }
    return;
  }
  const w = g.map.w;
  let tx, ty, home = null;
  if (o.t === 'goto') {
    tx = o.x; ty = o.y;
    if (u.hp < eff(g, u).maxHp * 0.35) { u.ord = null; ev(g, `🩹 ${u.name} se detiene: está muy herida.`, [u.o], 'ord'); return; }
    if (cheb(u, { x: tx, y: ty }) === 0) { u.ord = null; ev(g, `📍 ${u.name} llegó a su destino.`, [u.o], 'ord'); return; }
  } else {
    let hd = 1e9;
    for (const c of g.cities) if (c.owner === u.o) { const d = cheb(c, u); if (d < hd) { hd = d; home = c; } }
    if (!home) { u.ord = null; return; }
    tx = home.x; ty = home.y;
    if (hd <= 1) { depositAll(g, u, home); u.ord = null; ev(g, `🏠 ${u.name} llegó a ${home.name} y depositó su botín.`, [u.o], 'ord'); return; }
  }
  if (u.mp <= 0) return;
  const bx = u.x, by = u.y;
  headTo(g, u, tx, ty);
  if (o.t === 'home') {
    if (cheb(u, home) <= 1) { depositAll(g, u, home); u.ord = null; ev(g, `🏠 ${u.name} llegó a ${home.name} y depositó su botín.`, [u.o], 'ord'); return; }
  } else if (cheb(u, { x: tx, y: ty }) === 0 || (cheb(u, { x: tx, y: ty }) <= 1 && idx(g).U.has(ty * w + tx))) {
    u.ord = null; ev(g, `📍 ${u.name} llegó a su destino.`, [u.o], 'ord'); return;
  }
  if (u.x === bx && u.y === by) {
    o.st = (o.st || 0) + 1;
    if (o.st >= 2) { u.ord = null; ev(g, `🚧 ${u.name} no puede avanzar y cancela su orden.`, [u.o], 'ord'); }
  } else o.st = 0;
}
function runOrders(g) {
  for (const u of g.units.slice()) {
    if (!u.ord) continue;
    const p = g.players[u.o];
    if (!p || p.bot || p.auto || !p.alive) { u.ord = null; continue; }
    runOrder(g, u);
  }
}
function recapFor(g, p) {
  if (p.ack === undefined || g.turn <= p.ack) return null;
  const evs = g.events.filter(e => e.turn >= p.ack && e.k !== 'turn' && (!e.to || e.to.includes(p.id)));
  const c = { lost: 0, hits: 0, atk: 0, kills: 0, lvl: 0 };
  const lines = [];
  const show = ['dead', 'pvp', 'city', 'boss', 'horde', 'dip', 'season', 'sys', 'ord'];
  for (const e of evs) {
    if (e.k === 'dead') c.lost++;
    else if (e.k === 'hit') c.hits++;
    else if (e.k === 'phit') c.atk++;
    else if (e.k === 'loot') c.kills++;
    else if (e.k === 'lvl') c.lvl++;
    if (show.includes(e.k) && lines.length < 40) lines.push({ turn: e.turn, text: e.text, k: e.k });
  }
  if (!lines.length && !c.lost && !c.hits && !c.atk && !c.kills && !c.lvl) return null;
  return { from: p.ack, to: g.turn, c, lines };
}

/* ---------- comandos de jugadores ---------- */
function applySkill(u, s) {
  const d = S.SKILLS[s];
  if (!d) return 'Habilidad desconocida';
  if (u.pts <= 0) return 'No tienes puntos disponibles';
  if (u.sk[s] >= d.cap) return `${d.n} ya está al máximo`;
  u.sk[s]++; u.pts--;
  return null;
}
function cmd(g, pid, m) {
  if (g.status !== 'playing') return { err: 'La partida no está en curso' };
  const p = g.players[pid];
  if (!p || !p.alive) return { err: 'Estás eliminado' };
  markSeen(g, pid);
  const SM_NO = ['skill', 'cls', 'sub', 'equip', 'unequip', 'dep', 'depi', 'wd', 'wdi', 'summon'];
  const CART_NO = ['skill', 'cls', 'sub', 'equip', 'unequip', 'summon', 'hero'];
  const BLD_NO = ['skill', 'cls', 'sub', 'equip', 'unequip', 'dep', 'depi', 'wd', 'wdi', 'summon', 'hero', 'attack'];
  const SG_NO = BLD_NO.filter(a => a !== 'attack');
  const BS_NO = ['cls', 'sub', 'equip', 'unequip', 'summon', 'hero'];
  const unitOf = () => { const u = g.units.find(x => x.id === m.u && x.o === pid ); return (u && ((u.sm && SM_NO.includes(m.a)) || (u.cart && CART_NO.includes(m.a)) || (u.bld && BLD_NO.includes(m.a)) || (u.sg && SG_NO.includes(m.a)) || (u.bs && BS_NO.includes(m.a)))) ? null : u; };
  const cityOf = () => g.cities.find(c => c.id === m.c && c.owner === pid);
  let err = null, msg = '';
  switch (m.a) {
    case 'move': {
      const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' };
      u.ord = null; err = doMove(g, u, m.x | 0, m.y | 0); break;
    }
    case 'attack': {
      const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' };
      u.ord = null;
      const r = doAttack(g, u, m.tt === 'u' ? 'u' : 'c', m.id | 0);
      if (typeof r === 'string') err = r; else msg = r.msg;
      break;
    }
    case 'hero': {
      const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' };
      if (g.cfg.hero === 'no') return { err: 'Esta partida no tiene protagonistas' };
      if (u.sm) return { err: 'Una invocación no puede ser protagonista' };
      if (g.turn > S.HERO.pickTurn) return { err: 'El protagonista ya quedó fijo (solo se elige en el turno 1)' };
      const emb = S.HERO.emb.includes(m.emb) ? m.emb : (u.hero || S.HERO.emb[0]);
      const old = p.hero ? g.units.find(x => x.id === p.hero) : null;
      if (old && old !== u) { old.hero = null; }
      u.hero = emb; p.hero = u.id; touch(g); msg = `${u.name} es tu protagonista ${emb}`; break;
    }
    case 'rename': {
      const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' };
      const nm = String(m.name === undefined ? '' : m.name).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
      if (!nm) return { err: 'Escribe un nombre' };
      u.name = nm; touch(g); msg = 'Ahora se llama ' + nm; break;
    }
    case 'summon': {
      const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' };
      err = doSummon(g, u, m.k); if (!err) msg = 'Invocación lista (descansa este turno)'; break;
    }
    case 'dismiss': {
      const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' };
      if (!u.sm) return { err: 'Solo se pueden despedir invocaciones' };
      g.units.splice(g.units.indexOf(u), 1); touch(g); msg = 'Invocación despedida'; break;
    }
    case 'builder': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      err = doBuilder(g, p, c); if (!err) msg = 'Constructor contratado (descansa este turno)'; break;
    }
    case 'guild': {
      const r = doGuild(g, p, m); if (typeof r === 'string') err = r; else msg = r.msg || ''; break;
    }
    case 'endprot': { if (!protLeft(g, pid)) return { err: 'No tienes protección activa' }; p.prot = 0; touch(g); msg = 'Protección terminada: ya puedes atacar (y te pueden atacar)'; break; }
    case 'siegeunit': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      err = doSiegeUnit(g, p, c, m.k); if (!err) msg = 'Máquina de asedio construida (descansa este turno)'; break;
    }
    case 'siegewall': {
      const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' };
      u.ord = null; const r = doSiegeWall(g, u, m.cid | 0);
      if (typeof r === 'string') err = r; else msg = r.msg; break;
    }
    case 'repair': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      err = doRepair(g, p, c); if (!err) msg = 'Muralla reparada'; break;
    }
    case 'road': case 'station': {
      const u = unitOf(); if (!u || !u.bld) return { err: 'Solo un constructor puede hacer eso' };
      err = (m.a === 'road' ? doRoad : doStation)(g, p, u); if (!err) msg = m.a === 'road' ? 'Carretera trazada' : 'Estación de suministros levantada'; break;
    }
    case 'cart': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      err = doCart(g, p, c); if (!err) msg = 'Carreta construida (descansa este turno)'; break;
    }
    case 'skill': {
      const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' };
      err = applySkill(u, m.s); break;
    }
    case 'equip': case 'unequip': case 'dep': case 'depi': case 'wd': case 'wdi': {
      const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' };
      const c = stationOf(g, u);
      if (!c) return { err: 'La unidad debe estar junto a una de tus ciudades (o a una carreta tuya)' };
      if (m.a === 'equip') err = doEquip(g, u, m.i | 0);
      else if (m.a === 'unequip') err = doUnequip(g, u, m.s);
      else if (m.a === 'dep') {
        if (m.all) depositAll(g, u, c);
        else if (!S.MATS[m.m]) err = 'Material inválido';
        else {
          let n = Math.min(m.n | 0, u.inv.m[m.m] || 0);
          const nn = c.cartU ? Math.min(n, capOf(c.cartU) - invW(c.cartU)) : n;
          if (n <= 0) err = 'No tienes eso'; else if (nn <= 0) err = 'La carreta está llena'; else { n = nn; u.inv.m[m.m] -= n; if (!u.inv.m[m.m]) delete u.inv.m[m.m]; c.st.m[m.m] = (c.st.m[m.m] || 0) + n; }
        }
      } else if (m.a === 'depi') {
        const i = u.inv.it.findIndex(x => x.id === (m.i | 0));
        if (i < 0) err = 'No tienes ese objeto'; else if (c.cartU && invW(c.cartU) + 2 > capOf(c.cartU)) err = 'La carreta está llena'; else c.st.it.push(u.inv.it.splice(i, 1)[0]);
      } else if (m.a === 'wd') {
        if (!S.MATS[m.m]) return { err: 'Material inválido' };
        const room = capOf(u) - invW(u);
        const n = Math.min(m.n | 0, c.st.m[m.m] || 0, room);
        if (n <= 0) err = room <= 0 ? 'Mochila llena' : 'No hay en el almacén';
        else { c.st.m[m.m] -= n; if (!c.st.m[m.m]) delete c.st.m[m.m]; u.inv.m[m.m] = (u.inv.m[m.m] || 0) + n; }
      } else if (m.a === 'wdi') {
        const i = c.st.it.findIndex(x => x.id === (m.i | 0));
        if (i < 0) err = 'No está en el almacén';
        else if (invW(u) + 2 > capOf(u)) err = 'Mochila llena';
        else u.inv.it.push(c.st.it.splice(i, 1)[0]);
      }
      break;
    }
    case 'craft': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      const r = doCraft(g, p, c, m.k, m.tr | 0);
      if (typeof r === 'string') err = r; else msg = `Forjado: ${S.itemName(r)}`;
      break;
    }
    case 'recruit': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      err = doRecruit(g, p, c, m.k || null); if (!err) msg = isKing(g, pid) ? 'Nueva bestia reclutada (descansa este turno)' : 'Nueva unidad reclutada (descansa este turno)';
      break;
    }
    case 'revive': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      const r = doRevive(g, p, c, m.g | 0);
      if (typeof r === 'string') err = r; else msg = `${r.name} volverá en 2 turnos`;
      break;
    }
    case 'upgrade': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      const r = doUpgrade(g, c, m.i | 0);
      if (typeof r === 'string') err = r; else msg = `Mejorado: ${S.itemName(r)}`;
      break;
    }
    case 'enchant': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      const r = doEnchant(g, c, m.i | 0, m.f || null);
      if (typeof r === 'string') err = r; else msg = `Encantado: ${S.itemName(r)}`;
      break;
    }
    case 'reforge': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      const r = doReforge(g, c, m.i | 0, m.x | 0);
      if (typeof r === 'string') err = r; else msg = `Reforjado: ${S.itemName(r)}`;
      break;
    }
    case 'socket': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      const r = doSocket(g, c, m.i | 0);
      if (typeof r === 'string') err = r; else msg = `Engarce perforado: ${S.itemName(r)}`;
      break;
    }
    case 'gem': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      const r = doGem(g, c, m.i | 0, String(m.k || ''), m.x === undefined ? undefined : m.x | 0);
      if (typeof r === 'string') err = r; else msg = `Gema engastada: ${S.itemName(r)}`;
      break;
    }
    case 'gemup': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      const r = doGemUp(g, c, String(m.k || ''));
      if (S.gemOf(r)) msg = `Gema mejorada: ${S.MATS[r].n}`; else err = r;
      break;
    }
    case 'dungeon': {
      const r = doDungeon(g, p, m);
      if (typeof r === 'string') err = r; else msg = r.msg || '';
      break;
    }
    case 'merch': {
      const r = doMerch(g, p, m);
      if (typeof r === 'string') err = r; else msg = r.msg || '';
      break;
    }
    case 'trade': {
      const r = doTrade(g, p, m);
      if (typeof r === 'string') err = r; else msg = r.msg || '';
      break;
    }
    case 'dip': {
      const r = doDip(g, p, m);
      if (typeof r === 'string') err = r; else msg = r.msg || '';
      break;
    }
    case 'cls': { const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' }; err = doClass(u, m.k); if (!err) msg = `${u.name} ahora es ${S.CLASSES[u.cls].n}`; break; }
    case 'sub': { const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' }; err = doSub(u, m.k); if (!err) msg = `${u.name} se especializa: ${S.CLASSES[u.cls].sub[u.sub].n}`; break; }
    case 'build': {
      const c = cityOf(); if (!c) return { err: 'Ciudad no encontrada' };
      err = doBuild(g, p, c, m.k); if (!err) msg = `${S.BUILDINGS[m.k].n} nivel ${c.b[m.k]}`;
      break;
    }
    case 'ord': {
      const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' };
      err = doOrder(g, u, m);
      if (!err && m.o !== 'clear') { runOrder(g, u); msg = u.ord ? 'Orden dada: ' + S.ORDERS[u.ord.t].n : 'Hecho'; }
      else if (!err) msg = 'Orden cancelada';
      break;
    }
    case 'ack': p.ack = g.turn; return { ok: true, msg: '' };
    case 'ready': p.ready = !!m.v; break;
    default: return { err: 'Comando desconocido' };
  }
  if (err) return { err };
  g.dirty = true;
  return { ok: true, msg };
}

/* ---------- criaturas ---------- */
function creatureEnv(g, c) {
  const ix = idx(g), w = g.map.w, t = g.map.t;
  return {
    w, h: g.map.h,
    terr: (x, y) => ix.T.has(y * w + x) ? 'm' : t.charAt(y * w + x),
    occ: (x, y) => (ix.U.has(y * w + x) || ix.C.has(y * w + x)) ? 2 : 0,
  };
}
function creatureStep(g, c, cs, tx, ty) {
  const w = g.map.w, r = S.reach(creatureEnv(g, c), c.x, c.y, cs.mov), dm = distMap(g, tx, ty);
  const cur = dm[c.y * w + c.x];
  let best = null;
  for (const [k, v] of r) {
    if (k === c.y * w + c.x || !v.end) continue;
    const d = dm[k];
    if (d >= cur) continue;
    if (!best || d < best.d || (d === best.d && v.c < best.c)) best = { k, d, c: v.c };
  }
  if (best) { const nx = best.k % w, ny = (best.k - nx) / w; c.x = nx; c.y = ny; touch(g); }
}
/* ---------- jefes con fases (v1.35): se enfurecen al 60% de vida y piden refuerzos al 30% ---------- */
function bossPhase(g, c) {
  const d = S.CREATURES[c.t]; if (!(d.boss || c.bd) || g.cfg.mode === 'uno') return;
  const r = c.hp / cstats(c, g).mhp;
  if (r <= 0.6 && !c.ph) { c.ph = 1; ev(g, `🔥 ¡${d.n} se enfurece! Golpea un 25% más fuerte y se mueve más rápido.`, null, 'boss'); touch(g); }
  if (r <= 0.3 && (c.ph || 0) < 2) {
    c.ph = 2; let n = 0; const ix = idx(g), types = ['lobo', 'esqueleto', 'goblin'];
    for (let dy = -2; dy <= 2 && n < 2; dy++) for (let dx = -2; dx <= 2 && n < 2; dx++) {
      const x = c.x + dx, y = c.y + dy; if (!dx && !dy) continue;
      const k = y * g.map.w + x; if (!inB(g, x, y) || ix.U.has(k) || ix.C.has(k) || ix.T.has(k)) continue;
      if (c.dg ? !dgFree(g, x, y) : !'gfhd'.includes(terrAt(g, x, y))) continue;
      const m = spawnCreature(g, pick(g, types), x, y, Math.max(1, c.lv - 3)); m.min = true; m.bo = c.id; if (c.dg) m.dg = c.dg; ix.C.set(k, m); n++;
    }
    ev(g, `⚡ ¡${d.n} arde en furia${n ? ' y llama a ' + n + ' secuaces' : ''}! Golpea un 50% más fuerte que al principio.`, null, 'boss'); touch(g);
  }
}
function takeTomb(g, u, st) { // recoger (o saquear) lo que dejó una unidad caída
  const L = st.loot; let moved = 0;
  const lostM = addMats(u, L.m); const hadM = Object.keys(L.m).length; L.m = {}; for (const k in lostM) if (lostM[k] > 0) L.m[k] = lostM[k];
  const pool = L.eq.concat(L.it); L.eq = []; L.it = [];
  for (const it of pool) { if (putItem(u, it)) moved++; else L.it.push(it); }
  const left = Object.keys(L.m).length + L.it.length;
  if (!left) { g.sites.splice(g.sites.indexOf(st), 1); }
  touch(g);
  const own = st.o === u.o;
  ev(g, `🪦 ${u.name} ${own ? 'recupera lo que dejó' : 'saquea la tumba de'} ${st.nm}${left ? '. ⚠️ Mochila llena: queda parte en la tumba' : '.'}`, [u.o], 'site');
}
function dropTomb(g, u) { // al caer ante una criatura, la unidad deja su equipo y mochila en una tumba (30 turnos)
  const eq = Object.values(u.eq).filter(Boolean), loot = { eq, it: u.inv.it.slice(), m: Object.assign({}, u.inv.m) };
  if (!eq.length && !loot.it.length && !Object.keys(loot.m).length) return;
  g.sites.push({ id: g.nid++, x: u.x, y: u.y, k: 'tumba', o: u.o, nm: u.name, loot, exp: g.turn + 30, dg: u.dg || undefined }); touch(g);
}
function reviveCost(gr, c) { return holyCost(c, { alma: 2 + Math.ceil(gr.lv / 4), hueso: 6 }); }
function doRevive(g, p, c, gid) {
  const gr = (g.graves || []).find(x => x.id === gid && x.o === p.id); if (!gr) return 'Esa unidad no está entre los caídos';
  if (g.units.filter(u => u.o === p.id && !isAux(u)).length + (g.rv || []).filter(r => r.o === p.id).length >= MAX_UNITS) return `Máximo ${MAX_UNITS} unidades`;
  const cost = reviveCost(gr, c); if (!canAfford(c.st.m, cost)) return 'Faltan materiales en el almacén: ' + fmtMats(cost);
  spend(c.st.m, cost); g.graves.splice(g.graves.indexOf(gr), 1);
  g.rv = g.rv || []; g.rv.push({ o: p.id, name: gr.name, bs: null, emb: null, lv: gr.lv, pts: gr.pts, sk: Object.assign({}, gr.sk), cls: gr.cls || null, sub: gr.sub || null, bn: gr.bn || null, gen: gr.gen || 0, keep: null, due: g.turn + 2, city: c.id });
  touch(g);
  return gr;
}
/* ---------- iglesia: ángel guardián (nivel 5) ---------- */
// No es una unidad: vive en la ciudad (c.ang = {x, y}), actúa solo cada turno y solo daña criaturas. Es sagrado: nada puede herirlo.
function angelsTurn(g) {
  for (const c of g.cities) {
    if (c.owner === null || !c.b || (c.b.iglesia || 0) < S.CHURCH.angelLv) { if (c.ang) { delete c.ang; touch(g); } continue; }
    const home = { x: Math.min(g.map.w - 1, c.x + 2), y: c.y };
    if (!c.ang) { c.ang = { x: home.x, y: home.y, n: pick(g, S.ANGEL.names) }; touch(g); ev(g, `👼 ¡El ángel ${c.ang.n} desciende sobre ${c.name}! Protegerá la ciudad de las criaturas.`, [c.owner], 'city'); }
    const A = S.ANGEL, ix = idx(g);
    let tg = null, bd = 1e9;
    for (const m of g.creatures) {
      if (m.dg) continue;
      const d = cheb(c, m); if (d > S.CHURCH.range) continue;
      const sc = d - (m.tg === c.id ? 3 : 0) - (S.CREATURES[m.t].boss ? 1 : 0);
      if (sc < bd) { bd = sc; tg = m; }
    }
    if (!tg) { if (c.ang.x !== home.x || c.ang.y !== home.y) { c.ang.x = home.x; c.ang.y = home.y; touch(g); } continue; }
    const holder = { o: c.owner, name: '👼 ' + c.ang.n, inv: { it: [], m: {} }, eq: {}, xp: 0, lv: 1, cart: true, sk: {}, hp: 1 };
    let hits = 0, dealt = 0, killed = null; const tname = S.CREATURES[tg.t].n;
    for (let i = 0; i < A.attacks && tg; i++) {
      if (cheb(c.ang, tg) > A.rng) { // vuela hasta quedar a tiro, sin salirse del radio de la ciudad
        let best = null;
        for (let dy = -A.rng; dy <= A.rng; dy++) for (let dx = -A.rng; dx <= A.rng; dx++) {
          const x = tg.x + dx, y = tg.y + dy; if (!inB(g, x, y) || (dx === 0 && dy === 0) || ix.C.has(y * g.map.w + x)) continue;
          const dd = cheb(c.ang, { x, y }); if (!best || dd < best.dd) best = { x, y, dd };
        }
        if (best) { c.ang.x = best.x; c.ang.y = best.y; touch(g); }
      }
      const cs = cstats(tg, g), dmg = calcDamage(A.dmg, cs.def + terrDef(g, tg.x, tg.y), A.pierce);
      tg.hp -= dmg; tg.hit = true; hits++; dealt += dmg;
      if (tg.hp <= 0) { killed = S.CREATURES[tg.t].n; killCreature(g, tg, holder); tg = null; }
    }
    if (hits) ev(g, `👼 ${c.ang.n}, el ángel de ${c.name}, golpea a ${tname} (−${dealt})${killed ? ' ¡y lo derrota!' : ''}.`, [c.owner], 'loot');
    for (const k in holder.inv.m) c.st.m[k] = (c.st.m[k] || 0) + holder.inv.m[k];
    for (const it of holder.inv.it) c.st.it.push(it);
  }
}
function creaturesTurn(g) {
  for (const c of g.creatures.slice()) {
    if (!g.creatures.includes(c)) continue;
    bossPhase(g, c);
    const d = S.CREATURES[c.t], cs = cstats(c, g);
    let hcity = null;
    if (c.tg) {
      c.ttl = (c.ttl || 0) - 1;
      hcity = g.cities.find(x => x.id === c.tg);
      if (c.ttl <= 0 || !hcity) { delete c.tg; delete c.ttl; c.hx = c.x; c.hy = c.y; hcity = null; }
    }
    const agg = c.tg ? Math.max(cs.agg, 4) : cs.agg;
    let target = null;
    if (c.prov) {
      const pu = g.units.find(u => u.id === c.prov);
      if (pu && cheb(pu, c) <= 10) target = pu; else c.prov = null;
    }
    if (!target && agg > 0) {
      let bd = 1e9;
      for (const u of g.units) { const dd = cheb(u, c); if (dd <= agg && (dd < bd || (dd === bd && target && u.hp < target.hp))) { bd = dd; target = u; } }
      if (target && !c.tg && cheb(target, { x: c.hx, y: c.hy }) > (d.boss ? 9 : 7)) target = null; // correa
    }
    if (target) {
      let dist = cheb(c, target);
      if (dist > cs.rng) {
        const r = S.reach(creatureEnv(g, c), c.x, c.y, cs.mov);
        const w = g.map.w;
        let best = null;
        for (const [k, v] of r) {
          if (k === c.y * w + c.x) continue;
          if (!v.end) continue;
          const x = k % w, y = (k - x) / w, dd = cheb({ x, y }, target);
          const inRange = dd <= cs.rng ? 0 : 1;
          if (!best || inRange < best.ir || (inRange === best.ir && (dd < best.dd || (dd === best.dd && v.c < best.c)))) best = { x, y, dd, c: v.c, ir: inRange };
        }
        if (best && best.dd < dist) { c.x = best.x; c.y = best.y; touch(g); dist = best.dd; }
      }
      if (dist <= cs.rng) {
        const e = eff(g, target);
        let dmg = calcDamage(cs.dmg, e.def + terrDef(g, target.x, target.y) + guardHDef(g, target, c), 0);
        if (e.fx.bloqueo && rng(g) < e.fx.bloqueo) dmg = Math.max(1, Math.round(dmg / 2));
        target.hp -= dmg;
        ev(g, `🩸 ${c.el ? c.el : S.CREATURES[c.t].n} (niv. ${c.lv}) ataca a ${target.name} (−${dmg}).`, [target.o], 'hit', c.tg ? 'raid' : undefined);
        if (target.hp <= 0) { killUnit(g, target, { creature: c }); c.prov = null; continue; }
        if (dist === 1 && e.fx.espinas) {
          c.hp -= Math.max(1, Math.round(dmg * e.fx.espinas)); c.hit = true;
          if (c.hp <= 0) { killCreature(g, c, target); continue; }
        }
        // contraataque
        const ue = e;
        if (dist >= ue.min && dist <= ue.range) {
          const rd = calcDamage(ue.dmg * ((ue.range > 1 && !ue.reach && dist === 1) ? 0.6 : 1) * (1 + guardHAtk(g, target, c)), cs.def + terrDef(g, c.x, c.y), ue.pierce);
          c.hp -= rd; c.hit = true;
          if (c.hp <= 0) { killCreature(g, c, target); continue; }
          if (ue.fx.vida) { target.hp = Math.min(ue.maxHp, target.hp + Math.max(1, Math.round(rd * ue.fx.vida))); }
          if (ue.fx.veneno) c.pz = { t: 3, d: Math.max(1, Math.round(ue.dmg * ue.fx.veneno)) };
        }
      }
    } else if (hcity) {
      if (cheb(c, hcity) > 1) creatureStep(g, c, cs, hcity.x, hcity.y);
    } else if (rng(g) < 0.4) {
      const dir = pick(g, S.DIRS);
      const x = c.x + dir[0], y = c.y + dir[1];
      if (inB(g, x, y) && 'gfhd'.includes(terrAt(g, x, y)) && cheb({ x, y }, { x: c.hx, y: c.hy }) <= 5) {
        const ix = idx(g), k = y * g.map.w + x;
        if (!ix.U.has(k) && !ix.C.has(k) && !ix.T.has(k)) { c.x = x; c.y = y; touch(g); }
      }
    }
  }
}
/* ---------- economía: producción pasiva de las ciudades ---------- */
function cityIncome(g, c) { // materiales por turno (fracciones) según terreno cercano y edificios
  const I = S.INCOME, inc = {}, add = (o, k) => { for (const m in o) inc[m] = (inc[m] || 0) + o[m] * (k || 1); };
  add(I.base); if (c.cap) add(I.cap);
  for (let dy = -I.r; dy <= I.r; dy++) for (let dx = -I.r; dx <= I.r; dx++) {
    const x = c.x + dx, y = c.y + dy; if (!inB(g, x, y)) continue;
    const t = I[terrAt(g, x, y)]; if (t && typeof t === 'object') add(t);
  }
  for (const b of ['herreria', 'cuartel', 'atalaya', 'iglesia']) if (c.b && c.b[b]) add(I[b], c.b[b]);
  const mult = I.mult[g.cfg.income || 'normal'] === undefined ? 1 : I.mult[g.cfg.income || 'normal'];
  const king = isKing(g, c.owner);
  for (const m in inc) inc[m] *= mult * (king && m === 'hueso' ? I.rey : 1);
  return inc;
}
function incomeTick(g) {
  if (!g.cities) return;
  for (const c of g.cities) {
    if (c.owner === null || !g.players[c.owner] || !g.players[c.owner].alive) continue;
    if (siegeOn(g) && (c.sg || 0) >= 1) continue; // ciudad en cerco: no produce
    const inc = cityIncome(g, c); c.pa = c.pa || {}; const got = {};
    for (const m in inc) { c.pa[m] = (c.pa[m] || 0) + inc[m]; const n = Math.floor(c.pa[m]); if (n > 0) { c.pa[m] -= n; c.st.m[m] = (c.st.m[m] || 0) + n; got[m] = n; } }
    if (Object.keys(got).length && g.turn % 5 === 0) ev(g, `🏭 ${c.name} produjo: ${fmtMats(got)}.`, [c.owner], 'city');
  }
}
function worldTick(g) {
  siegeTick(g);
  incomeTick(g);
  for (const u of g.units.slice()) if (u.bld) { const c = g.cities.find(x => x.id === u.bld.c); if (!c || c.owner !== u.o) { g.units.splice(g.units.indexOf(u), 1); touch(g); ev(g, `👷 ${u.name} se queda sin taller y se marcha.`, [u.o], 'city'); } }
  if (g.turn % 10 === 0 && g.cfg.mode !== 'mundo') {
    for (const c of g.creatures) {
      if (!c.dg && c.lv < S.CREATURES[c.t].max) { // sube de nivel conservando su proporción de salud (ya no se cura entera)
        const ratio = c.hp / cstats(c, g).mhp; c.lv++; c.hp = Math.max(1, Math.round(ratio * cstats(c, g).mhp));
      }
    }
  }
  if (g.sites.some(q => q.k === 'tumba' && g.turn > q.exp)) { g.sites = g.sites.filter(q => !(q.k === 'tumba' && g.turn > q.exp)); touch(g); }
  for (const c of g.creatures.slice()) {
    if (c.pz) { c.hp = Math.max(1, c.hp - c.pz.d); c.pz.t--; if (c.pz.t <= 0) delete c.pz; }
    // los jefes se recuperan despacio (3%): un solo aventurero que se retira a curarse no debe verlos volver a tope
    if (!c.hit) c.hp = Math.min(cstats(c, g).mhp, c.hp + Math.ceil(cstats(c, g).mhp * (S.CREATURES[c.t].boss ? ({ lenta: 0.03, normal: 0.1, ninguna: 0 })[g.cfg.bossRegen] ?? 0.03 : 0.1)));
    c.hit = false;
    if (c.sl > 0) c.sl--;
  }
  const si = S.seasonIdx(g.turn);
  const cap = Math.round(mapArea(g) / 55);
  const world = g.cfg.mode === 'mundo';
  const n = world ? Math.max(2, Math.round(cap * 0.02)) : Math.max(1, Math.round(g.players.length * 0.5));
  const wild = () => g.creatures.filter(c => !c.tg && !c.dg).length;
  for (let i = 0; i < n && wild() < cap; i++) spawnNormal(g, false);
  if (si === 0) { // primavera: más animales
    for (let i = 0; i < 2 && wild() < cap + 4; i++) {
      const pos = freeLandTile(g, 4, 6, 0);
      if (pos) { const ty = pick(g, ['ciervo', 'jabali', 'conejo', 'cabra', 'tortuga']); spawnCreature(g, ty, pos.x, pos.y, world ? rndLv(g, ty) : 1 + Math.floor(g.turn / 15)); }
    }
  }
  if (world) { if (g.turn % 3 === 0 && bossCount(g) < Math.floor(mapArea(g) / 4000) + 1) spawnBoss(g); }
  else if (g.cfg.mode !== 'historia' && g.cfg.victory === 'jefes' && g.turn >= 3 && g.turn % 3 === 0 && bossCount(g) < Math.floor(g.players.length / 2) + 1) spawnBoss(g);
  else if (g.cfg.mode !== 'historia' && g.turn >= 4 && g.turn % 5 === 0 && bossCount(g) < Math.floor(g.players.length / 3) + 1) spawnBoss(g);
  const wantSites = siteWant(g);
  if (g.turn % 4 === 0 && g.sites.filter(q => !q.dg).length < wantSites) for (let t = 0; t < 3; t++) if (spawnSite(g)) break;
  const gap = (si === 3 ? 10 : 16) * (g.cfg.fauna === 'pacifica' ? 1.8 : g.cfg.fauna === 'agresiva' ? 0.65 : 1);
  if (!world && g.turn >= 10 && g.turn - (g.lh || 0) >= gap && rng(g) < 0.4) { if (spawnHorde(g)) g.lh = g.turn; }
}

/* ---------- inicio de turno ---------- */
function refreshUnits(g) {
  for (const u of g.units.slice()) {
    if (u.sm) { const own = g.units.find(x => x.id === u.sm.by); if (!own) { g.units.splice(g.units.indexOf(u), 1); continue; } u.lv = own.lv; }
    const e = eff(g, u);
    if (u.sl > 0) u.sl--;
    if (u.pz) { u.hp = Math.max(1, u.hp - u.pz.d); u.pz.t--; if (u.pz.t <= 0) delete u.pz; }
    let heal = 0, mpct = 0;
    for (const v of g.units) {
      if (v === u || v.o !== u.o || cheb(u, v) !== 1) continue;
      const mp = v.sk.medico + (v.cls ? (S.classMods(v).medico || 0) : 0);
      if (mp) mpct += mp * 0.04;
    }
    heal += Math.min(mpct, 0.5) * e.maxHp;
    if (e.fx.regen) heal += e.fx.regen * e.maxHp;
    if (cityNear(g, u)) heal += 0.25 * e.maxHp; else if (cartNear(g, u)) heal += S.CART.heal * e.maxHp;
    if (!u.moved && !u.acted && u.hp < e.maxHp) heal += 0.1 * e.maxHp;
    u.hp = Math.min(e.maxHp, Math.round(u.hp + heal));
    u.mp = e.mov; u.at = e.attacks; u.hits = 0; u.moved = false; u.acted = false;
  }
  for (const c of g.cities) { c.crafts = 0; c.built = 0; }
}
function score(g, p) {
  let s = 0;
  for (const u of g.units) if (u.o === p.id) s += u.lv * 5;
  s += g.cities.filter(c => c.owner === p.id).length * 30;
  return s + p.stats.kills * 2 + p.stats.boss * 50 + p.stats.pk * 20;
}
/* ---------- modo Historia ---------- */
const storyUnits = g => g.units.filter(u => !isAux(u) && g.players[u.o] && g.players[u.o].alive);
function storyGoals(g) {
  const st = g.story, ch = S.STORY.chapters[st.ch];
  if (!ch) return [];
  const kills = g.players.reduce((a, p) => a + p.stats.kills, 0), us = storyUnits(g);
  return ch.goals.map(go => {
    let have = 0, need = go.n || 1;
    if (go.k === 'kills') have = kills - st.base;
    else if (go.k === 'cities') { need = Math.min(g.players.length + (go.extra || 0), g.cities.length); have = g.cities.filter(c => c.owner !== null && g.players[c.owner].alive).length; }
    else if (go.k === 'level') have = us.reduce((a, u) => Math.max(a, u.lv), 0);
    else if (go.k === 'tier') have = us.reduce((a, u) => Math.max(a, ...Object.values(u.eq).map(it => it.t || 0), 0), 0);
    else if (go.k === 'boss') have = st.killed[go.t] ? 1 : 0;
    else if (go.k === 'church') have = g.cities.reduce((a, c) => Math.max(a, c.owner !== null && g.players[c.owner].alive && c.b ? c.b.iglesia || 0 : 0), 0);
    else if (go.k === 'dungeon') have = (st.dg || 0) - (st.bdg || 0);
    return { txt: go.txt, have: Math.min(have, need), need, ok: have >= need };
  });
}
function storySpawn(g, ch) {
  if (!ch.boss) return;
  const maxLv = storyUnits(g).reduce((a, u) => Math.max(a, u.lv), 1), lv = Math.max(ch.lv[1], Math.min(ch.lv[2], maxLv + ch.lv[0]));
  spawnBoss(g, ch.boss, lv);
}
function storyStart(g) {
  for (const a of g.players) for (const b of g.players) if (a.id < b.id) g.dip[pkey(a.id, b.id)] = 'alianza';
  g.story = { ch: 0, base: 0, killed: {}, done: [] };
  ev(g, `📖 ${S.STORY.title}: ${S.STORY.intro}`, null, 'story');
  const c0 = S.STORY.chapters[0];
  ev(g, `📖 Capítulo 1 — ${c0.t}: ${c0.txt}`, null, 'story');
}
function storyTick(g) {
  const st = g.story; if (!st || g.status !== 'playing') return;
  const ch = S.STORY.chapters[st.ch];
  if (ch.boss && !st.killed[ch.boss] && !g.creatures.some(c => c.t === ch.boss)) storySpawn(g, ch); // el jefe del capítulo siempre debe existir
  if (!storyGoals(g).every(x => x.ok)) return;
  if (st.ch >= S.STORY.chapters.length - 1) { // final
    g.status = 'over';
    const alive = g.players.filter(p => p.alive);
    g.winners = alive.map(p => p.id); g.winner = alive.slice().sort((a, b) => score(g, b) - score(g, a))[0].id;
    st.done.push(st.ch); st.fin = true; touch(g);
    ev(g, `🏁 ¡Capítulo ${st.ch + 1} completado! ${S.STORY.outro}`, null, 'story');
    let said = 0; for (const b of alive.filter(x => x.bot)) if (said < 2) { botTalk(g, b, 'win', {}, true); said++; }
    return true;
  }
  const rw = ch.reward;
  if (rw) for (const p of g.players.filter(x => x.alive)) {
    const c = g.cities.filter(x => x.owner === p.id).sort((a, b) => (b.cap ? 1 : 0) - (a.cap ? 1 : 0))[0]; if (!c) continue;
    for (const k in rw.m) c.st.m[k] = (c.st.m[k] || 0) + rw.m[k];
    if (rw.w) c.st.it.push(rareItem(g, { w: rw.w }));
  }
  st.done.push(st.ch); st.ch++; st.base = g.players.reduce((a, p) => a + p.stats.kills, 0); st.bdg = st.dg || 0; touch(g);
  const nx = S.STORY.chapters[st.ch];
  ev(g, `📖 ¡Capítulo ${st.ch} completado! ${ch.done}${rw ? ' Cada capital recibe materiales y un objeto de botín.' : ''}`, null, 'story');
  ev(g, `📖 Capítulo ${st.ch + 1} — ${nx.t}: ${nx.txt}`, null, 'story');
  storySpawn(g, nx);
}
function storyInfo(g) {
  const st = g.story; if (!st) return null;
  const ch = S.STORY.chapters[Math.min(st.ch, S.STORY.chapters.length - 1)];
  return { n: S.STORY.chapters.length, ch: st.ch, fin: !!st.fin, title: ch.t, txt: ch.txt, goals: storyGoals(g), done: st.done.map(i => ({ t: S.STORY.chapters[i].t, txt: S.STORY.chapters[i].done || S.STORY.outro })), intro: S.STORY.intro, lost: !!st.lost };
}
/* ---------- mundo abierto ---------- */
function placeUnitsAround(g, c, owner, n, lv, armT) {
  const w = g.map.w, spots = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx || dy) spots.push({ x: c.x + dx, y: c.y + dy, d: Math.abs(dx) + Math.abs(dy) });
  spots.sort((a, b) => a.d - b.d || rng(g) - 0.5);
  const out = [];
  for (const s of spots) {
    if (out.length >= n) break;
    if (!inB(g, s.x, s.y) || !'gfhd'.includes(terrAt(g, s.x, s.y))) continue;
    const ix = idx(g);
    if (ix.U.has(s.y * w + s.x) || ix.T.has(s.y * w + s.x) || ix.C.has(s.y * w + s.x)) continue;
    const nu = newUnit(g, owner, s.x, s.y); out.push(nu);
    if (lv > 1) { nu.lv = lv; nu.pts = lv; }
    if (armT) for (const slot of ['casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas']) nu.eq[slot] = { id: g.nid++, k: slot, t: armT };
  }
  return out;
}
function spawnPlayer(g, p) { // nace en un lugar libre y lejos de los demás
  const w = g.map.w, h = g.map.h;
  let pos = null;
  for (let pass = 0; pass < 3 && !pos; pass++) {
    const minOwned = [18, 10, 6][pass], minNeutral = [7, 5, 3][pass];
    for (let t = 0; t < 600 && !pos; t++) {
      const x = ri(g, 5, w - 6), y = ri(g, 5, h - 6);
      if (!'gfhd'.includes(g.map.t.charAt(y * w + x))) continue;
      if (pass < 2 && regionIdx(g, x, y) > pass) continue; // los jugadores nuevos empiezan en las tierras seguras (o medias si están llenas)
      if (g.cities.some(c => cheb(c, { x, y }) < (c.owner !== null ? minOwned : minNeutral))) continue;
      pos = { x, y };
    }
  }
  if (!pos) return null;
  const base = g.cfg.biome === 'desierto' ? 'd' : 'g', arr = g.map.t.split('');
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const k = (pos.y + dy) * w + pos.x + dx; if (!'gfhd'.includes(arr[k])) arr[k] = base; }
  g.map.t = arr.join('');
  for (const c of g.creatures.slice()) if (cheb(c, pos) <= 8) removeCreature(g, c); // zona segura al llegar
  const city = { id: g.nid++, x: pos.x, y: pos.y, owner: p.id, name: 'Capital de ' + p.name, cap: true, st: { m: { cuero: 10, hueso: 8 }, it: [] }, crafts: 0 };
  g.cities.push(city); touch(g);
  p.ex = new Uint8Array(w * h);
  p.prot = g.turn + S.WORLD.prot; // protección de novato
  const nStart = Math.max(1, Math.min(14, g.cfg.startUnits | 0 || 4)), lvStart = Math.max(1, Math.min(20, g.cfg.startLevel | 0 || 1)), armT = ({ hierro: 2, acero: 3 })[g.cfg.startArmor] || 0;
  const us = placeUnitsAround(g, city, p.id, nStart, lvStart, armT);
  if (g.cfg.hero !== 'no' && us[0]) { us[0].hero = S.HERO.emb[0]; p.hero = us[0].id; }
  refreshUnits(g);
  return city;
}
function joinWorld(g, name, token) {
  if (g.cfg.mode !== 'mundo' || g.status !== 'playing') return null;
  const p = addPlayer(g, name, false, token, true);
  if (!p) return null;
  p.act = true;
  const c = spawnPlayer(g, p);
  if (!c) { g.players.pop(); return null; }
  ev(g, `🌱 ${p.name} ha llegado al mundo.`, null, 'sys');
  touch(g);
  return p;
}
function decayTick(g) { // las ciudades sin unidades de su dueño cerca vuelven a ser neutrales
  const N = Math.max(1, parseInt(g.cfg.decay, 10) || 24);
  for (const c of g.cities) {
    if (c.owner === null) { c.idle = 0; continue; }
    if (g.units.some(u => u.o === c.owner && cheb(u, c) <= 2)) { c.idle = 0; continue; }
    c.idle = (c.idle || 0) + 1;
    if (N > 4 && c.idle === N - 3) ev(g, `⚠️ ${c.name} quedará abandonada en 3 turnos si no llevas una unidad a ella.`, [c.owner], 'city');
    if (c.idle >= N) {
      const old = c.owner, was = c.name;
      unlinkCity(g, c); c.owner = null; c.idle = 0; c.crafts = 0; touch(g); // las mejoras se conservan
      c.name = c.cap ? 'Ruinas de ' + g.players[old].name : c.name; c.cap = false;
      c.st = { m: { cuero: ri(g, 2, 6), hueso: ri(g, 1, 5) }, it: [] };
      ev(g, `🏚️ ${was} fue abandonada y vuelve a ser neutral (${N} turnos sin unidades tuyas cerca).`, [old], 'city');
    }
  }
}
function respawnTick(g) { // un jugador sin unidades recibe unos refugiados para no quedarse bloqueado (no se puede reclutar)
  for (const p of g.players) {
    if (g.units.some(u => u.o === p.id && !isAux(u)) || (g.rv || []).some(r => r.o === p.id)) continue;
    const city = g.cities.filter(c => c.owner === p.id).sort((a, b) => (b.cap ? 1 : 0) - (a.cap ? 1 : 0))[0];
    if (city) { if (placeUnitsAround(g, city, p.id, 2, 1, 0).length) ev(g, `🌱 Dos refugiados se unen a ${city.name}: te habías quedado sin unidades.`, [p.id], 'sys'); }
    else if (spawnPlayer(g, p)) ev(g, `🌱 Empiezas de nuevo en un lugar libre del mundo: perdiste todas tus unidades y ciudades.`, [p.id], 'sys');
  }
}
/* ---------- tipos de final (modos Normal y Reto de una unidad) ---------- */
const victoryKind = g => (g.cfg.mode === 'normal' || g.cfg.mode === 'uno') ? (g.cfg.victory || 'ultimo') : 'ultimo';
function champLv(g, p) { return g.units.reduce((a, u) => (u.o === p.id && !isAux(u) && !u.bs) ? Math.max(a, u.lv) : a, 0); }
function domShare(g, p) { return g.cities.length ? g.cities.filter(c => c.owner === p.id).length / g.cities.length : 0; }
function victoryInfo(g) { // progreso hacia el final elegido (para el cliente)
  const k = victoryKind(g), V = S.VICTORY[k];
  if (k === 'ultimo' || !V) return null;
  const rows = g.players.filter(p => p.alive).map(p => ({ id: p.id, v: k === 'dominio' ? Math.round(domShare(g, p) * 100) : k === 'jefes' ? p.stats.boss : k === 'campeon' ? champLv(g, p) : k === 'puntos' ? score(g, p) : score(g, p) }));
  rows.sort((a, b) => b.v - a.v);
  const hold = g.vic && g.vic.hold ? { id: g.vic.hold.id, n: g.vic.hold.n } : null;
  return { k, goal: k === 'dominio' ? Math.round(V.pct * 100) : k === 'jefes' ? V.n : k === 'campeon' ? V.lv : k === 'puntos' ? V.pts : g.cfg.maxTurns, hold: hold, need: V.hold || 0, rows: rows.slice(0, 6) };
}
function victoryWin(g, p, text) {
  g.status = 'over'; g.winner = p.id; g.winners = null;
  ev(g, `🏁 ${text}`, null, 'sys');
  let said = 0; for (const b of g.players.filter(x => x.bot && x.alive)) if (said < 2) { botTalk(g, b, b.id === p.id ? 'win' : 'lose', {}, true); said++; }
  return true;
}
function victoryCheck(g) {
  const k = victoryKind(g), V = S.VICTORY[k];
  if (!V || k === 'ultimo' || k === 'tiempo') return false;
  g.vic = g.vic || {};
  const al = g.players.filter(p => p.alive);
  if (k === 'jefes') { const w = al.filter(p => p.stats.boss >= V.n).sort((a, b) => b.stats.boss - a.stats.boss || score(g, b) - score(g, a))[0]; if (w) return victoryWin(g, w, `¡${w.name} ha derrotado a ${w.stats.boss} jefes y gana la partida!`); }
  else if (k === 'campeon') { const w = al.filter(p => champLv(g, p) >= V.lv).sort((a, b) => champLv(g, b) - champLv(g, a))[0]; if (w) return victoryWin(g, w, `¡${w.name} ha llevado una unidad a nivel ${champLv(g, w)} y gana la partida!`); }
  else if (k === 'puntos') { const w = al.filter(p => score(g, p) >= V.pts).sort((a, b) => score(g, b) - score(g, a))[0]; if (w) return victoryWin(g, w, `¡${w.name} llega a ${score(g, w)} puntos y gana la partida!`); }
  else if (k === 'dominio') {
    const lead = al.slice().sort((a, b) => domShare(g, b) - domShare(g, a))[0];
    if (lead && domShare(g, lead) >= V.pct) {
      if (!g.vic.hold || g.vic.hold.id !== lead.id) { g.vic.hold = { id: lead.id, n: 0 }; ev(g, `⚠️ ${lead.name} controla el ${Math.round(domShare(g, lead) * 100)}% de las ciudades. Si lo mantiene ${V.hold} turnos, gana la partida.`, null, 'sys'); }
      else { g.vic.hold.n++; if (g.vic.hold.n < V.hold) ev(g, `⏳ ${lead.name} domina el mapa: ${g.vic.hold.n}/${V.hold} turnos.`, null, 'sys'); }
      if (g.vic.hold.n >= V.hold) return victoryWin(g, lead, `¡${lead.name} ha dominado el mapa ${V.hold} turnos y gana la partida!`);
    } else if (g.vic.hold) { const pr = g.players[g.vic.hold.id]; ev(g, `🛡️ Se ha roto el dominio de ${pr ? pr.name : 'un jugador'}: la cuenta vuelve a empezar.`, null, 'sys'); g.vic.hold = null; }
  }
  return false;
}
function checkEnd(g) {
  if (g.cfg.mode === 'mundo') return false; // el mundo abierto no termina
  for (const p of g.players) {
    if (!p.alive) continue;
    const units = g.units.filter(u => u.o === p.id && !isAux(u)).length;
    const cities = g.cities.filter(c => c.owner === p.id);
    const canRec = g.cfg.mode !== 'uno' && cities.some(c => isKing(g, p.id) ? Object.keys(S.KING.beasts).some(k => canAfford(c.st.m, beastCost(g, c, k))) : canAfford(c.st.m, recruitCost(g, p.id, c)));
    if (units === 0 && !canRec) {
      p.alive = false;
      for (const c of cities) { unlinkCity(g, c); c.owner = null; }
      g.props = g.props.filter(x => x.from !== p.id && x.to !== p.id);
      for (const k of Object.keys(g.dip)) { const [a, b] = k.split('-').map(Number); if (a === p.id || b === p.id) { delete g.dip[k]; delete g.brk[k]; } }
      ev(g, `☠️ ${p.name} ha sido eliminado.`, null, 'sys');
      if (p.bot) botTalk(g, p, 'elim', {}, true);
    }
  }
  if (g.cfg.mode === 'historia' && g.story) { // fin de la historia: victoria al completar el último capítulo, derrota si cae todo el grupo
    if (g.status === 'over') return true;
    const al = g.players.filter(p => p.alive);
    if (!al.length) { g.status = 'over'; g.story.lost = true; g.winner = g.players.slice().sort((a, b) => score(g, b) - score(g, a))[0].id; ev(g, `💀 ${S.STORY.lost}`, null, 'story'); return true; }
    if (!al.some(p => !p.bot) && !g.cfg.sim) { g.status = 'over'; g.story.lost = true; g.winner = al[0].id; ev(g, '🏁 Fin de la partida: no quedan jugadores humanos.', null, 'sys'); return true; }
    return false;
  }
  if (g.cfg.mode === 'equipos' && g.nTeams) { // fin por equipos: gana el último equipo con jugadores vivos
    const al = g.players.filter(p => p.alive), tm = new Set(al.map(p => p.team));
    if (tm.size <= 1) {
      g.status = 'over';
      const t = al.length ? al[0].team : 0, mem = g.players.filter(p => p.team === t);
      g.winners = mem.map(p => p.id); g.winner = mem.slice().sort((a, b) => score(g, b) - score(g, a))[0].id;
      ev(g, `🏁 Fin de la partida. ¡Gana el equipo ${S.TEAM_E[t]} ${t + 1}!: ${mem.map(p => p.name).join(', ')}.`, null, 'sys');
      const win = new Set(g.winners); let said = 0; for (const b of g.players.filter(x => x.bot && x.alive)) if (said < 2) { botTalk(g, b, win.has(b.id) ? 'win' : 'lose', {}, true); said++; }
      return true;
    }
    if (!al.some(p => !p.bot) && !g.cfg.sim) { g.status = 'over'; g.winner = al.slice().sort((a, b) => score(g, b) - score(g, a))[0].id; ev(g, '🏁 Fin de la partida: no quedan jugadores humanos.', null, 'sys'); return true; }
    return false;
  }
  if (g.cfg.mode === 'rey' && g.king !== undefined && g.king !== null) { // fin del reto del Rey Demonio
    const kp = g.players[g.king], rest = g.players.filter(p => p.alive && p.id !== g.king);
    if (!kp.alive || !rest.length) {
      g.status = 'over';
      if (!kp.alive) { g.winners = rest.map(p => p.id); g.winner = rest.sort((a, b) => score(g, b) - score(g, a))[0].id; ev(g, `🏁 ¡El Rey Demonio ${kp.name} ha caído! Victoria de la alianza: ${g.winners.map(i => g.players[i].name).join(', ')}.`, null, 'sys'); }
      else { g.winner = g.king; g.winners = null; ev(g, `🏁 ¡El Rey Demonio ${kp.name} ha derrotado a todos! Gana ${kp.name}.`, null, 'sys'); }
      const win = new Set(g.winners || [g.winner]); let said = 0; for (const b of g.players.filter(x => x.bot && x.alive)) if (said < 2) { botTalk(g, b, win.has(b.id) ? 'win' : 'lose', {}, true); said++; }
      return true;
    }
    if (!g.players.some(p => p.alive && !p.bot) && !g.cfg.sim) { g.status = 'over'; g.winner = kp.alive ? g.king : rest[0].id; ev(g, '🏁 Fin de la partida: no quedan jugadores humanos.', null, 'sys'); return true; }
    return false;
  }
  if (victoryCheck(g)) return true;
  const alive = g.players.filter(p => p.alive);
  const humans = alive.filter(p => !p.bot);
  const limit = g.cfg.maxTurns > 0 && g.turn >= g.cfg.maxTurns;
  const allied = alive.length > 1 && humans.length > 0 && alive.every(a => alive.every(b => a === b || pactOf(g, a.id, b.id) === 'alianza'));
  if (alive.length <= 1 || allied || (humans.length === 0 && !g.cfg.sim) || limit) {
    g.status = 'over';
    const pool = alive.length ? alive : g.players;
    g.winner = pool.slice().sort((a, b) => score(g, b) - score(g, a))[0].id;
    if (allied) { g.winners = alive.map(p => p.id); ev(g, `🏁 Fin de la partida. Victoria compartida de la alianza: ${alive.map(p => p.name).join(', ')}.`, null, 'sys'); }
    else ev(g, `🏁 Fin de la partida. Gana ${g.players[g.winner].name}.`, null, 'sys');
    { const win = new Set(g.winners || [g.winner]); let said = 0; for (const b of g.players.filter(x => x.bot && x.alive)) if (said < 2) { botTalk(g, b, win.has(b.id) ? 'win' : 'lose', {}, true); said++; } }
    return true;
  }
  return false;
}

/* ---------- eventos del mundo (v1.26): clima, torneos y mercaderes ambulantes ---------- */
function weatherTick(g) {
  if (evMode(g) === 'calma') { g.wx = null; return; }
  if (!g.wx) { g.wx = { k: 'sol', left: 2 }; return; }
  if (--g.wx.left > 0) return;
  const si = S.seasonIdx(g.turn);
  const k = wpick(g, S.WEATHER_ORDER.map(x => [x, S.WEATHER[x].w[si]]).filter(x => x[1] > 0)), prev = g.wx.k;
  g.wx = { k, left: ri(g, 2, 4) };
  if (k !== prev) { const W = S.WEATHER[k]; ev(g, `${W.e} ${W.n}: ${W.d}`, null, 'season'); }
}
function giveLoot(g, u, mats, item) { // lo que no cabe en la mochila va al almacén de la capital
  const lost = addMats(u, mats), home = tradeHome(g, u.o);
  for (const m in lost) if (home) home.st.m[m] = (home.st.m[m] || 0) + lost[m];
  if (item) { if (invW(u) + 2 <= capOf(u)) u.inv.it.push(item); else if (home) home.st.it.push(item); }
  return Object.keys(lost).length > 0 || (item && !u.inv.it.includes(item));
}
function tournTick(g) {
  if (evMode(g) !== 'todo' || g.cfg.mode === 'historia') { g.tourn = null; return; }
  const T = S.TOURN, t = g.tourn;
  if (t) { if (g.turn >= t.end) { tournResolve(g, t); g.tourn = null; } return; }
  if (g.turn >= T.first && (g.turn - T.first) % T.every === 0) {
    const pos = freeLandTile(g, 6, 5, 1) || freeLandTile(g, 4, 3, 0);
    if (!pos) return;
    g.tourn = { x: pos.x, y: pos.y, start: g.turn, end: g.turn + T.len };
    botAnyTalk(g, 'tn_new', {}, 0.5);
    ev(g, `🏟️ ¡Torneo! Se abre una arena ${dirText(g, pos)} del mapa (${pos.x}, ${pos.y}). Quien tenga la mejor unidad en la arena (o pegada a ella) dentro de ${T.len} turnos gana gemas, un objeto raro y experiencia.`, null, 'season');
  }
}
function tournResolve(g, t) {
  const rad = S.TOURN.radius;
  const ent = g.units.filter(u => !isAux(u) && !u.bs && cheb(u, t) <= rad);
  if (!ent.length) { ev(g, '🏟️ El torneo termina sin participantes: nadie se presentó en la arena.', null, 'season'); return; }
  const sc = u => { const e = eff(g, u); return u.lv * 10 + e.dmg + e.def + e.maxHp / 10 + rng(g) * 4; };
  const best = ent.map(u => ({ u, s: sc(u) })).sort((a, b) => b.s - a.s)[0].u, p = g.players[best.o];
  const gems = {}; for (let i = 0; i < 2; i++) { const k = rollGem(g, 0.7); gems[k] = (gems[k] || 0) + 1; }
  const item = rareItem(g, { w: [20, 35, 30, 12, 3] });
  const full = giveLoot(g, best, gems, item);
  const xp = 60 + 4 * best.lv; gainXp(g, best, xp);
  p.stats.tourn = (p.stats.tourn || 0) + 1;
  if (p.bot) botReact(g, 'tn_win', p, {}, 1); else botAnyTalk(g, 'tn_gz', { n: p.name }, 0.6);
  ev(g, `🏆 ¡${best.name} (nivel ${best.lv}) de ${p.name} gana el torneo entre ${ent.length} participante(s)! Premio: ${fmtMats(gems)}, ${S.itemName(item)} y ${xp} de experiencia${full ? ' (lo que no cupo en su mochila va al almacén de su capital)' : ''}.`, null, 'boss');
}
const MERCH_NAMES = ['Barnabás', 'Zora', 'Tibalt', 'Marisol', 'Hakim', 'Odalys', 'Fenwick', 'Lirio'];
function merchCap(g) { return g.cfg.mode === 'mundo' ? 1 + Math.floor(mapArea(g) / 5000) : Math.min(S.MERCH.max, 1 + Math.floor(g.players.length / 4)); }
function gemValue(k) { const m = S.MATS[k]; return m && m.gem ? [0, 5, 14, 40][m.lv] : 1; }
const MERCH_MARKUP = 1.3, MERCH_RISE = 1.1; // recargo del mercader y subida de precio de lo que queda tras cada venta
function merchOffers(g) {
  const pay = v => { v *= MERCH_MARKUP; return v <= 12 ? { hierro: Math.max(1, Math.ceil(v / 1.5)) } : { acero: Math.ceil(v / 3) }; };
  const o = [];
  const gk = rollGem(g, 0.5); o.push({ k: 'gem', give: { [gk]: 1 }, cost: pay(gemValue(gk)) });
  const gk2 = rollGem(g, 0.2); if (gk2 !== gk) o.push({ k: 'gem', give: { [gk2]: 1 }, cost: pay(gemValue(gk2)) });
  const bun = pick(g, [{ alma: 3 }, { escama: 1 }, { acero: 6 }, { alma: 2, acero: 2 }]); o.push({ k: 'mat', give: bun, cost: pay(tradeValue(bun)) });
  const it = rareItem(g, { w: [30, 40, 22, 7, 1] }); // objeto: precio según su valor de referencia (nivel de material + efectos), mitad en almas y mitad en acero
  const P = S.itemVal(it) * MERCH_MARKUP; o.push({ k: 'item', item: it, give: {}, cost: { alma: Math.max(1, Math.ceil(P * 0.5 / 4)), acero: Math.max(1, Math.ceil(P * 0.5 / 3)) } });
  o.push({ k: 'map', give: {}, cost: { hierro: 8 } });
  return o;
}
function merchRise(mer) { // cada venta encarece un 10% lo que queda (no se puede vaciar el carro a precio base)
  for (const q of mer.offers) if (!q.sold) for (const m in q.cost) q.cost[m] = Math.max(q.cost[m] + 1, Math.ceil(q.cost[m] * MERCH_RISE));
}
function merchTick(g) {
  g.merch = g.merch || [];
  if (evMode(g) !== 'todo') { g.merch = []; return; }
  for (const m of g.merch.slice()) {
    if (g.turn >= m.until) { g.merch.splice(g.merch.indexOf(m), 1); ev(g, `🛒 ${m.name} recoge su carro y se marcha.`, null, 'season'); continue; }
    if (rng(g) < 0.6) { // deambula
      const [dx, dy] = pick(g, S.DIRS), x = m.x + dx, y = m.y + dy, k = y * g.map.w + x, ix = idx(g);
      if (inB(g, x, y) && 'gfhd'.includes(terrAt(g, x, y)) && !ix.U.has(k) && !ix.C.has(k) && !ix.T.has(k)) { m.x = x; m.y = y; }
    }
  }
  if (g.turn % S.MERCH.every === S.MERCH.offset && g.merch.length < merchCap(g)) {
    const pos = freeLandTile(g, 5, 4, 0) || freeLandTile(g, 3, 3, 1);
    if (pos) {
      const m = { id: g.nid++, x: pos.x, y: pos.y, name: pick(g, MERCH_NAMES), until: g.turn + S.MERCH.stay, offers: merchOffers(g) };
      g.merch.push(m);
      ev(g, `🛒 Llega un mercader ambulante, ${m.name}, ${dirText(g, pos)} del mapa (${pos.x}, ${pos.y}). Se queda ${S.MERCH.stay} turnos, pero deambula. Pon una unidad a su lado y toca el 🛒 para comprar.`, null, 'season');
    }
  }
}
function offerText(o) { const a = []; if (o.item) a.push(S.itemName(o.item)); if (Object.keys(o.give).length) a.push(fmtMats(o.give)); if (o.k === 'map') a.push('mapa de un cofre cercano'); return a.join(' + '); }
function doMerch(g, p, m) {
  const mer = (g.merch || []).find(x => x.id === (m.id | 0));
  if (!mer) return 'Ese mercader ya no está';
  const u = g.units.find(x => x.id === (m.u | 0) && x.o === p.id && !isAux(x));
  if (!u) return 'Elige una de tus unidades junto al mercader';
  if (cheb(u, mer) > 1) return 'Tu unidad debe estar al lado del mercader';
  const o = mer.offers[m.i | 0];
  if (!o) return 'Oferta no válida';
  if (o.sold) return 'Eso ya está vendido';
  if (!canAfford(u.inv.m, o.cost)) return `${u.name} no lleva lo necesario: ${fmtMats(o.cost)}. Pagas con lo que lleva la unidad en la mochila`;
  const pay = Object.values(o.cost).reduce((a, b) => a + b, 0), get = Object.values(o.give).reduce((a, b) => a + b, 0) + (o.item ? 2 : 0);
  if (o.k !== 'map' && invW(u) - pay + get > capOf(u)) return 'No te cabe en la mochila';
  spend(u.inv.m, o.cost);
  if (o.k === 'map') {
    let pos = null;
    for (let t = 0; t < 60 && !pos; t++) { const x = u.x + ri(g, -9, 9), y = u.y + ri(g, -9, 9), k = y * g.map.w + x, ix = idx(g); if (inB(g, x, y) && 'gfhd'.includes(terrAt(g, x, y)) && !ix.U.has(k) && !ix.C.has(k) && !ix.T.has(k) && !g.sites.some(q => q.x === x && q.y === y) && cheb(u, { x, y }) >= 3) pos = { x, y }; }
    if (!pos) { for (const c in o.cost) u.inv.m[c] = (u.inv.m[c] || 0) + o.cost[c]; return 'El mercader no encuentra ningún sitio cercano: prueba en otro momento'; }
    g.sites.push({ id: g.nid++, x: pos.x, y: pos.y, k: 'cofre' }); o.sold = true; merchRise(mer); touch(g);
    return { msg: `🗺️ Mapa del tesoro: hay un cofre en (${pos.x}, ${pos.y}).` };
  }
  addMats(u, o.give); if (o.item) u.inv.it.push(o.item);
  o.sold = true; merchRise(mer);
  return { msg: `Comprado: ${offerText(o)}` };
}
/* ---------- crías: dos unidades juntas cerca de una ciudad ---------- */
const BREED_NEED = { tres: 3, cinco: 5 };
function breedTick(g) {
  const need = BREED_NEED[g.cfg.breed];
  g.pairs = g.pairs || {};
  if (!need) { g.pairs = {}; return; }
  const near = u => g.cities.some(c => c.owner === u.o && cheb(u, c) <= 2);
  const ok = u => u.hp >= eff(g, u).maxHp * 0.5 && (u.bc || 0) <= g.turn && near(u);
  const seen = {}, used = new Set(), next = {};
  const list = g.units.filter(u => !isAux(u) && !u.bs && ok(u));
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.o !== b.o || cheb(a, b) !== 1 || used.has(a.id) || used.has(b.id)) continue;
    used.add(a.id); used.add(b.id);
    const key = Math.min(a.id, b.id) + '-' + Math.max(a.id, b.id);
    let n = Math.min(need, (g.pairs[key] || 0) + 1);
    if (n >= need) {
      if (g.units.filter(u => u.o === a.o && !isAux(u)).length >= BREED_MAX) { next[key] = n; continue; } // espera a que haya sitio
      const ix = idx(g); let spot = null;
      for (const p of [a, b]) for (let r = 1; r <= 2 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
        const x = p.x + dx, y = p.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inB(g, x, y)) continue;
        const k = y * g.map.w + x;
        if (!'gfhd'.includes(terrAt(g, x, y)) || ix.U.has(k) || ix.C.has(k) || ix.T.has(k)) continue;
        spot = { x, y };
      }
      if (!spot) { next[key] = n; continue; }
      const kid = newUnit(g, a.o, spot.x, spot.y);
      const pb = x => (x.bn || { hp: 0, dmg: 0 }); // la cría hereda lo mejor de sus padres y suma el bonus de nacimiento: cada generación es más fuerte
      kid.bn = { hp: Math.max(pb(a).hp, pb(b).hp) + BREED_BONUS.hp, dmg: Math.max(pb(a).dmg, pb(b).dmg) + BREED_BONUS.dmg };
      kid.gen = Math.max(a.gen || 0, b.gen || 0) + 1; kid.bc = g.turn + BREED_WAIT; kid.born = g.turn;
      { const L = Math.max(1, Math.min(S.MAX_LEVEL || 53, Math.round(((a.lv || 1) + (b.lv || 1)) / 2))); kid.lv = L; kid.pts = L; } // nace con el nivel promedio de sus padres
      kid.hp = eff(g, kid).maxHp; kid.moved = true; kid.acted = true; kid.mp = 0; kid.at = 0;
      a.bc = b.bc = g.turn + BREED_WAIT;
      ev(g, `👶 ${a.name} y ${b.name} tienen una cría: ${kid.name} (generación ${kid.gen}, nivel ${kid.lv}, +${kid.bn.hp} salud y +${kid.bn.dmg} daño de nacimiento).`, [a.o], 'birth');
      continue; // el contador de la pareja se reinicia
    }
    next[key] = n;
  }
  g.pairs = next;
}

/* ---------- chat de la partida ---------- */
const CHAT_KEEP = 80, CHAT_SHOW = 60;
/* ---------- bots que hablan ---------- */
function pushChat(g, pid, x, bot) {
  g.chat.push({ id: ++g.cid, p: pid, x, tu: g.turn, ts: Date.now(), al: 0, bot: bot ? 1 : 0 });
  if (g.chat.length > CHAT_KEEP) g.chat.splice(0, g.chat.length - CHAT_KEEP);
}
function botTalk(g, bot, key, vars, force) { // force: respuesta directa (sin límites de frecuencia)
  if (g.cfg.botChat !== 'si' || !bot || !bot.bot || g.status === 'lobby') return false;
  if (!force) {
    if (g._bt && g._bt.t === g.turn && g._bt.n >= 2) return false; // máx. 2 comentarios espontáneos por turno
    if (bot._bc !== undefined && g.turn - bot._bc < 3) return false; // y cada bot calla unos turnos entre comentarios
    g._bt = g._bt && g._bt.t === g.turn ? g._bt : { t: g.turn, n: 0 }; g._bt.n++; bot._bc = g.turn;
  }
  pushChat(g, bot.id, BC.line(bot.pers || 'equilibrado', key, () => rng(g), vars, g.turn), true);
  touch(g);
  return true;
}
function botReplies(g, pid, text, allies) { // un bot contesta si lo nombras («Morgana, ...») o dices «bots»
  if (g.cfg.botChat !== 'si') return;
  const from = g.players[pid];
  const bots = g.players.filter(b => b.bot && b.alive && (!allies || pactOf(g, pid, b.id) === 'alianza'));
  let who = bots.filter(b => BC.addressed(text, b.name));
  if (!who.length && BC.mentionsBots(text) && bots.length) who = [bots[Math.floor(rng(g) * bots.length)]];
  const it = BC.intent(text);
  for (const b of who.slice(0, 2)) {
    let key = it;
    if (it === 'paz') {
      const recent = b.wr && b.wr[pid] !== undefined && g.turn - b.wr[pid] <= 6;
      key = pactOf(g, pid, b.id) ? 'paz_ya' : recent ? 'paz_no' : 'paz_si';
    }
    const mm = botMem(b, pid); if (['hola', 'estado', 'otro', 'gracias'].includes(key)) { if (mm.gr >= 4) key = 'rencor'; else if (mm.fv >= 4) key = 'leal'; }
    botTalk(g, b, key, { n: from.name }, true);
  }
}
function botReact(g, key, bot, vars, prob) { if (bot && bot.bot && bot.alive !== false && rng(g) < prob) botTalk(g, bot, key, vars, false); }
function botAnyTalk(g, key, vars, prob) { const bs = g.players.filter(b => b.bot && b.alive); if (bs.length && rng(g) < prob) botTalk(g, bs[Math.floor(rng(g) * bs.length)], key, vars, false); }
function chat(g, pid, text, allies) {
  if (g.status === 'lobby') return 'El chat se abre cuando empieza la partida';
  const p = g.players[pid];
  if (!p || p.bot) return 'No puedes escribir en el chat';
  const x = String(text === undefined || text === null ? '' : text).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!x) return 'Escribe un mensaje';
  const now = Date.now();
  p._ct = (p._ct || []).filter(t => now - t < 10000);
  if (p._ct.length >= 5) return 'Estás escribiendo muy rápido: espera unos segundos';
  p._ct.push(now);
  g.chat.push({ id: ++g.cid, p: pid, x, tu: g.turn, ts: now, al: allies ? 1 : 0 });
  if (g.chat.length > CHAT_KEEP) g.chat.splice(0, g.chat.length - CHAT_KEEP);
  try { botReplies(g, pid, x, !!allies); } catch (e) { console.error('bot chat', e.message); }
  return null;
}
const chatFor = (g, pid) => (g.chat || []).filter(m => !m.al || m.p === pid || pactOf(g, m.p, pid) === 'alianza').slice(-CHAT_SHOW);

/* ---------- protagonista ---------- */
function reviveTick(g) {
  if (!g.rv || !g.rv.length) return;
  const left = [];
  for (const r of g.rv) {
    const p = g.players[r.o];
    if (!p || !p.alive) continue;
    if (r.due > g.turn + 1) { left.push(r); continue; } // el tick ocurre antes de pasar al turno siguiente
    const cs = g.cities.filter(c => c.owner === r.o).sort((a, b) => (b.cap ? 1 : 0) - (a.cap ? 1 : 0) + (r.city ? (b.id === r.city ? 2 : 0) - (a.id === r.city ? 2 : 0) : 0));
    if (!cs.length) { left.push(r); continue; } // sin ciudad no puede volver
    const ix = idx(g); let spot = null; const c0 = cs[0];
    for (let d = 1; d <= 3 && !spot; d++) for (let dy = -d; dy <= d && !spot; dy++) for (let dx = -d; dx <= d && !spot; dx++) {
      const x = c0.x + dx, y = c0.y + dy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== d || !inB(g, x, y)) continue;
      const k = y * g.map.w + x;
      if (!'gfhd'.includes(terrAt(g, x, y)) || ix.U.has(k) || ix.C.has(k) || ix.T.has(k)) continue;
      spot = { x, y };
    }
    if (!spot) { left.push(r); continue; }
    const u = newUnit(g, r.o, spot.x, spot.y);
    if (r.keep) { u.eq = r.keep.eq; u.inv = r.keep.inv; }
    if (r.bs) u.bs = r.bs;
    u.name = r.name; u.hero = r.emb; u.cls = r.cls; u.sub = r.sub; u.bn = r.bn; u.gen = r.gen || 0; u.sk = r.sk; u.lv = r.lv; u.pts = r.pts; u.xp = 0;
    for (let i = 0; i < (r.emb ? S.HERO.loss : 1) && u.lv > 1; i++) { // pierde niveles: primero puntos sin gastar, luego habilidades
      u.lv--;
      if (u.pts > 0) u.pts--; else { const k = Object.keys(u.sk).sort((a, b) => u.sk[b] - u.sk[a])[0]; if (u.sk[k] > 0) u.sk[k]--; }
    }
    u.hp = eff(g, u).maxHp; u.mp = 0; u.at = 0; u.moved = true; u.acted = true;
    if (r.emb) p.hero = u.id;
    ev(g, `${u.hero || '🪦'} ¡${u.name} regresa a ${c0.name} (nivel ${u.lv})!`, [r.o], 'lvl');
  }
  g.rv = left;
}
function advanceTurn(g) {
  if (g.status !== 'playing') return;
  g._dm = {};
  const lim = g.cfg.mode === 'mundo' ? 0 : g.cfg.idleTurns === undefined ? 2 : g.cfg.idleTurns;
  for (const p of g.players) {
    if (!p.alive || p.bot) continue;
    if (p.act) p.idle = 0; else p.idle = (p.idle || 0) + 1;
    p.act = false;
    if (lim > 0 && !p.auto && p.idle >= lim) {
      p.auto = true;
      ev(g, `🤖 ${p.name} lleva ${p.idle} turnos sin aparecer: un bot dirige su ejército hasta que vuelva.`, null, 'sys');
    }
  }
  botDiplomacy(g); tradeTick(g);
  for (const p of g.players) if (p.alive && (p.bot || p.auto)) { try { botTurn(g, p); } catch (e) { console.error('bot error', e); } }
  angelsTurn(g);
  creaturesTurn(g);
  worldTick(g);
  try { breedTick(g); reviveTick(g); } catch (e) { console.error('breed/revive error', e); }
  try { storyTick(g); } catch (e) { console.error('story error', e); }
  if (g.cfg.mode === 'mundo') { try { decayTick(g); respawnTick(g); wbTick(g); } catch (e) { console.error('world error', e); } }
  if (checkEnd(g)) { g.dirty = true; return; }
  g.turn++;
  recordHist(g);
  refreshUnits(g);
  runOrders(g);
  for (const p of g.players) p.ready = false;
  g.endsAt = Date.now() + g.cfg.turnHours * 3600000;
  ev(g, `— Turno ${g.turn} —`, null, 'turn');
  if (g.turn > 1 && (g.turn - 1) % S.SEASON_LEN === 0) { const se = S.SEASONS[S.seasonIdx(g.turn)]; ev(g, `${se.e} Llega ${se.lead}. ${se.d}`, null, 'season'); }
  try { weatherTick(g); tournTick(g); merchTick(g); dgTick(g); } catch (e) { console.error('events error', e); }
  g.dirty = true;
}

/* ---------- bots ---------- */
const BOT_LV = {
  facil:   { need: 1.7, recruit: 5, tier: 2, ench: false, flat: true },
  normal:  { need: 1,   recruit: 8, tier: 4, ench: false, flat: false },
  dificil: { need: 0.8, recruit: 11, tier: 4, ench: true, flat: false },
};
function botCfg(g, p) {
  const pers = p.auto ? 'granjero' : (p.pers || 'equilibrado');
  let pb = (S.PERS[pers] || S.PERS.equilibrado).b;
  const mood = p.bot ? botMood(g, p) : null; // adaptación: cauto si va perdiendo, ambicioso si domina
  if (mood === 'cauto') pb = Object.assign({}, pb, { al: pb.al === 'always' ? 'recent' : pb.al, need: pb.need * 1.25, uVal: pb.uVal * 0.8, cityVal: pb.cityVal - 8, paz: Math.min(1, pb.paz + 0.3), ali: Math.min(1, pb.ali + 0.2) });
  else if (mood === 'ambicioso') pb = Object.assign({}, pb, { al: pb.al === 'always' ? 'always' : pb.al === 'recent' ? 30 : Math.min(pb.al, 30), need: pb.need * 0.85, cityVal: pb.cityVal + 10, paz: pb.paz * 0.5 });
  return { pers, pb, lv: BOT_LV[g.cfg.botLevel] || BOT_LV.normal, mood };
}
function botPickSkill(u) {
  const w = ROLE_W[u.role] || ROLE_W.frontal;
  const tab = [];
  for (const s of S.SKILL_ORDER) if (u.sk[s] < S.SKILLS[s].cap) tab.push([s, (w[s] || 0.2) * (1 + 0.3 * u.sk[s])]);
  return tab.length ? tab : null;
}
function ehp(hp, def) { return hp / (1 - def / (def + 60)); }
function botGear(g, p, c, u) {
  if (!u.role || !u.pref) return;
  const maxT = botCfg(g, p).lv.tier;
  const slots = ['arma', 'pechera', 'casco', 'pantalones', 'escudo', 'botas', 'hombreras', 'guantes'];
  const sc = it => it.t * 10 + (it.r || 0) * 4;
  for (const slot of slots) {
    let kinds;
    if (slot === 'arma') kinds = [u.pref];
    else if (slot === 'escudo') { if (!(u.role === 'frontal' || u.role === 'tanque') || (u.eq.arma && K[u.eq.arma.k].two) || K[u.pref].two) continue; kinds = ['escudo']; }
    else kinds = [slot];
    const curIt = u.eq[slot], cur = curIt ? curIt.t : 0, curS = curIt ? sc(curIt) : 0;
    const have = c.st.it.filter(it => kinds.includes(it.k) && (it.r || it.t <= maxT) && sc(it) > curS).sort((a, b) => sc(b) - sc(a))[0];
    let item = have;
    if (!item && c.crafts < cityCrafts(c)) {
      for (let t = maxT; t > cur; t--) {
        if (canAfford(c.st.m, S.recipe(kinds[0], t))) { const r = doCraft(g, p, c, kinds[0], t); if (typeof r !== 'string') item = r; break; }
      }
    }
    if (item) {
      const i = c.st.it.indexOf(item);
      if (i >= 0) { c.st.it.splice(i, 1); u.inv.it.push(item); doEquip(g, u, item.id); }
    }
  }
}
function botManage(g, p) {
  for (const u of g.units.filter(x => x.o === p.id && !x.sm && x.cls && S.CLASSES[x.cls].summons)) { // invocadores y nigromantes
    if (summonsOf(g, p.id).length >= S.SUMMON.max) break;
    const k = S.CLASSES[u.cls].summons[Math.floor(rng(g) * S.CLASSES[u.cls].summons.length)];
    const c = summonCity(g, u);
    if (c && (c.st.m.hueso || 0) >= holyCost(c, S.SUMMON.cost[k]).hueso + 6) doSummon(g, u, k);
  }
  const bc = botCfg(g, p);
  const cap = bc.lv.recruit + bc.pb.rec + (isKing(g, p.id) ? 3 : 0);
  for (const c of g.cities.filter(c => c.owner === p.id)) {
    const near = g.units.filter(u => u.o === p.id && cheb(u, c) <= 1);
    for (const u of near) depositAll(g, u, c);
    if (bc.lv.ench && (c.st.m.alma || 0) >= 3) { // los bots difíciles encantan su mejor equipo
      const it = c.st.it.filter(x => x.t >= 3 && (x.fx || []).length < 2).sort((a, b) => b.t - a.t)[0];
      if (it) doEnchant(g, c, it.id, null);
    }
    for (const gk of Object.keys(c.st.m).filter(k => S.gemOf(k))) { // los bots engastan sus gemas en lo mejor que tengan con engarces libres
      const it = c.st.it.filter(x => x.so && (x.gm || []).filter(Boolean).length < x.so).sort((a, b) => b.t - a.t)[0];
      if (it && c.crafts < cityCrafts(c)) doGem(g, c, it.id, gk);
    }
    if (bc.lv.ench && (c.st.m.acero || 0) >= 4) { const it = c.st.it.filter(x => x.t >= 3 && (x.so || 0) < 2).sort((a, b) => b.t - a.t)[0]; if (it) doSocket(g, c, it.id); }
    for (const u of near) if (!u.bs) botGear(g, p, c, u);
    for (const u of near) { // sobrante de objetos desequipados vuelve al almacén
      for (const it of u.inv.it) c.st.it.push(it);
      u.inv.it = [];
    }
    if (bc.lv !== BOT_LV.facil && g.turn >= 6) {
      const order = bc.pb.order.filter((k, i2, a2) => a2.indexOf(k) === i2).concat(['cuartel', 'herreria', 'muralla', 'iglesia', 'atalaya']).concat(g.cities.filter(x => x.owner === p.id).length >= 2 ? ['taller'] : []).concat(siegeOn(g) && p.aggr && g.turn >= 8 ? ['asedio'] : []).filter((k, i2, a2) => a2.indexOf(k) === i2);
      for (const k of order) {
        const lv = (c.b && c.b[k]) || 0; if (lv >= S.bMax(k)) continue;
        const cost = S.BUILDINGS[k].cost[lv];
        if (canAfford(c.st.m, Object.assign({}, cost, { hierro: (cost.hierro || 0) + 6 }))) { doBuild(g, p, c, k); break; }
      }
    }
    if (c.b && c.b.taller && !builderOf(g, c) && canAfford(c.st.m, Object.assign({}, S.BUILDER.cost, { hierro: S.BUILDER.cost.hierro + 12, cuero: S.BUILDER.cost.cuero + 8 }))) doBuilder(g, p, c);
    const n = g.units.filter(u => u.o === p.id && !isAux(u)).length;
    { const gr = (g.graves || []).filter(x => x.o === p.id).sort((a2, b2) => b2.lv - a2.lv)[0]; if (gr && n < cap && typeof doRevive(g, p, c, gr.id) !== 'string') continue; } // resucita a sus caídos antes de reclutar
    if (n < cap && g.turn >= 2) doRecruit(g, p, c);
  }
}
function botBuilder(g, p, u) { // el constructor de un bot: une sus ciudades con carretera y levanta estaciones de suministros
  const home = g.cities.find(x => x.id === u.bld.c); if (!home) return;
  const mine = g.cities.filter(x => x.owner === p.id);
  const lacks = mine.filter(x => !stationNear(g, x));
  const k = u.y * g.map.w + u.x, onRoad = g.rd && g.rd[k] === 1;
  const nc = mine.find(x => cheb(x, u) <= 3 && !stationNear(g, x));
  if (home.b && home.b.taller >= 2 && onRoad && nc && canAfford(home.st.m, Object.assign({}, S.BUILDER.station, { hierro: S.BUILDER.station.hierro + 4 }))) doStation(g, p, u);
  else if (!(g.rd && g.rd[k]) && canAfford(home.st.m, Object.assign({}, S.BUILDER.road, { hierro: 6 }))) doRoad(g, p, u);
  if (!(home.b && home.b.taller >= 2) || mine.length < 2) return;
  const target = (lacks.filter(x => x !== nc).sort((a, b) => cheb(a, u) - cheb(b, u))[0]) || null;
  if (!target || cheb(target, u) <= 2 || u.mp <= 0) return;
  const r = S.reach(envFor(g, u), u.x, u.y, u.mp); let best = null;
  for (const [key, e] of r) { if (!e.end || key === k) continue; const x = key % g.map.w, y = (key / g.map.w) | 0; if (cheb(u, { x, y }) !== 1) continue; const d = cheb(target, { x, y }) + (g.rd && g.rd[key] ? -0.4 : 0); if (!best || d < best.d) best = { x, y, d }; }
  if (best && best.d < cheb(target, u)) doMove(g, u, best.x, best.y);
}
function distMap(g, tx, ty) {
  const key = tx + ',' + ty;
  g._dm = g._dm || {};
  if (g._dm[key]) return g._dm[key];
  const w = g.map.w, h = g.map.h, t = g.map.t;
  const dm = new Float32Array(w * h).fill(1e9);
  dm[ty * w + tx] = 0;
  const heap = [[0, tx, ty]];
  const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const pi = (i - 1) >> 1; if (heap[pi][0] <= heap[i][0]) break; [heap[pi], heap[i]] = [heap[i], heap[pi]]; i = pi; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [c, x, y] = pop();
    if (c > dm[y * w + x]) continue;
    for (const [dx, dy] of S.DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const tc = S.TERR[t.charAt(ny * w + nx)].c;
      if (tc >= 99) continue;
      const nc = c + tc;
      if (nc < dm[ny * w + nx]) { dm[ny * w + nx] = nc; push([nc, nx, ny]); }
    }
  }
  const keys = Object.keys(g._dm);
  if (keys.length > 60) delete g._dm[keys[0]];
  g._dm[key] = dm;
  return dm;
}
function headTo(g, u, tx, ty) {
  if (u.mp <= 0) return;
  const w = g.map.w, dm = distMap(g, tx, ty);
  const r = S.reach(envFor(g, u), u.x, u.y, u.mp);
  let best = null, cur = dm[u.y * w + u.x];
  for (const [k, v] of r) {
    if (!v.end) continue;
    const d = dm[k];
    if (d >= cur) continue;
    if (!best || d < best.d || (d === best.d && v.c < best.c)) best = { k, d, c: v.c };
  }
  if (best) doMove(g, u, best.k % w, (best.k - (best.k % w)) / w);
}
function squadPower(g, units) {
  let dpt = 0, hp = 0;
  for (const u of units) { const e = eff(g, u); dpt += e.dmg * e.attacks; hp += ehp(u.hp, e.def); }
  return { dpt, hp, pw: dpt * hp };
}
function botTarget(g, p, squad) {
  p._ok = new Set();
  if (!squad.length) return null;
  const bc = botCfg(g, p), pb = bc.pb;
  const recent = o => p.wr && p.wr[o] !== undefined && g.turn - p.wr[o] <= 8;
  const allow = o => { // ¿puede este bot atacar a ese jugador?
    if (p.auto && g.cfg.mode !== 'rey') return false;
    if (pactOf(g, p.id, o)) return false;
    if (g.cfg.mode === 'equipos') return true; // otros equipos: siempre enemigos
    if (g.cfg.mode === 'rey' && (o === g.king || p.id === g.king)) return true; // el Rey Demonio y sus enemigos siempre están en guerra
    { const mm = botMem(p, o); if (mm.fv >= 6 && mm.gr < 2) return false; if (mm.gr >= 4) return true; }
    if (pb.al === 'recent') return recent(o);
    if (pb.al === 'always') return true;
    return p.aggr || g.turn > pb.al;
  };
  const need = bc.lv.need * pb.need;
  const sq = squadPower(g, squad);
  let cx = 0, cy = 0; for (const u of squad) { cx += u.x; cy += u.y; }
  const cen = { x: Math.round(cx / squad.length), y: Math.round(cy / squad.length) };
  let best = null;
  const consider = (cand, value, dist) => { const s = value / (dist + 4); if (!best || s > best.s) best = { s, ...cand }; };
  for (const c of g.creatures) {
    if (c.dg) continue; // las de mazmorra las gestiona botDgInside
    const d = cheb(c, cen); if (d > 18) continue;
    const cs = cstats(c, g), cd = S.CREATURES[c.t];
    const power = cs.dmg * ehp(cs.mhp, cs.def);
    const nd = (cd.boss ? 2.2 : 1.3) * bc.lv.need * pb.cNeed;
    if (sq.pw < nd * power) continue;
    p._ok.add(c.id);
    let val = 10 + 4 * c.lv + (cd.boss ? 60 : 0) + cd.xp * 0.5 + (c.el ? 25 : 0) + (c.tg ? 15 : 0);
    val *= pb.cVal * (cd.boss ? pb.bVal : 1);
    consider({ x: c.x, y: c.y, ty: 'c' }, val, d);
  }
  for (const c of g.cities) {
    if (c.owner === p.id) continue;
    const d = cheb(c, cen);
    if (c.owner === null) consider({ x: c.x, y: c.y, ty: 'city' }, pb.nCity, d);
    else if (allow(c.owner)) {
      const defenders = g.units.filter(u => u.o === c.owner && cheb(u, c) <= 3);
      const dp = squadPower(g, defenders);
      if (sq.pw > 1.3 * need * dp.pw) consider({ x: c.x, y: c.y, ty: 'city' }, pb.cityVal, d);
    }
  }
  for (const o of g.units) {
    if (o.o === p.id || !allow(o.o)) continue;
    const d = cheb(o, cen); if (d > 12) continue;
    const near = g.units.filter(v => v.o === o.o && cheb(v, o) <= 3);
    const op = squadPower(g, near);
    if (sq.pw > 1.3 * need * op.pw) { p._ok.add('u' + o.id); consider({ x: o.x, y: o.y, ty: 'u' }, (38 + o.lv * 2) * pb.uVal, d); }
  }
  return best;
}
function bestAttack(g, p, u, e) {
  const w = g.map.w;
  const r = S.reach(envFor(g, u), u.x, u.y, u.mp);
  const reachRange = u.mp + e.range + 1;
  const targets = [];
  for (const c of g.creatures) if (cheb(c, u) <= reachRange && p._ok.has(c.id)) {
    const cs = cstats(c, g);
    targets.push({ tt: 'c', ref: c, x: c.x, y: c.y, hp: c.hp, def: cs.def + terrDef(g, c.x, c.y), boss: !!S.CREATURES[c.t].boss });
  }
  for (const o of g.units) if (o.o !== p.id && cheb(o, u) <= reachRange && p._ok.has('u' + o.id)) {
    targets.push({ tt: 'u', ref: o, x: o.x, y: o.y, hp: o.hp, def: eff(g, o).def + terrDef(g, o.x, o.y), boss: false });
  }
  if (!targets.length) return null;
  const threats = [];
  for (const c of g.creatures) { const cs = cstats(c, g); if (cs.agg > 0 || c.prov) threats.push({ x: c.x, y: c.y, dmg: cs.dmg }); }
  let best = null;
  for (const [k, v] of r) {
    const isStart = k === u.y * w + u.x;
    if (!isStart && !v.end) continue;
    const x = k % w, y = (k - x) / w;
    let danger = 0;
    for (const th of threats) if (cheb(th, { x, y }) <= 2) danger += th.dmg;
    for (const t of targets) {
      const d = cheb({ x, y }, t);
      if (d < e.min || d > e.range) continue;
      const raw = e.dmg * (u.hits === 0 ? 1 : 0.6) * ((e.range > 1 && !e.reach && d === 1) ? 0.6 : 1);
      const dmg = calcDamage(raw, t.def, e.pierce);
      const kill = dmg >= t.hp;
      const s = (kill ? 60 : 0) + dmg - 0.4 * (danger / Math.max(1, u.hp)) * 10 + (e.range > 1 ? d * 2 : 0) - v.c * 0.3;
      if (!best || s > best.s) best = { s, x, y, t, isStart };
    }
  }
  return best;
}
function botUnit(g, p, u, target, solo) {
  if (!g.units.includes(u)) return;
  const w = g.map.w;
  let e = eff(g, u);
  let home = null, hd = 1e9;
  for (const c of g.cities) if (c.owner === p.id) { const d = cheb(c, u); if (d < hd) { hd = d; home = c; } }
  if (home && u.hp / e.maxHp < 0.5) { if (hd > 1) headTo(g, u, home.x, home.y); return; }
  if (home && invW(u) >= 14) { if (hd > 1) headTo(g, u, home.x, home.y); return; }
  for (let i = 0; i < 2; i++) {
    if (!g.units.includes(u) || u.at <= 0) break;
    e = eff(g, u);
    const b = bestAttack(g, p, u, e);
    if (!b) break;
    if (!b.isStart) { if (doMove(g, u, b.x, b.y)) break; }
    const r = doAttack(g, u, b.t.tt, b.t.ref.id);
    if (typeof r === 'string') break;
  }
  if (!g.units.includes(u)) return;
  if (u.at < eff(g, u).attacks) return; // ya atacó este turno
  const cen = p._cen;
  if (!solo && cen && cheb(u, cen) > 5) { headTo(g, u, cen.x, cen.y); return; }
  if (target) headTo(g, u, target.x, target.y);
  else if (home && hd > 3) headTo(g, u, home.x, home.y);
}

/* ---------- bots: memoria, ánimo y eventos (mazmorras, torneos, mercaderes) ---------- */
function botMem(p, o) { p.mem = p.mem || {}; return p.mem[o] || (p.mem[o] = { gr: 0, fv: 0, t: 0 }); }
function botNote(g, p, o, kind, n) { if (!p || !p.bot || o === undefined || o === p.id) return; const m = botMem(p, o); m[kind] = Math.min(10, (m[kind] || 0) + n); m.t = g.turn; }
function botDecay(g, p) { if (p._dk === g.turn || g.turn % 6) return; p._dk = g.turn; for (const o in (p.mem || {})) { const m = p.mem[o]; m.gr = Math.max(0, m.gr - 1); m.fv = Math.max(0, m.fv - 0.5); } }
function botMood(g, p) {
  if (g.turn < 12 || g.cfg.mode === 'historia') return p.mood || null;
  if (p._mv !== undefined && g.turn - p._mv < 5) return p.mood || null;
  p._mv = g.turn;
  const others = g.players.filter(o => o.alive && o.id !== p.id); if (!others.length) return p.mood || null;
  const avg = others.reduce((a, o) => a + score(g, o), 0) / others.length, rel = avg > 0 ? score(g, p) / avg : 1, old = p.mood || null;
  let m = old;
  if (rel < 0.65) m = 'cauto'; else if (rel > 1.45 && g.turn > 20) m = 'ambicioso'; else if (rel > 0.85 && rel < 1.2) m = null;
  if (m !== old) { p.mood = m; if (m) botReact(g, 'mood_' + m, p, {}, 0.8); }
  return m;
}
function botStrike(g, p, u) { // hasta dos ataques con la mejor opción
  for (let i = 0; i < 2; i++) {
    if (!g.units.includes(u) || u.at <= 0) break;
    const b = bestAttack(g, p, u, eff(g, u)); if (!b) break;
    if (!b.isStart && doMove(g, u, b.x, b.y)) break;
    if (typeof doAttack(g, u, b.t.tt, b.t.ref.id) === 'string') break;
  }
}
function botDgPlan(g, p, units, pb, lvl, done) { // acercarse y entrar a una mazmorra
  let pl = p.dgp;
  const real = units.filter(u => !isAux(u) && !u.bs);
  if (!pl) {
    if (pb.dg <= 0 || !g.dungeons.length || real.length < 3 || g.turn < 6 || g.turn < (p.dgcd || 0) || g.cfg.mode === 'uno' || rng(g) > pb.dg * 0.3) return;
    const party = real.slice().sort((a, b) => b.lv - a.lv).slice(0, 5), avg = party.reduce((a, u) => a + u.lv, 0) / party.length;
    const hp = party.reduce((a, u) => a + u.hp / eff(g, u).maxHp, 0) / party.length; if (hp < 0.8) return;
    const slack = (lvl.need <= 0.8 ? 2 : lvl.need >= 1.2 ? 0 : 1) + (pb.dg >= 0.8 ? 1 : 0) + (pb.dg >= 0.4 ? 1 : 0), cen = p._cen || party[0];
    const ds = g.dungeons.filter(d => !d.cleared && d.x >= 0 && S.DUNGEON.tiers[d.tier - 1].rec <= avg + slack && cheb(cen, d) <= 32).sort((a, b) => b.tier - a.tier || cheb(cen, a) - cheb(cen, b));
    if (!ds.length) return;
    pl = p.dgp = { id: ds[0].id, t0: g.turn, party: party.map(u => u.id), in: false, tin: 0 };
  }
  const d = g.dungeons.find(x => x.id === pl.id);
  if (!d || pl.in || g.turn - pl.t0 > 14) { if (!pl.in) { p.dgp = null; p.dgcd = g.turn + 8; } return; }
  const party = units.filter(u => pl.party.includes(u.id) && !u.dg);
  if (!party.length || party.reduce((a, u) => a + u.hp / eff(g, u).maxHp, 0) / party.length < 0.6) { p.dgp = null; p.dgcd = g.turn + 8; return; }
  for (const u of party) {
    done.add(u.id);
    if (cheb(u, d) <= 1) { const r = doDungeon(g, p, { d: 'enter', u: u.id, id: d.id }); if (typeof r !== 'string' && !pl.in) { pl.in = true; botReact(g, 'dg_enter', p, {}, 0.7); } }
    else botUnit(g, p, u, { x: d.x, y: d.y }, true);
  }
}
function botDgInside(g, p, inside) {
  const d = g.dungeons.find(x => x.id === inside[0].dg); if (!d) return;
  const pl = p.dgp && p.dgp.id === d.id ? p.dgp : (p.dgp = { id: d.id, t0: g.turn, party: inside.map(u => u.id), in: true, tin: 0 });
  pl.in = true; if (pl._t !== g.turn) { pl._t = g.turn; pl.tin++; }
  const hpAvg = inside.reduce((a, u) => a + u.hp / eff(g, u).maxHp, 0) / inside.length;
  const cre = g.creatures.filter(c => c.dg === d.id), sq = squadPower(g, inside), ok = [];
  p._ok = new Set();
  for (const c of cre) { const cs = cstats(c, g), cd = S.CREATURES[c.t], nd = (cd.boss ? 2.4 : 1.6) * botCfg(g, p).lv.need * botCfg(g, p).pb.cNeed; if (sq.pw >= nd * cs.dmg * ehp(cs.mhp, cs.def)) { p._ok.add(c.id); ok.push(c); } }
  const treas = g.sites.filter(q => q.dg === d.id && q.k === 'tesoro');
  let why = null;
  const hpMin = Math.min(...inside.map(u => u.hp / eff(g, u).maxHp));
  if (hpAvg < 0.6 || hpMin < 0.35) why = 'flee'; else if (pl.tin > 14) why = 'time'; else if (!cre.length && !treas.length) why = 'clear'; else if (!ok.length && !treas.length) why = 'flee';
  if (why) {
    if (why === 'flee' && !pl.fled) { pl.fled = true; botReact(g, 'dg_flee', p, {}, 0.6); }
    if (why === 'clear' && !pl.won) { pl.won = true; botReact(g, 'dg_win', p, {}, 0.8); }
    for (const u of inside) { if (cheb(u, d.exit) <= 1) doDungeon(g, p, { d: 'leave', u: u.id }); else headTo(g, u, d.exit.x, d.exit.y); }
    if (!g.units.some(u => u.o === p.id && u.dg)) { p.dgp = null; p.dgcd = g.turn + 10; }
    return;
  }
  const cen = { x: Math.round(inside.reduce((a, u) => a + u.x, 0) / inside.length), y: Math.round(inside.reduce((a, u) => a + u.y, 0) / inside.length) };
  let tg = null; for (const c of ok) { const dist = cheb(c, cen); if (!tg || dist < tg.dist) tg = { x: c.x, y: c.y, dist }; }
  if (!tg) for (const q of treas) { const dist = cheb(q, cen); if (!tg || dist < tg.dist) tg = { x: q.x, y: q.y, dist }; }
  const order = { tanque: 0, frontal: 1, arquero: 2, medico: 3 };
  for (const u of inside.slice().sort((a, b) => (order[a.role] || 1) - (order[b.role] || 1))) {
    if (!g.units.includes(u)) continue;
    botStrike(g, p, u);
    if (g.units.includes(u) && u.at >= eff(g, u).attacks && tg) headTo(g, u, tg.x, tg.y);
  }
}
function botTournGo(g, p, units, pb, done) {
  const t = g.tourn; if (!t || !p.bot || g.cfg.mode === 'uno') return;
  if (!p._tn || p._tn.t0 !== t.start) p._tn = { t0: t.start, on: rng(g) < pb.tn && units.length >= 2, said: false };
  if (!p._tn.on) return;
  const left = t.end - g.turn, cand = units.filter(u => !done.has(u.id) && !isAux(u) && !u.bs && !u.dg && cheb(u, t) <= left * 3 + 1).sort((a, b) => b.lv - a.lv).slice(0, 2);
  for (const u of cand) { done.add(u.id); if (cheb(u, t) > S.TOURN.radius) botUnit(g, p, u, { x: t.x, y: t.y }, true); }
  if (cand.length && !p._tn.said) { p._tn.said = true; botReact(g, 'tn_go', p, {}, 0.6); }
}
function botSurplus(c, cost, doIt) { // ¿puede la ciudad pagar el valor de «cost» solo con excedentes (por encima de una reserva)? Si doIt, los gasta
  const need = tradeValue(cost), res = { hueso: 4, cuero: 4, hierro: 4, acero: 3 }, take = {}; let got = 0;
  for (const k of ['hueso', 'cuero', 'hierro', 'acero']) { const free = Math.max(0, (c.st.m[k] || 0) - res[k]), val = tradeValue({ [k]: 1 }); const n = Math.min(free, Math.ceil((need - got) / val)); if (n > 0) { take[k] = n; got += n * val; } if (got >= need) break; }
  if (got < need) return false;
  if (doIt) spend(c.st.m, take);
  return true;
}
function botMerchGo(g, p, units, pb, done) {
  if (!g.merch || !g.merch.length || !p.bot || g.cfg.mode === 'uno' || rng(g) > pb.mc) return;
  const cen = p._cen; if (!cen) return;
  for (const m of g.merch) {
    if (cheb(cen, m) > 22) continue;
    const afford = u => m.offers.map((o, i) => ({ o, i })).filter(x => !x.o.sold && (x.o.k !== 'map' || pb.mc > 0.7) && canAfford(u.inv.m, x.o.cost));
    const cand = units.filter(u => !done.has(u.id) && !isAux(u) && !u.bs && !u.dg && afford(u).length && cheb(u, m) <= (m.until - g.turn) * 3).sort((a, b) => cheb(a, m) - cheb(b, m))[0];
    let who = cand;
    if (!who && pb.mc >= 0.5) { // sin dinero encima: una unidad junto a una ciudad propia coge del almacén lo que cuesta una oferta
      for (const c of g.cities) { if (c.owner !== p.id || cheb(c, m) > 22) continue;
        const u = units.find(x => !done.has(x.id) && !isAux(x) && !x.bs && !x.dg && cheb(x, c) <= 1); if (!u) continue;
        const of = m.offers.filter(o => !o.sold && o.k !== 'map' && botSurplus(c, o.cost, false)).sort((a, b) => (a.k === 'item' ? -1 : 1) - (b.k === 'item' ? -1 : 1))[0];
        const pay = of ? Object.values(of.cost).reduce((a, b) => a + b, 0) : 0;
        if (of && invW(u) + pay <= capOf(u) - 2 && botSurplus(c, of.cost, true)) { addMats(u, of.cost); touch(g); who = u; break; } }
    }
    if (!who) continue;
    const cand2 = who; done.add(cand2.id);
    if (cheb(cand2, m) <= 1) {
      let bought = 0;
      for (const x of afford(cand2).sort((a, b) => (a.o.k === 'item' ? -1 : 0) - (b.o.k === 'item' ? -1 : 0))) { if (bought >= 2) break; const r = doMerch(g, p, { id: m.id, u: cand2.id, i: x.i }); if (typeof r !== 'string') bought++; }
      if (bought) botReact(g, 'merch_buy', p, {}, 0.6);
    } else botUnit(g, p, cand2, { x: m.x, y: m.y }, true);
    return;
  }
}
function botSiege(g, p) { // los bots reparan sus murallas; los agresivos construyen arietes/catapultas y rompen las murallas enemigas cercanas
  for (const c of g.cities.filter(x => x.owner === p.id)) {
    if (c.b && c.b.muralla && wallHp(c) < wallMax(c) && c.rep !== g.turn) doRepair(g, p, c);
    if (p.aggr && c.b && c.b.asedio && g.turn >= 8 && !c.sg) {
      const have = g.units.filter(u => u.sg && u.sg.c === c.id).length;
      if (have < (c.b.asedio >= 2 ? 2 : 1)) doSiegeUnit(g, p, c, c.b.asedio >= 2 && have === 1 ? 'cata' : 'ram');
    }
  }
  const foes = g.cities.filter(c => c.owner !== null && c.owner !== p.id && hostileTo(g, p.id, c.owner) && c.b && c.b.muralla && wallHp(c) > 0);
  for (const u of g.units.filter(x => x.o === p.id && x.sg && !x.acted)) {
    const t = foes.filter(c => cheb(c, u) <= 25).sort((a, b) => cheb(a, u) - cheb(b, u))[0]; if (!t) continue;
    const r = doSiegeWall(g, u, t.id);
    if (typeof r === 'string' && u.mp > 0) { // aún lejos: avanza hacia la ciudad
      const rr = S.reach(envFor(g, u), u.x, u.y, u.mp); let best = null;
      for (const [k, v] of rr) { if (!v.end) continue; const x = k % g.map.w, y = (k - x) / g.map.w, d = cheb({ x, y }, t); if (d >= 2 && (!best || d < best.d)) best = { x, y, d }; }
      if (best && best.d < cheb(u, t)) doMove(g, u, best.x, best.y);
    }
  }
}
function botTurn(g, p) {
  let units = g.units.filter(u => u.o === p.id);
  units.forEach((u, i) => {
    if (u.sm || u.cart || u.bld || u.sg) { u.role = 'frontal'; return; }
    if (u.bs) { u.role = (S.CREATURES[u.bs].rng || 1) > 1 ? 'arquero' : u.bs === 'troll' || u.bs === 'orco' || u.bs === 'golem' ? 'tanque' : 'frontal'; while (u.pts > 0) { const tab = botPickSkill(u); if (!tab) break; applySkill(u, wpick(g, tab)); } return; }
    if (!u.role) {
      u.role = ROLES[i % ROLES.length];
      u.pref = u.role === 'arquero' ? pick(g, ['arco', 'arcolargo', 'ballesta', 'bumeran']) : u.role === 'medico' ? 'daga' : u.role === 'tanque' ? pick(g, ['espada', 'hacha']) : pick(g, ['espada', 'espada', 'hacha', 'katana', 'hachabatalla', 'lanza', 'estoque', 'maza', 'guadana']);
    }
    if (!u.cls && u.lv >= S.CLASS_LV) {
      u.cls = ({ frontal: pick(g, ['duelista', 'duelista', 'asesino', 'invocador', 'nigromante', 'berserker', 'monje']), arquero: pick(g, ['cazador', 'cazador', 'mago', 'elementalista']), tanque: pick(g, ['guardian', 'paladin']), medico: pick(g, ['sanador', 'sanador', 'nigromante', 'bardo', 'alquimista']) })[u.role] || 'duelista';
      if (g.cfg.mode === 'uno' && u.cls === 'invocador') u.cls = 'duelista';
      if (u.cls === 'mago' || u.cls === 'elementalista') u.pref = pick(g, ['baston', 'varita', 'orbe']); else if (u.cls === 'nigromante') u.pref = 'varita';
    }
    if (u.cls && !u.sub && u.lv >= S.SUB_LV) u.sub = pick(g, Object.keys(S.CLASSES[u.cls].sub));
    while (u.pts > 0) {
      const tab = botPickSkill(u); if (!tab) break;
      applySkill(u, wpick(g, botCfg(g, p).lv.flat ? tab.map(t => [t[0], 1]) : tab));
    }
  });
  botManage(g, p);
  units = g.units.filter(u => u.o === p.id);
  units.forEach((u, i) => { if (!u.role) { u.role = ROLES[i % ROLES.length]; u.pref = u.role === 'arquero' ? 'arco' : u.role === 'medico' ? 'daga' : 'espada'; } });
  botDecay(g, p);
  const outside = units.filter(u => !u.dg), inside = units.filter(u => u.dg);
  const target = botTarget(g, p, outside);
  p._cen = null;
  if (outside.length) { let cx = 0, cy = 0; for (const u of outside) { cx += u.x; cy += u.y; } p._cen = { x: Math.round(cx / outside.length), y: Math.round(cy / outside.length) }; }
  const order = { tanque: 0, frontal: 1, arquero: 2, medico: 3 };
  outside.sort((a, b) => order[a.role] - order[b.role]);
  const done = new Set();
  if (p.dgp && p.dgp.in && !inside.length && p.dgp._t !== g.turn) { p.dgp = null; p.dgcd = g.turn + 10; }
  if (p.bot && !inside.length) { const bc = botCfg(g, p); botDgPlan(g, p, outside, bc.pb, bc.lv, done); botTournGo(g, p, outside, bc.pb, done); botMerchGo(g, p, outside, bc.pb, done); }
  else if (p.bot) { const bc = botCfg(g, p); botTournGo(g, p, outside, bc.pb, done); botMerchGo(g, p, outside, bc.pb, done); }
  if (p.bot) for (const u of outside) if (u.bld && g.units.includes(u)) botBuilder(g, p, u);
  if (p.bot && siegeOn(g)) botSiege(g, p);
  for (const u of outside) if (!u.cart && !u.bld && !u.sg && !done.has(u.id) && g.units.includes(u)) botUnit(g, p, u, target);
  if (inside.length) botDgInside(g, p, inside.filter(u => g.units.includes(u)));
}

/* ---------- instantánea para un jugador ---------- */
function heroInfo(g, p) {
  if (g.cfg.hero === 'no' || g.status === 'lobby') return null;
  const u = p.hero ? g.units.find(x => x.id === p.hero) : null;
  if (u) return { n: u.name, emb: u.hero, lv: u.lv, w: 0 };
  const r = (g.rv || []).find(x => x.o === p.id && x.emb);
  return r ? { n: r.name, emb: r.emb, lv: Math.max(1, r.lv - S.HERO.loss), w: Math.max(1, r.due - g.turn) } : null;
}
function pairInfo(g, u) {
  const need = BREED_NEED[g.cfg.breed]; if (!need) return null;
  for (const k in (g.pairs || {})) { const [a, b] = k.split('-').map(Number); if (a === u.id || b === u.id) { const o = g.units.find(x => x.id === (a === u.id ? b : a)); return o ? { w: o.name, n: g.pairs[k], need } : null; } }
  return { cd: Math.max(0, (u.bc || 0) - g.turn), need };
}
function summary(g) { // resumen de fin de partida: clasificación y premios
  const rows = g.players.map(p => {
    const us = g.units.filter(u => u.o === p.id && !isAux(u)), best = us.slice().sort((a, b) => b.lv - a.lv)[0];
    return { id: p.id, name: p.name, color: p.color, team: p.team === undefined ? null : p.team, bot: !!p.bot, score: score(g, p), kills: p.stats.kills, boss: p.stats.boss, pk: p.stats.pk,
      cities: g.cities.filter(c => c.owner === p.id).length, units: us.length, best: best ? { name: best.name, lv: best.lv, cls: best.cls || null, bs: best.bs || null } : null };
  }).sort((a, b) => b.score - a.score);
  const top = (f, min) => { const r = rows.slice().sort((a, b) => f(b) - f(a))[0]; return r && f(r) >= (min || 1) ? r : null; };
  const aw = [], add = (e, t, r, txt) => { if (r) aw.push({ e, t, id: r.id, name: r.name, txt }); };
  add('⚔️', 'Más criaturas derrotadas', top(r => r.kills), r => `${r.kills} criaturas`);
  add('🐉', 'Cazador de jefes', top(r => r.boss), r => `${r.boss} ${r.boss === 1 ? 'jefe' : 'jefes'}`);
  add('🏰', 'Más ciudades', top(r => r.cities), r => `${r.cities} ciudades`);
  add('🗡️', 'Más victorias contra jugadores', top(r => r.pk), r => `${r.pk} unidades rivales`);
  add('⭐', 'Mejor unidad', top(r => (r.best ? r.best.lv : 0), 2), r => `${r.best.name} (nivel ${r.best.lv})`);
  for (const a of aw) a.txt = a.txt(rows.find(r => r.id === a.id));
  return { turns: g.turn, mode: g.cfg.mode || 'normal', rows, awards: aw, kills: rows.reduce((a, r) => a + r.kills, 0), story: g.story ? { fin: !!g.story.fin, ch: g.story.ch + 1 } : null };
}
function snapshot(g, pid, now) {
  const base = {
    code: g.code, status: g.status, turn: g.turn, endsAt: g.endsAt, now: now || Date.now(), hostId: g.hostId, you: pid, cfg: g.cfg, story: storyInfo(g), king: g.king === undefined ? null : g.king, winner: g.winner, winners: g.winners || null,
    players: g.players.map(p => ({ id: p.id, name: p.name, color: p.color, team: p.team === undefined ? null : p.team, bot: p.bot, pers: p.bot ? (p.pers || 'equilibrado') : undefined, auto: !!p.auto, alive: p.alive, ready: p.ready,
      score: g.status === 'lobby' ? 0 : score(g, p), units: g.units.filter(u => u.o === p.id && !isAux(u)).length, cities: g.cities.filter(c => c.owner === p.id).length,
      kills: p.stats.kills, boss: p.stats.boss, pk: p.stats.pk, hero: heroInfo(g, p), gt: (guildOf(g, p.id) || {}).tag, pr: protLeft(g, p.id) || undefined })),
  };
  if (g.cfg.mode === 'mundo' && g.status === 'playing') {
    const gd = guildOf(g, pid), wb = g.creatures.find(c => c.wb);
    base.prot = protLeft(g, pid);
    base.gd = gd ? { id: gd.id, n: gd.n, tag: gd.tag, lead: gd.lead, m: gd.m.slice(), inv: gd.lead === pid ? gd.inv.slice() : [] } : null;
    base.ginv = (g.guilds || []).filter(x => x.inv.includes(pid)).map(x => ({ id: x.id, n: x.n, tag: x.tag, by: x.lead }));
    base.guilds = (g.guilds || []).map(x => ({ id: x.id, n: x.n, tag: x.tag, size: x.m.length, pts: x.m.reduce((a, id) => a + score(g, g.players[id]), 0) }));
    base.wb = wb ? { id: wb.id, t: wb.t, lv: wb.lv, hp: wb.hp, mhp: cstats(wb, g).mhp, x: wb.x, y: wb.y, left: Math.max(0, wb.wbEnd - g.turn) } : (g.wb ? { next: Math.max(0, g.wb.next - g.turn) } : null);
  }
  if (g.status === 'over') base.sum = summary(g);
  { const vi = victoryInfo(g); if (vi) base.vic = vi; }
  if (g.status === 'playing' && g.players[pid] && g.players[pid].ack === undefined) g.players[pid].ack = g.turn;
  if (g.status === 'lobby') return base;
  const w = g.map.w, h = g.map.h, me = g.players[pid];
  const vis = visFor(g, pid);
  if (me && me.ex) for (let i = 0; i < vis.length; i++) if (vis[i]) me.ex[i] = 1;
  const ex = me && me.ex ? me.ex : vis;
  let terr = '', vs = '';
  const tarr = new Array(w * h), varr = new Array(w * h);
  for (let i = 0; i < w * h; i++) { tarr[i] = ex[i] ? g.map.t.charAt(i) : '?'; varr[i] = vis[i] ? '1' : '0'; }
  terr = tarr.join(''); vs = varr.join('');
  const mine = [], others = [], cre = [];
  for (const u of g.units) {
    if (u.o === pid) {
      const e = eff(g, u);
      mine.push({ id: u.id, o: u.o, name: u.name, x: u.x, y: u.y, dg: u.dg || 0, lv: u.lv, xp: u.xp, xpn: xpNeed(u.lv), hp: u.hp, pts: u.pts, sk: u.sk, eq: u.eq, inv: u.inv, mp: u.mp, at: u.at,
        e: { maxHp: e.maxHp, def: e.def, dmg: e.dmg, range: e.range, min: e.min, mov: e.mov, attacks: e.attacks, pierce: e.pierce, aura: e.aura, ha: e.ha, fx: e.fx }, pz: u.pz ? 1 : 0, bn: u.bn || null, gen: u.gen || 0, cz: cityZone(g, u), bc: u.bc || 0, pr: pairInfo(g, u), sm: u.sm ? u.sm.k : null, bs: u.bs || null, hr: u.hero || null, cart: u.cart ? 1 : 0, sg: u.sg ? { k: u.sg.k, c: u.sg.c } : null, bld: u.bld ? { c: u.bld.c, bt: u.bt === g.turn ? 1 : 0 } : null, cap: capOf(u), sc: summonInfo(g, u), cls: u.cls || null, sub: u.sub || null, ord: u.ord || null, nearCity: !!cityNear(g, u), nearCart: !!cartNear(g, u) });
    } else if (vis[u.y * w + u.x]) {
      const e = eff(g, u);
      others.push({ id: u.id, o: u.o, name: u.name, x: u.x, y: u.y, lv: u.lv, hp: u.hp, mhp: e.maxHp, w: e.kind, def: e.def, dmg: e.dmg, pz: u.pz ? 1 : 0, sm: u.sm ? u.sm.k : null, bs: u.bs || null, hr: u.hero || null, ct: u.cart ? 1 : 0, bl: u.bld ? 1 : 0, sg: u.sg ? u.sg.k : null, ah: u.eq && u.eq.casco ? u.eq.casco.t : 0, ac: u.eq && u.eq.pechera ? u.eq.pechera.t : 0 });
    }
  }
  for (const c of g.creatures) if (vis[c.y * w + c.x]) {
    const cs = cstats(c, g);
    cre.push({ id: c.id, t: c.t, x: c.x, y: c.y, lv: c.lv, hp: c.hp, mhp: cs.mhp, dmg: cs.dmg, def: Math.round(cs.def * 10) / 10, boss: !!S.CREATURES[c.t].boss, el: c.el || null, hd: c.tg ? 1 : 0, pz: c.pz ? 1 : 0, wb: c.wb ? 1 : 0 });
  }
  const sites = g.sites.filter(q => vis[q.y * w + q.x] && !q.hid).map(q => ({ id: q.id, x: q.x, y: q.y, k: q.k, t: q.t || 0, used: q.used ? 1 : 0, nm: q.nm || undefined, mine: q.o === pid ? 1 : 0 }));
  const mineDg = new Set(g.units.filter(u => u.o === pid && u.dg).map(u => u.dg));
  const dungeons = (g.dungeons || []).filter(d => vis[d.y * w + d.x] || mineDg.has(d.id)).map(d => ({ id: d.id, x: d.x, y: d.y, tier: d.tier, name: dgName(d), rec: S.DUNGEON.tiers[d.tier - 1].rec, cleared: d.cleared ? 1 : 0, exit: d.exit, inside: g.units.filter(u => u.o === pid && u.dg === d.id).length }));
  const merch = (g.merch || []).filter(m => vis[m.y * w + m.x]).map(m => ({ id: m.id, x: m.x, y: m.y, name: m.name, left: Math.max(0, m.until - g.turn), offers: m.offers.map(o => ({ k: o.k, txt: offerText(o), cost: o.cost, sold: !!o.sold })) }));
  const wxs = wxNow(g) ? { k: g.wx.k, left: g.wx.left } : null, tourn = g.tourn ? { x: g.tourn.x, y: g.tourn.y, left: Math.max(0, g.tourn.end - g.turn) } : null;
  const dip = {};
  for (const o of g.players) if (o.id !== pid && pactOf(g, pid, o.id)) dip[o.id] = pactOf(g, pid, o.id);
  const props = g.props.filter(q => q.from === pid || q.to === pid);
  const trades = (g.trades || []).filter(q => q.from === pid || q.to === pid).map(q => ({ id: q.id, from: q.from, to: q.to, give: q.give, want: q.want, item: q.item ? { id: q.item.id, name: S.itemName(q.item) } : null, left: Math.max(0, TRADE_TTL - (g.turn - q.turn)), txt: tradeText(q) }));
  const brk = {};
  for (const k of Object.keys(g.brk)) { const [a, b] = k.split('-').map(Number); if (a === pid) brk[b] = g.brk[k]; else if (b === pid) brk[a] = g.brk[k]; }
  const cities = [];
  for (const c of g.cities) if (ex[c.y * w + c.x]) {
    const o = { id: c.id, x: c.x, y: c.y, name: c.name, o: c.owner, cap: c.cap, b: c.b || {}, cart: c.cart ? 1 : 0, ang: c.ang ? { x: c.ang.x, y: c.ang.y, n: c.ang.n } : undefined };
    if (c.owner === pid) { o.st = c.st; o.crafts = c.crafts; o.cm = cityCrafts(c); o.built = c.built || 0; o.inc = (() => { const i = cityIncome(g, c), r = {}; for (const m in i) if (i[m] > 0.005) r[m] = Math.round(i[m] * 100) / 100; return r; })(); o.rc = recruitCost(g, pid, c); if (isKing(g, pid)) { o.rcb = {}; for (const k of Object.keys(S.KING.beasts)) o.rcb[k] = beastCost(g, c, k); } const ca = cartOf(g, c); o.cart = ca ? { id: ca.id, x: ca.x, y: ca.y } : null; const bu = builderOf(g, c); o.bu = bu ? { id: bu.id, x: bu.x, y: bu.y } : null; o.net = c.nl ? 1 : 0; o.st2 = stationNear(g, c) ? 1 : 0; }
    Object.assign(o, siegeInfo(g, c));
    cities.push(o);
  }
  const log = [];
  for (let i = g.events.length - 1; i >= 0 && log.length < 150; i--) {
    const e = g.events[i];
    if (!e.to || e.to.includes(pid)) log.push({ id: e.id, turn: e.turn, text: e.text, k: e.k });
  }
  const roads = []; if (g.rd) for (const k in g.rd) if (ex[k]) roads.push([+k, g.rd[k]]);
  base.hist = histInfo(g, pid);
  base.chron = (g.chron || []).slice(-150);
  return Object.assign(base, { roads, pn: (me && me.pn) || {}, graves: (g.graves || []).filter(x => x.o === pid).map(x => ({ id: x.id, name: x.name, lv: x.lv, cls: x.cls, cost: reviveCost(x) })), chat: chatFor(g, pid), recap: me ? recapFor(g, me) : null, w, h, h0: mapH0(g), terr, vis: vs, mine, others, cre, cities, sites, dip, props, trades, brk, merch, dungeons, wx: wxs, tourn, season: { i: S.seasonIdx(g.turn), left: S.SEASON_LEN - ((g.turn - 1) % S.SEASON_LEN) }, log, craftsMax: CRAFTS_PER_TURN, invCap: INV_CAP, maxUnits: MAX_UNITS });
}

/* ---------- persistencia ---------- */
function serialize(g) {
  return JSON.stringify(g, (k, v) => {
    if (k && k[0] === '_') return undefined;
    if (v instanceof Uint8Array) return { __u8: Buffer.from(v).toString('base64') };
    return v;
  });
}
function deserialize(s) {
  const g = JSON.parse(s, (k, v) => (v && typeof v === 'object' && v.__u8 !== undefined) ? new Uint8Array(Buffer.from(v.__u8, 'base64')) : v);
  g.pairs = g.pairs || {}; g.rv = g.rv || [];
  g.chat = g.chat || []; g.cid = g.cid || g.chat.reduce((a, m) => Math.max(a, m.id), 0);
  if (g.cfg && g.cfg.breed === undefined) g.cfg.breed = 'apagado'; // partidas ya empezadas: sin cambios
  if (!g.hist) g.hist = []; if (!g.chron) g.chron = [];
  if (g.cfg && g.cfg.siege === undefined) g.cfg.siege = 'no'; // partidas ya empezadas: sin asedios
  if (g.cfg && g.cfg.hero === undefined) g.cfg.hero = 'no';
  if (g.cfg && g.cfg.botChat === undefined) g.cfg.botChat = 'no';
  g.rd = g.rd || {}; g.nets = g.nets || {};
  g.dip = g.dip || {}; g.props = g.props || []; g.trades = g.trades || []; g.brk = g.brk || {}; g.sites = g.sites || []; g.graves = g.graves || [];
  if (g.cfg) g.cfg.botLevel = g.cfg.botLevel || 'normal';
  if (g.cfg) for (const k of Object.keys(S.WORLD_OPTS)) if (g.cfg[k] === undefined) g.cfg[k] = S.WORLD_OPTS[k].def;
  if (!g.ratio) g.ratio = g.map ? Math.max(0.5, (g.map.w * g.map.w) / Math.pow(Math.max(28, Math.min(52, 22 + g.players.length * 3)), 2)) : 1;
  for (const p of g.players || []) { p.pers = p.pers || 'equilibrado'; p.wr = p.wr || {}; }
  if (g.cities && g.map) relinkStores(g);
  return g;
}

module.exports = {
  rndLvTest: (g, t, x, y) => rndLv(g, t, x, y), createGame, addPlayer, addBot, joinWorld, removePlayer, startGame, cmd, advanceTurn, snapshot, serialize, deserialize,
  refreshUnits, newUnit, doMove, doAttack, score, COLORS, COLOR_NAMES, eff, cstats, idx, touch,
  chat, chatFor, botMem, botNote, reviveCost, holyCost, cityIncome, relinkStores, stationNear, builderOf, envFor, botMood, spawnCreature, spawnBoss, cstats, fillDungeon, dgName, gainXp, killUnit, killCreature, rareItem, addMats, capOf, invW, merchOffers, markSeen, replaceableSlots, replaceBot, releasePlayer, pactOf,
};
