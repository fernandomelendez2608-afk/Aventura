'use strict';
/* Aventura de almas — motor del juego (lógica pura, sin red) */
const S = require('./public/shared.js');
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
const MAX_LEVEL = 20;
const INV_CAP = 30;
const CRAFTS_PER_TURN = 4;

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
    cfg: { turnHours: 4, maxTurns: 0 },
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
    aggr: rng(g) < 0.5, stats: { kills: 0, boss: 0, pk: 0 } };
  g.players.push(p);
  return p;
}
function addBot(g) {
  if (g.status !== 'lobby' || g.players.length >= 10) return null;
  const used = new Set(g.players.map(p => p.name));
  const avail = BOT_NAMES.filter(n => !used.has('Bot ' + n));
  return addPlayer(g, 'Bot ' + (avail.length ? pick(g, avail) : g.players.length), true, null);
}
function removePlayer(g, id) {
  if (g.status !== 'lobby') return false;
  const i = g.players.findIndex(p => p.id === id);
  if (i <= 0) return false; // el anfitrión (0) no se quita
  g.players.splice(i, 1);
  g.players.forEach((p, k) => { p.id = k; p.color = COLORS[k]; });
  return true;
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
function ev(g, text, to, kind) {
  g.events.push({ id: g.eid++, turn: g.turn, text, to: to || null, k: kind || '' });
  if (g.events.length > 300) g.events.splice(0, g.events.length - 300);
}
const invW = u => {
  let n = 0; for (const m in u.inv.m) n += u.inv.m[m];
  return n + u.inv.it.length * 2;
};
function addMats(u, mats) { // devuelve lo que no cupo
  const lost = {};
  for (const m in mats) {
    const room = INV_CAP - invW(u);
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
  for (const v of g.units) if (v !== u && v.o === u.o && v.sk.general && cheb(u, v) === 1) a = Math.max(a, 0.02 * v.sk.general);
  return a;
}
function eff(g, u) {
  const w = u.eq.arma;
  let dmgBase = 3, range = 1, min = 1, pierce = 0, movB = 0, single = false, kind = null, tier = 0;
  if (w) {
    const k = K[w.k];
    dmgBase = Math.round(k.base * S.WM[w.t]); range = k.range; min = k.min; pierce = k.pierce || 0; movB = k.mov || 0; single = !!k.single; kind = w.k; tier = w.t;
  }
  let def = 0;
  for (const slot of S.SLOTS) if (slot !== 'arma' && u.eq[slot]) def += K[u.eq[slot].k].def * S.AM[u.eq[slot].t];
  def += 2 * u.sk.defensa;
  const au = aura(g, u);
  return {
    maxHp: Math.round((50 + 6 * u.sk.salud) * (1 + au)),
    def: Math.round(def * (1 + au) * 10) / 10,
    dmg: dmgBase + 2 * u.sk.dano,
    range, min, pierce, kind, tier,
    mov: 3 + u.sk.movilidad + movB,
    attacks: (u.sk.doble && !single) ? 2 : 1,
    aura: au,
  };
}
function cstats(c) {
  const d = S.CREATURES[c.t], L = c.lv;
  return { mhp: Math.round(d.hp * (1 + 0.18 * (L - 1))), dmg: Math.round(d.dmg * (1 + 0.12 * (L - 1))),
    def: d.def + 1.2 * (L - 1), rng: d.rng || 1, min: 1, mov: d.mov, agg: d.agg };
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
  u.xp += n;
  while (u.lv < MAX_LEVEL && u.xp >= xpNeed(u.lv)) {
    u.xp -= xpNeed(u.lv); u.lv++; u.pts++;
    ev(g, `⭐ ${u.name} sube a nivel ${u.lv}. Tiene puntos por gastar.`, [u.o], 'lvl');
  }
  if (u.lv >= MAX_LEVEL) u.xp = 0;
}

/* ---------- generación del mundo ---------- */
function genMap(g) {
  const n = g.players.length;
  const size = Math.max(28, Math.min(52, 22 + n * 3));
  const w = size, h = size;
  const sA = (rng(g) * 1e6) | 0, sB = (rng(g) * 1e6) | 0;
  const t = new Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = x / (w - 1) * 2 - 1, ny = y / (h - 1) * 2 - 1;
    const d = Math.max(Math.abs(nx), Math.abs(ny));
    const hh = fbm(x / 8, y / 8, sA) - Math.pow(d, 5) * 0.4;
    const m = fbm(x / 6, y / 6, sB);
    t[y * w + x] = hh < 0.30 ? 'w' : hh > 0.74 ? 'm' : hh > 0.63 ? 'h' : (m > 0.56 ? 'f' : 'g');
  }
  const carve = (x0, y0, x1, y1) => {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
    for (;;) {
      const k = y0 * w + x0;
      if (t[k] === 'w' || t[k] === 'm') t[k] = 'g';
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
      if (X >= 0 && Y >= 0 && X < w && Y < h && Math.max(Math.abs(dx), Math.abs(dy)) <= 2) t[Y * w + X] = 'g';
    }
  }
  for (let i = 0; i < n; i++) { carve(starts[i].x, starts[i].y, starts[(i + 1) % n].x, starts[(i + 1) % n].y); carve(starts[i].x, starts[i].y, cx, cy); }
  g.map = { w, h, t: null };
  g.cities = [];
  starts.forEach((s, i) => g.cities.push({ id: g.nid++, x: s.x, y: s.y, owner: i, name: 'Capital de ' + g.players[i].name, cap: true, st: { m: { cuero: 10, hueso: 8 }, it: [] }, crafts: 0 }));
  const names = CITY_NAMES.slice();
  const want = n + 3;
  for (let tries = 0; tries < 600 && g.cities.length < n + want; tries++) {
    const x = ri(g, 3, w - 4), y = ri(g, 3, h - 4);
    if (!'gfh'.includes(t[y * w + x])) continue;
    if (g.cities.some(c => cheb(c, { x, y }) < 8)) continue;
    let near = null, nd = 1e9;
    for (const c of g.cities) { const d = cheb(c, { x, y }); if (d < nd) { nd = d; near = c; } }
    carve(x, y, near.x, near.y);
    t[y * w + x] = 'g';
    const stash = {}; stash.cuero = ri(g, 2, 6); stash.hueso = ri(g, 1, 5); if (rng(g) < 0.6) stash.hierro = ri(g, 1, 4); if (rng(g) < 0.2) stash.acero = ri(g, 1, 2);
    g.cities.push({ id: g.nid++, x, y, owner: null, name: names.length ? names.splice(ri(g, 0, names.length - 1), 1)[0] : 'Aldea ' + g.nid, cap: false, st: { m: stash, it: [] }, crafts: 0 });
  }
  for (const c of g.cities) t[c.y * w + c.x] = 'g';
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
function freeLandTile(g, minDistCity, minDistUnit, zone) {
  const w = g.map.w, h = g.map.h, ix = idx(g);
  for (let tries = 0; tries < 200; tries++) {
    const x = ri(g, 1, w - 2), y = ri(g, 1, h - 2), k = y * w + x;
    if (!'gfh'.includes(g.map.t.charAt(k))) continue;
    if (ix.U.has(k) || ix.C.has(k) || ix.T.has(k)) continue;
    if (g.cities.some(c => cheb(c, { x, y }) < minDistCity)) continue;
    if (g.units.some(u => cheb(u, { x, y }) < minDistUnit)) continue;
    if (zone !== undefined && zoneOf(g, x, y) !== zone) continue;
    return { x, y };
  }
  return null;
}
function spawnCreature(g, type, x, y, lv) {
  const d = S.CREATURES[type];
  const c = { id: g.nid++, t: type, x, y, hx: x, hy: y, lv: Math.min(lv, d.max), hp: 1, prov: null, hit: false };
  c.hp = cstats(c).mhp;
  g.creatures.push(c); touch(g);
  return c;
}
function spawnNormal(g, initial) {
  const zone = wpick(g, [[0, initial ? 4 : 3], [1, 3], [2, initial ? 2 : 3]]);
  const pos = freeLandTile(g, initial ? 5 : 4, initial ? 6 : 8, zone);
  if (!pos) return null;
  const type = wpick(g, ZONE_TABLE[zone]);
  const lv = 1 + zone + (initial ? 0 : Math.floor(g.turn / 15));
  return spawnCreature(g, type, pos.x, pos.y, lv);
}
function bossCount(g) { return g.creatures.filter(c => S.CREATURES[c.t].boss).length; }
function spawnBoss(g) {
  const pos = freeLandTile(g, 10, 10, 2) || freeLandTile(g, 8, 8);
  if (!pos) return null;
  const type = pick(g, ['reylobo', 'liche', 'dragon']);
  const lv = 3 + Math.floor(g.turn / 10);
  const c = spawnCreature(g, type, pos.x, pos.y, lv);
  const mid = (g.map.w - 1) / 2;
  const ns = pos.y < mid - 4 ? 'norte' : pos.y > mid + 4 ? 'sur' : '';
  const ew = pos.x < mid - 4 ? 'oeste' : pos.x > mid + 4 ? 'este' : '';
  const dir = ns && ew ? ({ norteoeste: 'noroeste', norteeste: 'noreste', suroeste: 'suroeste', sureste: 'sureste' })[ns + ew] : (ns || ew);
  ev(g, `🐉 Ha aparecido un jefe: ${S.CREATURES[type].n} (nivel ${c.lv}) ${dir ? 'hacia el ' + dir : 'en el centro'} del mapa.`, null, 'boss');
  return c;
}

function startGame(g) {
  if (g.status !== 'lobby') return 'La partida ya empezó';
  if (g.players.length < 2) return 'Se necesitan al menos 2 jugadores (agrega bots)';
  if (!g.players.some(p => !p.bot)) return 'Debe haber al menos un jugador humano';
  genMap(g);
  const w = g.map.w, h = g.map.h;
  for (const p of g.players) p.ex = new Uint8Array(w * h);
  g.cities.filter(c => c.cap).forEach(c => {
    const spots = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dy) continue;
      spots.push({ x: c.x + dx, y: c.y + dy, d: Math.abs(dx) + Math.abs(dy) });
    }
    spots.sort((a, b) => a.d - b.d || rng(g) - 0.5);
    let placed = 0;
    for (const s of spots) {
      if (placed >= 4) break;
      if (!inB(g, s.x, s.y) || !'gfh'.includes(terrAt(g, s.x, s.y))) continue;
      if (idx(g).U.has(s.y * w + s.x) || idx(g).T.has(s.y * w + s.x)) continue;
      newUnit(g, c.owner, s.x, s.y); placed++;
    }
  });
  const cap = Math.round(w * h / 55);
  const n0 = Math.round(cap * 0.6);
  for (let i = 0; i < n0; i++) spawnNormal(g, true);
  g.status = 'playing'; g.turn = 1;
  g.endsAt = Date.now() + g.cfg.turnHours * 3600000;
  for (const p of g.players) p.ready = false;
  refreshUnits(g);
  ev(g, '⚔️ ¡Comienza Aventura de almas! Cada ciudad inicial cuenta con 4 unidades idénticas.', null, 'sys');
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
  for (const u of g.units) if (u.o === pid) mark(u.x, u.y, 20, 4);
  for (const c of g.cities) if (c.owner === pid) mark(c.x, c.y, 30, 5);
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
  if (invW(u) + 2 > INV_CAP) return 'Mochila llena';
  delete u.eq[slot]; u.inv.it.push(it);
  return null;
}
function recruitCost(g, pid) {
  const n = g.units.filter(u => u.o === pid).length;
  const c = { cuero: 2 + n, hueso: 2 + Math.floor(n / 2) };
  if (n >= 6) c.hierro = n - 4;
  return c;
}
function doRecruit(g, p, c) {
  const n = g.units.filter(u => u.o === p.id).length;
  if (n >= MAX_UNITS) return `Máximo ${MAX_UNITS} unidades`;
  const cost = recruitCost(g, p.id);
  if (!canAfford(c.st.m, cost)) return 'Faltan materiales en el almacén: ' + fmtMats(cost);
  const w = g.map.w, ix = idx(g);
  let spot = null;
  for (let r = 1; r <= 2 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
    const x = c.x + dx, y = c.y + dy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inB(g, x, y)) continue;
    const k = y * w + x;
    if (!'gfh'.includes(terrAt(g, x, y)) || ix.U.has(k) || ix.C.has(k)) continue;
    if (ix.T.has(k) && !(x === c.x && y === c.y)) continue;
    spot = { x, y };
  }
  if (!spot) return 'No hay espacio libre alrededor de la ciudad';
  spend(c.st.m, cost);
  const u = newUnit(g, p.id, spot.x, spot.y);
  u.mp = 0; u.at = 0; // llega cansada
  return null;
}
function doCraft(g, p, c, kind, tier) {
  if (!K[kind] || !(tier >= 1 && tier <= 4)) return 'Receta inválida';
  if (c.crafts >= CRAFTS_PER_TURN) return 'Esta ciudad ya forjó el máximo este turno';
  const cost = S.recipe(kind, tier);
  if (!canAfford(c.st.m, cost)) return 'Faltan materiales: ' + fmtMats(cost);
  spend(c.st.m, cost);
  const it = { id: g.nid++, k: kind, t: tier };
  c.st.it.push(it); c.crafts++;
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
      const o = ix.U.get(k);
      if (!o) return 0;
      return o.o === u.o ? 1 : 2;
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
  u.mp = 0;
  const p = g.players[u.o];
  ev(g, `🏰 ${p.name} conquista ${c.name}.`, null, 'city');
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
  return null;
}
function rollDrops(g, c) {
  const d = S.CREATURES[c.t], out = {};
  for (const m in d.drops) {
    const lo = d.drops[m][0], hi = d.drops[m][1];
    const n = Math.round(ri(g, lo, hi) * (1 + 0.25 * (c.lv - 1)));
    if (n > 0) out[m] = n;
  }
  if (d.soul && rng(g) < d.soul * c.lv) out.alma = (out.alma || 0) + 1;
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
  gainXp(g, u, d.xp + 3 * c.lv);
  const got = {}; for (const m in drops) { const n = drops[m] - (lost[m] || 0); if (n > 0) got[m] = n; }
  let msg = `${u.name} derrota a ${d.n} (niv. ${c.lv}).` + (Object.keys(got).length ? ' Botín: ' + fmtMats(got) + '.' : '');
  if (Object.keys(lost).length) msg += ` ⚠️ Mochila llena, se perdió: ${fmtMats(lost)}.`;
  ev(g, msg, [u.o], 'loot');
  if (d.boss) ev(g, `🏆 ${p.name} ha derrotado al jefe ${d.n}.`, null, 'boss');
}
function killUnit(g, u, by) { // by: {unit} o {creature}
  g.units.splice(g.units.indexOf(u), 1); touch(g);
  const p = g.players[u.o];
  if (by.unit) {
    const k = by.unit, kp = g.players[k.o];
    kp.stats.pk++;
    addMats(k, u.inv.m);
    for (const it of u.inv.it) if (invW(k) + 2 <= INV_CAP) k.inv.it.push(it);
    for (const s in u.eq) if (rng(g) < 0.5 && invW(k) + 2 <= INV_CAP) k.inv.it.push(u.eq[s]);
    gainXp(g, k, 12 + 3 * u.lv);
    ev(g, `💀 ${kp.name} abate a ${u.name} de ${p.name}.`, null, 'pvp');
  } else {
    ev(g, `💀 ${u.name} ha caído ante ${S.CREATURES[by.creature.t].n}.`, [u.o], 'dead');
  }
}
function doAttack(g, u, tt, tid) {
  const tgt = tt === 'c' ? g.creatures.find(c => c.id === tid) : g.units.find(x => x.id === tid && x.o !== u.o);
  if (!tgt) return 'Objetivo no válido';
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
  if (e.range > 1 && dist === 1) raw *= 0.6;
  let defv, thp;
  if (tt === 'c') defv = cstats(tgt).def + terrDef(g, tgt.x, tgt.y);
  else defv = eff(g, tgt).def + terrDef(g, tgt.x, tgt.y);
  const dmg = calcDamage(raw, defv, e.pierce);
  tgt.hp -= dmg; tgt.hit = true;
  u.at--; u.hits++; u.mp = 0; u.acted = true;
  gainXp(g, u, 1);
  let msg = `${u.name} golpea a ${tt === 'c' ? S.CREATURES[tgt.t].n : tgt.name} (−${dmg}).`;
  if (tt === 'c') {
    const cd = S.CREATURES[tgt.t];
    if (tgt.hp <= 0) { killCreature(g, tgt, u); return { msg: msg + ' ¡Derrotado!' }; }
    tgt.prov = u.id;
    const cs = cstats(tgt);
    if (dist >= cs.min && dist <= cs.rng) {
      const rd = calcDamage(cs.dmg, e.def + terrDef(g, u.x, u.y), 0);
      u.hp -= rd; msg += ` Contraataque −${rd}.`;
      if (u.hp <= 0) { killUnit(g, u, { creature: tgt }); return { msg: msg + ' Tu unidad cae.' }; }
    }
  } else {
    if (tgt.hp <= 0) { killUnit(g, tgt, { unit: u }); return { msg: msg + ' ¡Eliminada!' }; }
    ev(g, `⚔️ ${g.players[u.o].name} ataca a ${tgt.name} (−${dmg}).`, [tgt.o], 'hit');
    const te = eff(g, tgt);
    if (dist >= te.min && dist <= te.range) {
      let rraw = te.dmg;
      if (te.range > 1 && dist === 1) rraw *= 0.6;
      const rd = calcDamage(rraw, e.def + terrDef(g, u.x, u.y), te.pierce);
      u.hp -= rd; msg += ` Contraataque −${rd}.`;
      if (u.hp <= 0) { killUnit(g, u, { unit: tgt }); return { msg: msg + ' Tu unidad cae.' }; }
    }
  }
  return { msg };
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
  const unitOf = () => g.units.find(u => u.id === m.u && u.o === pid);
  const cityOf = () => g.cities.find(c => c.id === m.c && c.owner === pid);
  let err = null, msg = '';
  switch (m.a) {
    case 'move': {
      const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' };
      err = doMove(g, u, m.x | 0, m.y | 0); break;
    }
    case 'attack': {
      const u = unitOf(); if (!u) return { err: 'Unidad no encontrada' };
      const r = doAttack(g, u, m.tt === 'u' ? 'u' : 'c', m.id | 0);
      if (typeof r === 'string') err = r; else msg = r.msg;
      break;
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
        const room = INV_CAP - invW(u);
        const n = Math.min(m.n | 0, c.st.m[m.m] || 0, room);
        if (n <= 0) err = room <= 0 ? 'Mochila llena' : 'No hay en el almacén';
        else { c.st.m[m.m] -= n; if (!c.st.m[m.m]) delete c.st.m[m.m]; u.inv.m[m.m] = (u.inv.m[m.m] || 0) + n; }
      } else if (m.a === 'wdi') {
        const i = c.st.it.findIndex(x => x.id === (m.i | 0));
        if (i < 0) err = 'No está en el almacén';
        else if (invW(u) + 2 > INV_CAP) err = 'Mochila llena';
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
      err = doRecruit(g, p, c); if (!err) msg = 'Nueva unidad reclutada (descansa este turno)';
      break;
    }
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
function creaturesTurn(g) {
  for (const c of g.creatures.slice()) {
    if (!g.creatures.includes(c)) continue;
    const d = S.CREATURES[c.t], cs = cstats(c);
    let target = null;
    if (c.prov) {
      const pu = g.units.find(u => u.id === c.prov);
      if (pu && cheb(pu, c) <= 10) target = pu; else c.prov = null;
    }
    if (!target && cs.agg > 0) {
      let bd = 1e9;
      for (const u of g.units) { const dd = cheb(u, c); if (dd <= cs.agg && (dd < bd || (dd === bd && target && u.hp < target.hp))) { bd = dd; target = u; } }
      if (target && cheb(target, { x: c.hx, y: c.hy }) > (d.boss ? 9 : 7)) target = null; // correa
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
        let raw = cs.dmg;
        const dmg = calcDamage(raw, e.def + terrDef(g, target.x, target.y), 0);
        target.hp -= dmg;
        ev(g, `🩸 ${S.CREATURES[c.t].n} (niv. ${c.lv}) ataca a ${target.name} (−${dmg}).`, [target.o], 'hit');
        if (target.hp <= 0) { killUnit(g, target, { creature: c }); c.prov = null; continue; }
        // contraataque
        const ue = eff(g, target);
        if (dist >= ue.min && dist <= ue.range) {
          const rd = calcDamage(ue.dmg * ((ue.range > 1 && dist === 1) ? 0.6 : 1), cs.def + terrDef(g, c.x, c.y), ue.pierce);
          c.hp -= rd; c.hit = true;
          if (c.hp <= 0) { killCreature(g, c, target); continue; }
        }
      }
    } else if (rng(g) < 0.4) {
      const dir = pick(g, S.DIRS);
      const x = c.x + dir[0], y = c.y + dir[1];
      if (inB(g, x, y) && 'gfh'.includes(terrAt(g, x, y)) && cheb({ x, y }, { x: c.hx, y: c.hy }) <= 5) {
        const ix = idx(g), k = y * g.map.w + x;
        if (!ix.U.has(k) && !ix.C.has(k) && !ix.T.has(k)) { c.x = x; c.y = y; touch(g); }
      }
    }
  }
}
function worldTick(g) {
  if (g.turn % 10 === 0) {
    for (const c of g.creatures) {
      if (c.lv < S.CREATURES[c.t].max) { c.lv++; c.hp = cstats(c).mhp; }
    }
  }
  for (const c of g.creatures) {
    if (!c.hit) c.hp = Math.min(cstats(c).mhp, c.hp + Math.ceil(cstats(c).mhp * 0.1));
    c.hit = false;
  }
  const cap = Math.round(g.map.w * g.map.h / 55);
  const n = Math.max(1, Math.round(g.players.length * 0.5));
  for (let i = 0; i < n && g.creatures.length < cap; i++) spawnNormal(g, false);
  if (g.turn >= 4 && g.turn % 5 === 0 && bossCount(g) < Math.floor(g.players.length / 3) + 1) spawnBoss(g);
}

/* ---------- inicio de turno ---------- */
function refreshUnits(g) {
  for (const u of g.units) {
    const e = eff(g, u);
    let heal = 0, mpct = 0;
    for (const v of g.units) if (v !== u && v.o === u.o && v.sk.medico && cheb(u, v) === 1) mpct += v.sk.medico * 0.04;
    heal += Math.min(mpct, 0.5) * e.maxHp;
    if (cityNear(g, u)) heal += 0.25 * e.maxHp;
    if (!u.moved && !u.acted && u.hp < e.maxHp) heal += 0.1 * e.maxHp;
    u.hp = Math.min(e.maxHp, Math.round(u.hp + heal));
    u.mp = e.mov; u.at = e.attacks; u.hits = 0; u.moved = false; u.acted = false;
  }
  for (const c of g.cities) c.crafts = 0;
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
    const units = g.units.filter(u => u.o === p.id).length;
    const cities = g.cities.filter(c => c.owner === p.id);
    const canRec = cities.some(c => canAfford(c.st.m, recruitCost(g, p.id)));
    if (units === 0 && !canRec) {
      p.alive = false;
      for (const c of cities) c.owner = null;
      ev(g, `☠️ ${p.name} ha sido eliminado.`, null, 'sys');
    }
  }
  const alive = g.players.filter(p => p.alive);
  const humans = alive.filter(p => !p.bot);
  const limit = g.cfg.maxTurns > 0 && g.turn >= g.cfg.maxTurns;
  if (alive.length <= 1 || (humans.length === 0 && !g.cfg.sim) || limit) {
    g.status = 'over';
    const pool = alive.length ? alive : g.players;
    g.winner = pool.slice().sort((a, b) => score(g, b) - score(g, a))[0].id;
    ev(g, `🏁 Fin de la partida. Gana ${g.players[g.winner].name}.`, null, 'sys');
    return true;
  }
  return false;
}
function advanceTurn(g) {
  if (g.status !== 'playing') return;
  g._dm = {};
  for (const p of g.players) if (p.alive && p.bot) { try { botTurn(g, p); } catch (e) { console.error('bot error', e); } }
  creaturesTurn(g);
  worldTick(g);
  if (checkEnd(g)) { g.dirty = true; return; }
  g.turn++;
  refreshUnits(g);
  for (const p of g.players) p.ready = false;
  g.endsAt = Date.now() + g.cfg.turnHours * 3600000;
  ev(g, `— Turno ${g.turn} —`, null, 'turn');
  g.dirty = true;
}

