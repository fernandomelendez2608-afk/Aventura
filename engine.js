'use strict';
/* Aventura de almas — motor del juego (lógica pura, sin red) */
const S = require('./shared.js');
const BC = require('./botchat.js');
const K = S.KINDS;
const cheb = S.cheb;

const COLORS = ['#e5484d', '#3e8bff', '#2fbf71', '#f5b82e', '#a56bff', '#ff7a2f', '#22c3c3', '#ff6fb0', '#9aa7b5', '#9bd13a'];
const COLOR_NAMES = ['Rojo', 'Azul', 'Verde', 'Dorado', 'Violeta', 'Naranja', 'Turquesa', 'Rosa', 'Plata', 'Lima'];
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
const MAX_LEVEL = 20;
const INV_CAP = 30;
const isAux = u => !!(u.sm || u.cart); // invocaciones y carretas no cuentan como unidades
const capOf = u => u.cart ? S.CART.cap : INV_CAP;
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
    pairs: {}, rv: [], chat: [], cid: 0,
    cfg: Object.assign({ turnHours: 4, maxTurns: 0, idleTurns: 2, botLevel: 'normal' }, Object.fromEntries(Object.keys(S.WORLD_OPTS).map(k => [k, S.WORLD_OPTS[k].def]))),
    dip: {}, props: [], brk: {}, sites: [],
    players: [], turn: 0, endsAt: 0, units: [], creatures: [], cities: [], events: [],
    nid: 1, eid: 1, rng: (Math.random() * 2147483647) | 0, hostId: 0, winner: null, map: null,
  };
  addPlayer(g, hostName, false, hostToken);
  return g;
}
function addPlayer(g, name, bot, token) {
  if (g.status !== 'lobby' || g.players.length >= 10) return null;
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
  if (g.status !== 'lobby' || g.players.length >= 10) return null;
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
  g.props = g.props.filter(x => !(pkey(x.from, x.to) === key && (x.k === k || k === 'alianza')));
  evPair(g, a, b, k === 'paz' ? `🕊️ ${g.players[a].name} y ${g.players[b].name} firman la paz.` : `🤝 ${g.players[a].name} y ${g.players[b].name} forman una alianza.`, 'pact');
}
function doDip(g, p, m) {
  const d = m.d;
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
function botDiplomacy(g) {
  if (g.cfg.mode === 'rey') return;
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
    const recent = to.wr && to.wr[pr.from] !== undefined && g.turn - to.wr[pr.from] <= 6;
    let ok;
    if (to.auto && pr.k !== 'paz') continue; // un humano ausente no firma alianzas: espera a que vuelva
    const pb = (S.PERS[pers] || S.PERS.equilibrado).b;
    ok = !recent && rng(g) < (pr.k === 'paz' ? pb.paz : pb.ali);
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
function inB(g, x, y) { return x >= 0 && y >= 0 && x < g.map.w && y < g.map.h; }
function ev(g, text, to, kind, nt) {
  g.events.push({ id: g.eid++, turn: g.turn, text, to: to || null, k: kind || '', nt: nt || undefined });
  if (g.events.length > 300) g.events.splice(0, g.events.length - 300);
}
const invW = u => {
  let n = 0; for (const m in u.inv.m) n += u.inv.m[m];
  return n + u.inv.it.length * 2;
};
function addMats(u, mats) { // devuelve lo que no cupo
  const lost = {};
  for (const m in mats) {
    const room = capOf(u) - invW(u);
    const take = Math.max(0, Math.min(room, mats[m]));
    if (take) u.inv.m[m] = (u.inv.m[m] || 0) + take;
    if (mats[m] - take > 0) lost[m] = mats[m] - take;
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
    if (c.owner !== u.o || !c.b || !c.b.muralla) continue;
    const d = cheb(c, u);
    if (d === 0) b = Math.max(b, 5 * c.b.muralla); else if (d === 1) b = Math.max(b, 3 * c.b.muralla);
  }
  return b;
}
function eff(g, u) {
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
  let dmgBase = 3, range = 1, min = 1, pierce = 0, movB = 0, single = false, reach = false, kind = null, tier = 0;
  if (w) {
    const k = K[w.k];
    dmgBase = Math.round(k.base * S.WM[w.t]); range = k.range; min = k.min; pierce = k.pierce || 0; movB = k.mov || 0; single = !!k.single; reach = !!k.reach; kind = w.k; tier = w.t;
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
  }
  const cm0 = u.cls ? S.classMods(u) : {};
  const set = S.armorSet(u.eq), sb = set ? set.b : {};
  const cm = Object.assign({}, cm0, { execute: (cm0.execute || 0) + (fx.ejecutor || 0), vsCre: (cm0.vsCre || 0) + (fx.bestias || 0) });
  def += 2 * u.sk.defensa + aDef + (cm.def || 0) + (sb.def || 0) + wallBonus(g, u);
  for (const k of ['vida', 'veneno', 'regen', 'espinas']) if (cm[k] || sb[k]) fx[k] = (fx[k] || 0) + (cm[k] || 0) + (sb[k] || 0);
  const au = aura(g, u), ha = heroAura(g, u);
  return {
    maxHp: Math.round((50 + 6 * u.sk.salud) * (1 + au) * (1 + (cm.hpPct || 0) + (sb.hpPct || 0) + (fx.vigor || 0))) + (u.bn ? u.bn.hp : 0),
    def: Math.round(def * (1 + au) * (1 + ha) * 10) / 10,
    dmg: Math.round((dmgBase + 2 * u.sk.dano + aDmg) * (1 + (cm.dmgPct || 0) + ((kind === 'baston' || kind === 'varita') ? (cm.magic || 0) : 0)) * (1 + ha)) + (u.bn ? u.bn.dmg : 0),
    range: range + (range > 1 ? (cm.range || 0) : 0), min, reach, pierce: Math.min(0.9, pierce + aPierce + (cm.certero || 0)), kind, tier,
    mov: Math.max(1, 3 + u.sk.movilidad + movB + aMov + (cm.mov || 0) - (u.sl > 0 ? 2 : 0)),
    attacks: (u.sk.doble && !single) ? 2 : 1,
    aura: au, ha, fx, mods: cm,
  };
}
function cstats(c, g) {
  const d = S.CREATURES[c.t], L = c.lv;
  const el = c.el ? 1 : 0, win = (g && g.turn > 0 && S.seasonIdx(g.turn) === 3) ? 1 : 0;
  const solo = d.boss && g && g.cfg && g.cfg.mode === 'uno'; // reto de una unidad: jefes más débiles (60% de vida, 80% de daño)
  return { mhp: Math.round(d.hp * (1 + 0.18 * (L - 1)) * (el ? 1.5 : 1) * (solo ? 0.6 : 1)),
    dmg: Math.round(d.dmg * (1 + 0.12 * (L - 1)) * (el ? 1.25 : 1) * (solo ? 0.8 : 1) * (win && d.agg > 0 ? 1.15 : 1)),
    def: d.def + 1.2 * (L - 1) + (el ? 2 : 0), rng: d.rng || 1, min: 1, mov: Math.max(1, d.mov - (c.sl > 0 ? 2 : 0)), agg: d.agg + ((win && d.agg > 0) ? 1 : 0) };
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
  if (u.sm || u.cart) return;
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
  const size = Math.max(Math.max(22, Math.ceil(n * 3.6)), Math.min(80, Math.round(auto * mul)));
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
  const want = Math.max(1, Math.round((n + 3) * cm * g.ratio));
  const minD = cm >= 3 ? 5 : cm >= 2 ? 6 : 8;
  for (let tries = 0; tries < 4000 && g.cities.length < n + want; tries++) {
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
  for (const c of g.cities) t[c.y * w + c.x] = base;
  g.map.t = t.join('');
  g.starts = starts;
  touch(g);
}

function zoneOf(g, x, y) {
  let d = 1e9;
  for (const c of g.cities) if (c.cap) d = Math.min(d, cheb(c, { x, y }));
  const size = g.map.w;
  return d <= size * 0.16 ? 0 : d <= size * 0.30 ? 1 : 2;
}
const ZONE_TABLE = [
  [['ciervo', 4], ['jabali', 3], ['lobo', 2]],
  [['lobo', 3], ['oso', 2], ['goblin', 3], ['esqueleto', 2], ['jabali', 1]],
  [['goblin', 2], ['esqueleto', 3], ['orco', 3], ['troll', 2], ['oso', 1]],
];
const FAUNA_TABLES = {
  pacifica: [
    [['ciervo', 6], ['jabali', 3], ['lobo', 1]],
    [['ciervo', 3], ['jabali', 3], ['oso', 3], ['lobo', 1], ['goblin', 1]],
    [['oso', 2], ['jabali', 2], ['ciervo', 2], ['goblin', 1], ['esqueleto', 1], ['orco', 1], ['troll', 1]],
  ],
  agresiva: [
    [['lobo', 4], ['jabali', 2], ['ciervo', 1], ['goblin', 2]],
    [['lobo', 3], ['goblin', 3], ['orco', 2], ['esqueleto', 3], ['oso', 1]],
    [['orco', 3], ['troll', 3], ['esqueleto', 3], ['goblin', 2]],
  ],
};
const zoneTable = (g, zone) => (FAUNA_TABLES[g.cfg.fauna] || ZONE_TABLE)[zone];
const siteWant = g => Math.max(2, Math.round((g.players.length * 0.8 + 3) * (g.ratio || 1)));
function freeLandTile(g, minDistCity, minDistUnit, zone) {
  const w = g.map.w, h = g.map.h, ix = idx(g);
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
function spawnNormal(g, initial) {
  const zone = wpick(g, [[0, initial ? 4 : 3], [1, 3], [2, initial ? 2 : 3]]);
  const pos = freeLandTile(g, initial ? 5 : 4, initial ? 6 : 8, zone);
  if (!pos) return null;
  const type = wpick(g, zoneTable(g, zone));
  const lv = 1 + zone + (initial ? 0 : Math.floor(g.turn / 15));
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
  return { id: g.nid++, k: kind, t, r, fx };
}
function collectSite(g, u, site) {
  if (invW(u) + 2 > capOf(u)) { ev(g, `🎒 ${u.name} encuentra ${S.SITES[site.k].n} pero lleva la mochila llena. Deposita en una ciudad y vuelve.`, [u.o], 'site'); return; }
  g.sites.splice(g.sites.indexOf(site), 1);
  const mats = {};
  let item = null;
  if (site.k === 'cofre') {
    mats.cuero = ri(g, 2, 5); mats.hierro = ri(g, 1, 4);
    if (rng(g) < 0.3) mats.acero = ri(g, 1, 3);
    if (rng(g) < 0.15) mats.alma = 1;
    if (rng(g) < 0.35) item = rareItem(g, { w: [65, 28, 6, 1, 0] });
  } else {
    mats.acero = ri(g, 1, 3); mats.alma = ri(g, 1, 2);
    item = rareItem(g, { w: [35, 35, 22, 7, 1] });
  }
  const lost = addMats(u, mats);
  const got = {}; for (const m in mats) { const n = mats[m] - (lost[m] || 0); if (n > 0) got[m] = n; }
  let msg = `${S.SITES[site.k].e} ${u.name} abre ${S.SITES[site.k].n.toLowerCase()}.` + (Object.keys(got).length ? ' Botín: ' + fmtMats(got) + '.' : '');
  if (item) { if (invW(u) + 2 <= capOf(u)) { u.inv.it.push(item); msg += ` 🎁 Objeto raro: ${S.itemName(item)}.`; } else msg += ' ⚠️ Sin espacio para el objeto raro.'; }
  ev(g, msg, [u.o], 'loot');
}
function bossCount(g) { return g.creatures.filter(c => S.CREATURES[c.t].boss).length; }
function spawnBoss(g) {
  const pos = freeLandTile(g, 10, 10, 2) || freeLandTile(g, 8, 8);
  if (!pos) return null;
  const type = pick(g, ['reylobo', 'liche', 'dragon']);
  const lv = 3 + Math.floor(g.turn / 10);
  const c = spawnCreature(g, type, pos.x, pos.y, lv);
  ev(g, `🐉 Ha aparecido un jefe: ${S.CREATURES[type].n} (nivel ${c.lv}) ${dirText(g, pos)} del mapa.`, null, 'boss');
  botAnyTalk(g, 'boss', { b: S.CREATURES[type].n }, 0.6);
  return c;
}

function startGame(g) {
  if (g.status !== 'lobby') return 'La partida ya empezó';
  if (g.players.length < 2) return 'Se necesitan al menos 2 jugadores (agrega bots)';
  if (!g.players.some(p => !p.bot)) return 'Debe haber al menos un jugador humano';
  genMap(g);
  const w = g.map.w, h = g.map.h;
  if (g.cfg.mode === 'uno') { g.cfg.hero = 'no'; g.cfg.breed = 'apagado'; } // reto: una sola vida, sin protagonista ni crías
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
  const cap = Math.round(w * h / 55);
  const n0 = Math.round(cap * 0.6);
  for (let i = 0; i < n0; i++) spawnNormal(g, true);
  g.sites = [];
  for (let i = 0, want = siteWant(g), tr = 0; i < want && tr < 200; tr++) if (spawnSite(g)) i++;
  g.status = 'playing'; g.turn = 1;
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
function cityNear(g, u) {
  for (const c of g.cities) if (c.owner === u.o && cheb(u, c) <= 1) return c;
  return null;
}
function depositAll(g, u, c) {
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
  if (slot === 'arma' && k.two && u.eq.escudo) { u.inv.it.push(u.eq.escudo); delete u.eq.escudo; }
  return null;
}
function doUnequip(g, u, slot) {
  const it = u.eq[slot];
  if (!it) return 'Nada equipado ahí';
  if (invW(u) + 2 > capOf(u)) return 'Mochila llena';
  delete u.eq[slot]; u.inv.it.push(it);
  return null;
}
const isKing = (g, pid) => g.cfg.mode === 'rey' && g.king === pid;
function beastCost(g, city, kind) {
  const c = Object.assign({}, S.KING.beasts[kind].cost), L = (city && city.b && city.b.cuartel) || 0;
  if (L) for (const k in c) c[k] = Math.max(1, Math.ceil(c[k] * (1 - 0.2 * L)));
  return c;
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
  return c;
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
  return { n: summonsOf(g, u.o).length, max: S.SUMMON.max, near: !!c, bones: c ? (c.st.m.hueso || 0) : 0, opts: cl.summons.map(k => ({ k, cost: S.SUMMON.cost[k] })) };
}
function doSummon(g, u, k) {
  if (g.cfg.mode === 'uno') return 'En el reto de una unidad no se puede invocar';
  const cl = u.cls && S.CLASSES[u.cls];
  if (u.sm || !cl || !cl.summons || !cl.summons.includes(k)) return 'Tu clase no puede invocar eso';
  if (summonsOf(g, u.o).length >= S.SUMMON.max) return `Ya tienes ${S.SUMMON.max} invocaciones (el máximo por jugador)`;
  const c = summonCity(g, u);
  if (!c) return `Debes estar a ${S.SUMMON.range} casillas o menos de una ciudad tuya`;
  const cost = S.SUMMON.cost[k];
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
  ev(g, `🔮 ${u.name} invoca a ${d.n} (${S.SUMMON.cost[k].hueso} huesos).`, [u.o], 'summon');
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
function doRecruit(g, p, c, kind) {
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
    occ: (x, y) => {
      const k = y * w + x;
      if (ix.C.has(k)) return 2;
      const ct = ix.T.get(k);
      if (ct && ct.owner !== null && ct.owner !== u.o && pactOf(g, u.o, ct.owner)) return 2; // ciudades de pactos: no se pisan
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
  if (prev !== null) {
    for (const m in c.st.m) c.st.m[m] = Math.floor(c.st.m[m] / 2);
    c.st.it = c.st.it.filter(() => rng(g) < 0.5);
  }
  c.owner = u.o;
  if (prev !== null && c.b) for (const k in c.b) c.b[k] = Math.max(0, c.b[k] - 1);
  u.mp = 0;
  const p = g.players[u.o];
  ev(g, `🏰 ${p.name} conquista ${c.name}.`, null, 'city');
  if (prev !== null) { const pp = g.players[prev]; if (pp.wr) pp.wr[u.o] = g.turn; botReact(g, 'city_lose', pp, { c: c.name, n: p.name }, 0.7); }
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
  if (st) collectSite(g, u, st);
  return null;
}
function rollDrops(g, c) {
  const d = S.CREATURES[c.t], out = {};
  const mul = (1 + 0.25 * (c.lv - 1)) * (S.seasonIdx(g.turn) === 2 ? 1.25 : 1) * (c.el ? 2 : 1);
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
  p.stats.kills++; if (d.boss) p.stats.boss++;
  const drops = rollDrops(g, c);
  const lost = addMats(u, drops);
  gainXp(g, u, (d.xp + 3 * c.lv) * (c.el ? 2 : 1));
  const got = {}; for (const m in drops) { const n = drops[m] - (lost[m] || 0); if (n > 0) got[m] = n; }
  let msg = `${u.name} derrota a ${c.el ? c.el + ' (' + d.n + ')' : d.n} (niv. ${c.lv}).` + (Object.keys(got).length ? ' Botín: ' + fmtMats(got) + '.' : '');
  if (Object.keys(lost).length) msg += ` ⚠️ Mochila llena, se perdió: ${fmtMats(lost)}.`;
  if (d.boss || c.el) {
    const it = rareItem(g, { w: d.boss ? [15, 30, 30, 18, 7] : [45, 35, 15, 4, 1], t5: c.t === 'dragon' ? 3 : d.boss ? 0.4 : 0 });
    if (invW(u) + 2 <= capOf(u)) { u.inv.it.push(it); msg += ` 🎁 Objeto raro: ${S.itemName(it)}.`; } else msg += ' ⚠️ Mochila llena: se perdió un objeto raro.';
  }
  ev(g, msg, [u.o], 'loot');
  if (d.boss) ev(g, `🏆 ${p.name} ha derrotado al jefe ${d.n}.`, null, 'boss');
  if (c.el) ev(g, `⭐ ${p.name} abate a la criatura élite ${c.el}.`, null, 'boss');
}
function killUnit(g, u, by) { // by: {unit} o {creature}
  g.units.splice(g.units.indexOf(u), 1); touch(g);
  if (!u.sm) { const mine = g.units.filter(x => x.sm && x.sm.by === u.id); if (mine.length) { g.units = g.units.filter(x => !(x.sm && x.sm.by === u.id)); ev(g, `🌫️ Las invocaciones de ${u.name} se desvanecen.`, [u.o], 'summon'); } }
  const p = g.players[u.o];
  if (u.hero && !u.sm && g.cfg.hero !== 'no') { // el protagonista reaparece en la capital
    g.rv = g.rv || [];
    g.rv.push({ o: u.o, name: u.name, bs: u.bs || null, emb: u.hero, lv: u.lv, pts: u.pts, sk: Object.assign({}, u.sk), cls: u.cls || null, sub: u.sub || null, bn: u.bn || null, keep: by.unit ? null : { eq: u.eq, inv: u.inv }, due: g.turn + S.HERO.wait }); // si lo mata una criatura conserva su equipo
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
  } else {
    ev(g, `💀 ${u.name} ha caído ante ${S.CREATURES[by.creature.t].n}.`, [u.o], 'dead');
  }
}
function doAttack(g, u, tt, tid) {
  if (u.cart) return 'La carreta no puede atacar';
  const tgt = tt === 'c' ? g.creatures.find(c => c.id === tid) : g.units.find(x => x.id === tid && x.o !== u.o);
  if (!tgt) return 'Objetivo no válido';
  if (tt === 'u') {
    const pk = pactOf(g, u.o, tgt.o);
    if (pk) return `Tienes ${pk === 'paz' ? 'paz' : 'una alianza'} con ${g.players[tgt.o].name}`;
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
  else { te = eff(g, tgt); defv = te.def + terrDef(g, tgt.x, tgt.y); }
  const mo = e.mods || {};
  if (u.hits === 0 && mo.first) raw *= 1 + mo.first;
  if (tt === 'c' && mo.vsCre) raw *= 1 + mo.vsCre;
  if (mo.execute && tgt.hp < (tt === 'c' ? cstats(tgt, g).mhp : te.maxHp) * 0.5) raw *= 1 + mo.execute;
  let crit = false;
  if (e.fx.critico && rng(g) < e.fx.critico) { raw *= 1.8; crit = true; }
  let dmg = calcDamage(raw, defv, e.pierce), blocked = false;
  if (te && te.fx.bloqueo && rng(g) < te.fx.bloqueo) { dmg = Math.max(1, Math.round(dmg / 2)); blocked = true; }
  tgt.hp -= dmg; tgt.hit = true;
  u.at--; u.hits++; u.mp = 0; u.acted = true;
  gainXp(g, u, 1);
  let msg = `${u.name} golpea a ${tt === 'c' ? (tgt.el || S.CREATURES[tgt.t].n) : tgt.name} (−${dmg}).`;
  if (e.fx.vida) { const hh = Math.max(1, Math.round(dmg * e.fx.vida)); u.hp = Math.min(e.maxHp, u.hp + hh); msg += ` 🩸 +${hh}.`; }
  if (crit) msg += ' 💥 ¡Crítico!';
  if (blocked) msg += ' 🛡️ Bloqueado.';
  if (e.fx.fuego && tgt.hp > 0) { const d = Math.max(1, Math.round(e.dmg * e.fx.fuego)); if (!tgt.pz || tgt.pz.d < d) tgt.pz = { t: 2, d }; msg += ' 🔥 Quemado.'; }
  if (e.fx.hielo && tgt.hp > 0 && rng(g) < e.fx.hielo) { tgt.sl = 1; msg += ' ❄️ Ralentizado.'; }
  if (e.fx.veneno && tgt.hp > 0) { tgt.pz = { t: 3, d: Math.max(1, Math.round(e.dmg * e.fx.veneno)) }; msg += ' ☠️ Envenenado.'; }
  if (tt === 'c') {
    if (tgt.hp <= 0) { killCreature(g, tgt, u); return { msg: msg + ' ¡Derrotado!' }; }
    tgt.prov = u.id;
    const cs = cstats(tgt, g);
    if (dist >= cs.min && dist <= cs.rng) {
      const rd = calcDamage(cs.dmg, e.def + terrDef(g, u.x, u.y), 0);
      u.hp -= rd; msg += ` Contraataque −${rd}.`;
      if (u.hp <= 0) { killUnit(g, u, { creature: tgt }); return { msg: msg + ' Tu unidad cae.' }; }
    }
  } else {
    const pw = g.players[tgt.o];
    if (pw.wr) pw.wr[u.o] = g.turn;
    if (tgt.hp <= 0) { killUnit(g, tgt, { unit: u }); return { msg: msg + ' ¡Eliminada!' }; }
    ev(g, `⚔️ ${g.players[u.o].name} ataca a ${tgt.name} (−${dmg}).`, [tgt.o], 'phit');
    if (dist === 1 && te.fx.espinas) {
      const th = Math.max(1, Math.round(dmg * te.fx.espinas));
      u.hp -= th; msg += ` 🌵 Espinas −${th}.`;
      if (u.hp <= 0) { killUnit(g, u, { unit: tgt }); return { msg: msg + ' Tu unidad cae.' }; }
    }
    if (dist >= te.min && dist <= te.range) {
      let rraw = te.dmg;
      if (te.range > 1 && !te.reach && dist === 1) rraw *= 0.6;
      const rd = calcDamage(rraw, e.def + terrDef(g, u.x, u.y), te.pierce);
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
  c.b = c.b || {};
  const lv = c.b[k] || 0;
  if (lv >= S.BUILD_MAX) return 'Ya está al máximo';
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
  const BS_NO = ['cls', 'sub', 'equip', 'unequip', 'summon', 'hero'];
  const unitOf = () => { const u = g.units.find(x => x.id === m.u && x.o === pid); return (u && ((u.sm && SM_NO.includes(m.a)) || (u.cart && CART_NO.includes(m.a)) || (u.bs && BS_NO.includes(m.a)))) ? null : u; };
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
      const c = cityNear(g, u);
      if (!c) return { err: 'La unidad debe estar junto a una de tus ciudades' };
      if (m.a === 'equip') err = doEquip(g, u, m.i | 0);
      else if (m.a === 'unequip') err = doUnequip(g, u, m.s);
      else if (m.a === 'dep') {
        if (m.all) depositAll(g, u, c);
        else if (!S.MATS[m.m]) err = 'Material inválido';
        else {
          const n = Math.min(m.n | 0, u.inv.m[m.m] || 0);
          if (n <= 0) err = 'No tienes eso'; else { u.inv.m[m.m] -= n; if (!u.inv.m[m.m]) delete u.inv.m[m.m]; c.st.m[m.m] = (c.st.m[m.m] || 0) + n; }
        }
      } else if (m.a === 'depi') {
        const i = u.inv.it.findIndex(x => x.id === (m.i | 0));
        if (i < 0) err = 'No tienes ese objeto'; else c.st.it.push(u.inv.it.splice(i, 1)[0]);
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
function creaturesTurn(g) {
  for (const c of g.creatures.slice()) {
    if (!g.creatures.includes(c)) continue;
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
        let dmg = calcDamage(cs.dmg, e.def + terrDef(g, target.x, target.y), 0);
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
          const rd = calcDamage(ue.dmg * ((ue.range > 1 && !ue.reach && dist === 1) ? 0.6 : 1), cs.def + terrDef(g, c.x, c.y), ue.pierce);
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
function worldTick(g) {
  if (g.turn % 10 === 0) {
    for (const c of g.creatures) {
      if (c.lv < S.CREATURES[c.t].max) { // sube de nivel conservando su proporción de salud (ya no se cura entera)
        const ratio = c.hp / cstats(c, g).mhp; c.lv++; c.hp = Math.max(1, Math.round(ratio * cstats(c, g).mhp));
      }
    }
  }
  for (const c of g.creatures.slice()) {
    if (c.pz) { c.hp = Math.max(1, c.hp - c.pz.d); c.pz.t--; if (c.pz.t <= 0) delete c.pz; }
    // los jefes se recuperan despacio (3%): un solo aventurero que se retira a curarse no debe verlos volver a tope
    if (!c.hit) c.hp = Math.min(cstats(c, g).mhp, c.hp + Math.ceil(cstats(c, g).mhp * (S.CREATURES[c.t].boss ? ({ lenta: 0.03, normal: 0.1, ninguna: 0 })[g.cfg.bossRegen] ?? 0.03 : 0.1)));
    c.hit = false;
    if (c.sl > 0) c.sl--;
  }
  const si = S.seasonIdx(g.turn);
  const cap = Math.round(g.map.w * g.map.h / 55);
  const n = Math.max(1, Math.round(g.players.length * 0.5));
  const wild = () => g.creatures.filter(c => !c.tg).length;
  for (let i = 0; i < n && wild() < cap; i++) spawnNormal(g, false);
  if (si === 0) { // primavera: más animales
    for (let i = 0; i < 2 && wild() < cap + 4; i++) {
      const pos = freeLandTile(g, 4, 6, 0);
      if (pos) spawnCreature(g, pick(g, ['ciervo', 'jabali']), pos.x, pos.y, 1 + Math.floor(g.turn / 15));
    }
  }
  if (g.turn >= 4 && g.turn % 5 === 0 && bossCount(g) < Math.floor(g.players.length / 3) + 1) spawnBoss(g);
  const wantSites = siteWant(g);
  if (g.turn % 4 === 0 && g.sites.length < wantSites) for (let t = 0; t < 3; t++) if (spawnSite(g)) break;
  const gap = (si === 3 ? 10 : 16) * (g.cfg.fauna === 'pacifica' ? 1.8 : g.cfg.fauna === 'agresiva' ? 0.65 : 1);
  if (g.turn >= 10 && g.turn - (g.lh || 0) >= gap && rng(g) < 0.4) { if (spawnHorde(g)) g.lh = g.turn; }
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
    if (cityNear(g, u)) heal += 0.25 * e.maxHp;
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
function checkEnd(g) {
  for (const p of g.players) {
    if (!p.alive) continue;
    const units = g.units.filter(u => u.o === p.id && !isAux(u)).length;
    const cities = g.cities.filter(c => c.owner === p.id);
    const canRec = g.cfg.mode !== 'uno' && cities.some(c => isKing(g, p.id) ? Object.keys(S.KING.beasts).some(k => canAfford(c.st.m, beastCost(g, c, k))) : canAfford(c.st.m, recruitCost(g, p.id, c)));
    if (units === 0 && !canRec) {
      p.alive = false;
      for (const c of cities) c.owner = null;
      g.props = g.props.filter(x => x.from !== p.id && x.to !== p.id);
      for (const k of Object.keys(g.dip)) { const [a, b] = k.split('-').map(Number); if (a === p.id || b === p.id) { delete g.dip[k]; delete g.brk[k]; } }
      ev(g, `☠️ ${p.name} ha sido eliminado.`, null, 'sys');
      if (p.bot) botTalk(g, p, 'elim', {}, true);
    }
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
      kid.bn = Object.assign({}, BREED_BONUS); kid.bc = g.turn + BREED_WAIT; kid.born = g.turn;
      kid.hp = eff(g, kid).maxHp; kid.moved = true; kid.acted = true; kid.mp = 0; kid.at = 0;
      a.bc = b.bc = g.turn + BREED_WAIT;
      ev(g, `👶 ${a.name} y ${b.name} tienen una cría: ${kid.name} (nivel 1, +${BREED_BONUS.hp} salud y +${BREED_BONUS.dmg} daño de nacimiento).`, [a.o], 'birth');
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
  pushChat(g, bot.id, BC.line(bot.pers || 'equilibrado', key, () => rng(g), vars), true);
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
    const cs = g.cities.filter(c => c.owner === r.o).sort((a, b) => (b.cap ? 1 : 0) - (a.cap ? 1 : 0));
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
    u.name = r.name; u.hero = r.emb; u.cls = r.cls; u.sub = r.sub; u.bn = r.bn; u.sk = r.sk; u.lv = r.lv; u.pts = r.pts; u.xp = 0;
    for (let i = 0; i < S.HERO.loss && u.lv > 1; i++) { // pierde niveles: primero puntos sin gastar, luego habilidades
      u.lv--;
      if (u.pts > 0) u.pts--; else { const k = Object.keys(u.sk).sort((a, b) => u.sk[b] - u.sk[a])[0]; if (u.sk[k] > 0) u.sk[k]--; }
    }
    u.hp = eff(g, u).maxHp; u.mp = 0; u.at = 0; u.moved = true; u.acted = true;
    p.hero = u.id;
    ev(g, `${u.hero} ¡${u.name} regresa a ${c0.name} (nivel ${u.lv})!`, [r.o], 'lvl');
  }
  g.rv = left;
}
function advanceTurn(g) {
  if (g.status !== 'playing') return;
  g._dm = {};
  const lim = g.cfg.idleTurns === undefined ? 2 : g.cfg.idleTurns;
  for (const p of g.players) {
    if (!p.alive || p.bot) continue;
    if (p.act) p.idle = 0; else p.idle = (p.idle || 0) + 1;
    p.act = false;
    if (lim > 0 && !p.auto && p.idle >= lim) {
      p.auto = true;
      ev(g, `🤖 ${p.name} lleva ${p.idle} turnos sin aparecer: un bot dirige su ejército hasta que vuelva.`, null, 'sys');
    }
  }
  botDiplomacy(g);
  for (const p of g.players) if (p.alive && (p.bot || p.auto)) { try { botTurn(g, p); } catch (e) { console.error('bot error', e); } }
  creaturesTurn(g);
  worldTick(g);
  try { breedTick(g); reviveTick(g); } catch (e) { console.error('breed/revive error', e); }
  if (checkEnd(g)) { g.dirty = true; return; }
  g.turn++;
  refreshUnits(g);
  runOrders(g);
  for (const p of g.players) p.ready = false;
  g.endsAt = Date.now() + g.cfg.turnHours * 3600000;
  ev(g, `— Turno ${g.turn} —`, null, 'turn');
  if (g.turn > 1 && (g.turn - 1) % S.SEASON_LEN === 0) { const se = S.SEASONS[S.seasonIdx(g.turn)]; ev(g, `${se.e} Llega ${se.lead}. ${se.d}`, null, 'season'); }
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
  return { pers, pb: (S.PERS[pers] || S.PERS.equilibrado).b, lv: BOT_LV[g.cfg.botLevel] || BOT_LV.normal };
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
    if (c && (c.st.m.hueso || 0) >= S.SUMMON.cost[k].hueso + 6) doSummon(g, u, k);
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
    for (const u of near) if (!u.bs) botGear(g, p, c, u);
    for (const u of near) { // sobrante de objetos desequipados vuelve al almacén
      for (const it of u.inv.it) c.st.it.push(it);
      u.inv.it = [];
    }
    if (bc.lv !== BOT_LV.facil && g.turn >= 6) {
      const order = bc.pb.order.filter((k, i2, a2) => a2.indexOf(k) === i2).concat(['cuartel', 'herreria', 'muralla', 'atalaya']).filter((k, i2, a2) => a2.indexOf(k) === i2);
      for (const k of order) {
        const lv = (c.b && c.b[k]) || 0; if (lv >= S.BUILD_MAX) continue;
        const cost = S.BUILDINGS[k].cost[lv];
        if (canAfford(c.st.m, Object.assign({}, cost, { hierro: (cost.hierro || 0) + 6 }))) { doBuild(g, p, c, k); break; }
      }
    }
    const n = g.units.filter(u => u.o === p.id && !isAux(u)).length;
    if (n < cap && g.turn >= 2) doRecruit(g, p, c);
  }
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
    if (g.cfg.mode === 'rey' && (o === g.king || p.id === g.king)) return true; // el Rey Demonio y sus enemigos siempre están en guerra
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
function botUnit(g, p, u, target) {
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
  if (cen && cheb(u, cen) > 5) { headTo(g, u, cen.x, cen.y); return; }
  if (target) headTo(g, u, target.x, target.y);
  else if (home && hd > 3) headTo(g, u, home.x, home.y);
}
function botTurn(g, p) {
  let units = g.units.filter(u => u.o === p.id);
  units.forEach((u, i) => {
    if (u.sm || u.cart) { u.role = 'frontal'; return; }
    if (u.bs) { u.role = (S.CREATURES[u.bs].rng || 1) > 1 ? 'arquero' : u.bs === 'troll' || u.bs === 'orco' ? 'tanque' : 'frontal'; while (u.pts > 0) { const tab = botPickSkill(u); if (!tab) break; applySkill(u, wpick(g, tab)); } return; }
    if (!u.role) {
      u.role = ROLES[i % ROLES.length];
      u.pref = u.role === 'arquero' ? pick(g, ['arco', 'arcolargo', 'ballesta']) : u.role === 'medico' ? 'daga' : u.role === 'tanque' ? pick(g, ['espada', 'hacha']) : pick(g, ['espada', 'espada', 'hacha', 'katana', 'hachabatalla', 'lanza']);
    }
    if (!u.cls && u.lv >= S.CLASS_LV) {
      u.cls = ({ frontal: pick(g, ['duelista', 'duelista', 'asesino', 'invocador', 'nigromante']), arquero: pick(g, ['cazador', 'cazador', 'mago']), tanque: 'guardian', medico: pick(g, ['sanador', 'sanador', 'nigromante']) })[u.role] || 'duelista';
      if (g.cfg.mode === 'uno' && u.cls === 'invocador') u.cls = 'duelista';
      if (u.cls === 'mago') u.pref = pick(g, ['baston', 'varita']); else if (u.cls === 'nigromante') u.pref = 'varita';
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
  const target = botTarget(g, p, units);
  p._cen = null;
  if (units.length) { let cx = 0, cy = 0; for (const u of units) { cx += u.x; cy += u.y; } p._cen = { x: Math.round(cx / units.length), y: Math.round(cy / units.length) }; }
  const order = { tanque: 0, frontal: 1, arquero: 2, medico: 3 };
  units.sort((a, b) => order[a.role] - order[b.role]);
  for (const u of units) if (!u.cart) botUnit(g, p, u, target); // las carretas no las mueve el bot
}

/* ---------- instantánea para un jugador ---------- */
function heroInfo(g, p) {
  if (g.cfg.hero === 'no' || g.status === 'lobby') return null;
  const u = p.hero ? g.units.find(x => x.id === p.hero) : null;
  if (u) return { n: u.name, emb: u.hero, lv: u.lv, w: 0 };
  const r = (g.rv || []).find(x => x.o === p.id);
  return r ? { n: r.name, emb: r.emb, lv: Math.max(1, r.lv - S.HERO.loss), w: Math.max(1, r.due - g.turn) } : null;
}
function pairInfo(g, u) {
  const need = BREED_NEED[g.cfg.breed]; if (!need) return null;
  for (const k in (g.pairs || {})) { const [a, b] = k.split('-').map(Number); if (a === u.id || b === u.id) { const o = g.units.find(x => x.id === (a === u.id ? b : a)); return o ? { w: o.name, n: g.pairs[k], need } : null; } }
  return { cd: Math.max(0, (u.bc || 0) - g.turn), need };
}
function snapshot(g, pid, now) {
  const base = {
    code: g.code, status: g.status, turn: g.turn, endsAt: g.endsAt, now: now || Date.now(), hostId: g.hostId, you: pid, cfg: g.cfg, king: g.king === undefined ? null : g.king, winner: g.winner, winners: g.winners || null,
    players: g.players.map(p => ({ id: p.id, name: p.name, color: p.color, bot: p.bot, pers: p.bot ? (p.pers || 'equilibrado') : undefined, auto: !!p.auto, alive: p.alive, ready: p.ready,
      score: g.status === 'lobby' ? 0 : score(g, p), units: g.units.filter(u => u.o === p.id && !isAux(u)).length, cities: g.cities.filter(c => c.owner === p.id).length,
      kills: p.stats.kills, boss: p.stats.boss, pk: p.stats.pk, hero: heroInfo(g, p) })),
  };
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
      mine.push({ id: u.id, o: u.o, name: u.name, x: u.x, y: u.y, lv: u.lv, xp: u.xp, xpn: xpNeed(u.lv), hp: u.hp, pts: u.pts, sk: u.sk, eq: u.eq, inv: u.inv, mp: u.mp, at: u.at,
        e: { maxHp: e.maxHp, def: e.def, dmg: e.dmg, range: e.range, min: e.min, mov: e.mov, attacks: e.attacks, pierce: e.pierce, aura: e.aura, ha: e.ha, fx: e.fx }, pz: u.pz ? 1 : 0, bn: u.bn || null, bc: u.bc || 0, pr: pairInfo(g, u), sm: u.sm ? u.sm.k : null, bs: u.bs || null, hr: u.hero || null, cart: u.cart ? 1 : 0, cap: capOf(u), sc: summonInfo(g, u), cls: u.cls || null, sub: u.sub || null, ord: u.ord || null, nearCity: !!cityNear(g, u) });
    } else if (vis[u.y * w + u.x]) {
      const e = eff(g, u);
      others.push({ id: u.id, o: u.o, name: u.name, x: u.x, y: u.y, lv: u.lv, hp: u.hp, mhp: e.maxHp, w: e.kind, def: e.def, dmg: e.dmg, pz: u.pz ? 1 : 0, sm: u.sm ? u.sm.k : null, bs: u.bs || null, hr: u.hero || null, ct: u.cart ? 1 : 0 });
    }
  }
  for (const c of g.creatures) if (vis[c.y * w + c.x]) {
    const cs = cstats(c, g);
    cre.push({ id: c.id, t: c.t, x: c.x, y: c.y, lv: c.lv, hp: c.hp, mhp: cs.mhp, dmg: cs.dmg, def: Math.round(cs.def * 10) / 10, boss: !!S.CREATURES[c.t].boss, el: c.el || null, hd: c.tg ? 1 : 0, pz: c.pz ? 1 : 0 });
  }
  const sites = g.sites.filter(q => vis[q.y * w + q.x]).map(q => ({ id: q.id, x: q.x, y: q.y, k: q.k }));
  const dip = {};
  for (const o of g.players) if (o.id !== pid && pactOf(g, pid, o.id)) dip[o.id] = pactOf(g, pid, o.id);
  const props = g.props.filter(q => q.from === pid || q.to === pid);
  const brk = {};
  for (const k of Object.keys(g.brk)) { const [a, b] = k.split('-').map(Number); if (a === pid) brk[b] = g.brk[k]; else if (b === pid) brk[a] = g.brk[k]; }
  const cities = [];
  for (const c of g.cities) if (ex[c.y * w + c.x]) {
    const o = { id: c.id, x: c.x, y: c.y, name: c.name, o: c.owner, cap: c.cap, b: c.b || {} };
    if (c.owner === pid) { o.st = c.st; o.crafts = c.crafts; o.cm = cityCrafts(c); o.built = c.built || 0; o.rc = recruitCost(g, pid, c); if (isKing(g, pid)) { o.rcb = {}; for (const k of Object.keys(S.KING.beasts)) o.rcb[k] = beastCost(g, c, k); } const ca = cartOf(g, c); o.cart = ca ? { id: ca.id, x: ca.x, y: ca.y } : null; }
    cities.push(o);
  }
  const log = [];
  for (let i = g.events.length - 1; i >= 0 && log.length < 60; i--) {
    const e = g.events[i];
    if (!e.to || e.to.includes(pid)) log.push({ id: e.id, turn: e.turn, text: e.text, k: e.k });
  }
  return Object.assign(base, { chat: chatFor(g, pid), recap: me ? recapFor(g, me) : null, w, h, terr, vis: vs, mine, others, cre, cities, sites, dip, props, brk, season: { i: S.seasonIdx(g.turn), left: S.SEASON_LEN - ((g.turn - 1) % S.SEASON_LEN) }, log, craftsMax: CRAFTS_PER_TURN, invCap: INV_CAP, maxUnits: MAX_UNITS });
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
  if (g.cfg && g.cfg.hero === undefined) g.cfg.hero = 'no';
  if (g.cfg && g.cfg.botChat === undefined) g.cfg.botChat = 'no';
  g.dip = g.dip || {}; g.props = g.props || []; g.brk = g.brk || {}; g.sites = g.sites || [];
  if (g.cfg) g.cfg.botLevel = g.cfg.botLevel || 'normal';
  if (g.cfg) for (const k of Object.keys(S.WORLD_OPTS)) if (g.cfg[k] === undefined) g.cfg[k] = S.WORLD_OPTS[k].def;
  if (!g.ratio) g.ratio = g.map ? Math.max(0.5, (g.map.w * g.map.w) / Math.pow(Math.max(28, Math.min(52, 22 + g.players.length * 3)), 2)) : 1;
  for (const p of g.players || []) { p.pers = p.pers || 'equilibrado'; p.wr = p.wr || {}; }
  return g;
}

module.exports = {
  createGame, addPlayer, addBot, removePlayer, startGame, cmd, advanceTurn, snapshot, serialize, deserialize,
  refreshUnits, score, COLORS, COLOR_NAMES, eff, cstats, idx, touch,
  chat, chatFor, gainXp, killUnit, rareItem, markSeen, replaceableSlots, replaceBot, releasePlayer, pactOf,
};