/* ---------- bots ---------- */
function botPickSkill(u) {
  const w = ROLE_W[u.role] || ROLE_W.frontal;
  const tab = [];
  for (const s of S.SKILL_ORDER) if (u.sk[s] < S.SKILLS[s].cap) tab.push([s, (w[s] || 0.2) * (1 + 0.3 * u.sk[s])]);
  return tab.length ? tab : null;
}
function ehp(hp, def) { return hp / (1 - def / (def + 60)); }
function botGear(g, p, c, u) {
  if (!u.role || !u.pref) return;
  const slots = ['arma', 'pechera', 'casco', 'pantalones', 'escudo', 'botas', 'hombreras', 'guantes'];
  for (const slot of slots) {
    let kinds;
    if (slot === 'arma') kinds = [u.pref];
    else if (slot === 'escudo') { if (!(u.role === 'frontal' || u.role === 'tanque') || (u.eq.arma && K[u.eq.arma.k].two) || K[u.pref].two) continue; kinds = ['escudo']; }
    else kinds = [slot];
    const cur = u.eq[slot] ? u.eq[slot].t : 0;
    const have = c.st.it.filter(it => kinds.includes(it.k) && it.t > cur).sort((a, b) => b.t - a.t)[0];
    let item = have;
    if (!item && c.crafts < CRAFTS_PER_TURN) {
      for (let t = 4; t > cur; t--) {
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
  for (const c of g.cities.filter(c => c.owner === p.id)) {
    const near = g.units.filter(u => u.o === p.id && cheb(u, c) <= 1);
    for (const u of near) depositAll(g, u, c);
    for (const u of near) botGear(g, p, c, u);
    for (const u of near) { // sobrante de objetos desequipados vuelve al almacén
      for (const it of u.inv.it) c.st.it.push(it);
      u.inv.it = [];
    }
    const n = g.units.filter(u => u.o === p.id).length;
    if (n < 8 && g.turn >= 2) doRecruit(g, p, c);
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
  const sq = squadPower(g, squad);
  let cx = 0, cy = 0; for (const u of squad) { cx += u.x; cy += u.y; }
  const cen = { x: Math.round(cx / squad.length), y: Math.round(cy / squad.length) };
  let best = null;
  const consider = (cand, value, dist) => { const s = value / (dist + 4); if (!best || s > best.s) best = { s, ...cand }; };
  for (const c of g.creatures) {
    const d = cheb(c, cen); if (d > 18) continue;
    const cs = cstats(c), cd = S.CREATURES[c.t];
    const power = cs.dmg * ehp(cs.mhp, cs.def);
    const need = cd.boss ? 2.2 : 1.3;
    if (sq.pw < need * power) continue;
    p._ok.add(c.id);
    consider({ x: c.x, y: c.y, ty: 'c' }, 10 + 4 * c.lv + (cd.boss ? 60 : 0) + cd.xp * 0.5, d);
  }
  for (const c of g.cities) {
    if (c.owner === p.id) continue;
    const d = cheb(c, cen);
    if (c.owner === null) consider({ x: c.x, y: c.y, ty: 'city' }, 34, d);
    else if (p.aggr || g.turn > 40) {
      const defenders = g.units.filter(u => u.o === c.owner && cheb(u, c) <= 3);
      const dp = squadPower(g, defenders);
      if (sq.pw > 1.3 * dp.pw) consider({ x: c.x, y: c.y, ty: 'city' }, 46, d);
    }
  }
  if (p.aggr || g.turn > 40) {
    for (const o of g.units) {
      if (o.o === p.id) continue;
      const d = cheb(o, cen); if (d > 12) continue;
      const near = g.units.filter(v => v.o === o.o && cheb(v, o) <= 3);
      const op = squadPower(g, near);
      if (sq.pw > 1.3 * op.pw) { p._ok.add('u' + o.id); consider({ x: o.x, y: o.y, ty: 'u' }, 38 + o.lv * 2, d); }
    }
  }
  return best;
}
function bestAttack(g, p, u, e) {
  const w = g.map.w;
  const r = S.reach(envFor(g, u), u.x, u.y, u.mp);
  const reachRange = u.mp + e.range + 1;
  const targets = [];
  for (const c of g.creatures) if (cheb(c, u) <= reachRange && p._ok.has(c.id)) {
    const cs = cstats(c);
    targets.push({ tt: 'c', ref: c, x: c.x, y: c.y, hp: c.hp, def: cs.def + terrDef(g, c.x, c.y), boss: !!S.CREATURES[c.t].boss });
  }
  for (const o of g.units) if (o.o !== p.id && cheb(o, u) <= reachRange && p._ok.has('u' + o.id)) {
    targets.push({ tt: 'u', ref: o, x: o.x, y: o.y, hp: o.hp, def: eff(g, o).def + terrDef(g, o.x, o.y), boss: false });
  }
  if (!targets.length) return null;
  const threats = [];
  for (const c of g.creatures) { const cs = cstats(c); if (cs.agg > 0 || c.prov) threats.push({ x: c.x, y: c.y, dmg: cs.dmg }); }
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
      const raw = e.dmg * (u.hits === 0 ? 1 : 0.6) * ((e.range > 1 && d === 1) ? 0.6 : 1);
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
    if (!u.role) {
      u.role = ROLES[i % ROLES.length];
      u.pref = u.role === 'arquero' ? pick(g, ['arco', 'arcolargo', 'ballesta']) : u.role === 'medico' ? 'daga' : 'espada';
    }
    while (u.pts > 0) {
      const tab = botPickSkill(u); if (!tab) break;
      applySkill(u, wpick(g, tab));
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
  for (const u of units) botUnit(g, p, u, target);
}

/* ---------- instantánea para un jugador ---------- */
function snapshot(g, pid, now) {
  const base = {
    code: g.code, status: g.status, turn: g.turn, endsAt: g.endsAt, now: now || Date.now(), hostId: g.hostId, you: pid, cfg: g.cfg, winner: g.winner,
    players: g.players.map(p => ({ id: p.id, name: p.name, color: p.color, bot: p.bot, alive: p.alive, ready: p.ready,
      score: g.status === 'lobby' ? 0 : score(g, p), units: g.units.filter(u => u.o === p.id).length, cities: g.cities.filter(c => c.owner === p.id).length,
      kills: p.stats.kills, boss: p.stats.boss, pk: p.stats.pk })),
  };
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
        e: { maxHp: e.maxHp, def: e.def, dmg: e.dmg, range: e.range, min: e.min, mov: e.mov, attacks: e.attacks, pierce: e.pierce, aura: e.aura }, nearCity: !!cityNear(g, u) });
    } else if (vis[u.y * w + u.x]) {
      const e = eff(g, u);
      others.push({ id: u.id, o: u.o, name: u.name, x: u.x, y: u.y, lv: u.lv, hp: u.hp, mhp: e.maxHp, w: e.kind, def: e.def, dmg: e.dmg });
    }
  }
  for (const c of g.creatures) if (vis[c.y * w + c.x]) {
    const cs = cstats(c);
    cre.push({ id: c.id, t: c.t, x: c.x, y: c.y, lv: c.lv, hp: c.hp, mhp: cs.mhp, dmg: cs.dmg, def: Math.round(cs.def * 10) / 10, boss: !!S.CREATURES[c.t].boss });
  }
  const cities = [];
  for (const c of g.cities) if (ex[c.y * w + c.x]) {
    const o = { id: c.id, x: c.x, y: c.y, name: c.name, o: c.owner, cap: c.cap };
    if (c.owner === pid) { o.st = c.st; o.crafts = c.crafts; o.rc = recruitCost(g, pid); }
    cities.push(o);
  }
  const log = [];
  for (let i = g.events.length - 1; i >= 0 && log.length < 60; i--) {
    const e = g.events[i];
    if (!e.to || e.to.includes(pid)) log.push({ id: e.id, turn: e.turn, text: e.text, k: e.k });
  }
  return Object.assign(base, { w, h, terr, vis: vs, mine, others, cre, cities, log, craftsMax: CRAFTS_PER_TURN, invCap: INV_CAP, maxUnits: MAX_UNITS });
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
  return JSON.parse(s, (k, v) => (v && typeof v === 'object' && v.__u8 !== undefined) ? new Uint8Array(Buffer.from(v.__u8, 'base64')) : v);
}

module.exports = {
  createGame, addPlayer, addBot, removePlayer, startGame, cmd, advanceTurn, snapshot, serialize, deserialize,
  refreshUnits, score, COLORS, COLOR_NAMES, eff, cstats, idx, touch,
};
