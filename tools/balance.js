'use strict';
// Herramienta de equilibrio: duelos 1c1 entre builds usando el motor real (doMove/doAttack).
// Uso: node tools/balance.js [armas|clases] [nivel] [tier]
const E = require('../engine.js'), S = require('../shared.js');
const K = S.KINDS, SL = ['casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas'];
function arena() {
  const g = E.createGame('BAL', 'A', 'bal'); E.addBot(g, 'granjero'); g.cfg.sim = true; E.startGame(g);
  g.creatures = []; g.sites = []; g.status = 'playing'; E.touch(g);
  return g;
}
function findRow(g) { // franja de 14 casillas de hierba en una fila sin ciudades (se aplana el terreno)
  const w = g.map.w, n = 14;
  for (let y = 1; y < g.map.h0 - 1; y++) {
    if (g.cities.some(c => Math.abs(c.y - y) <= 2 && c.x <= n + 3)) continue;
    const t = g.map.t.split(''); for (let i = 0; i < n; i++) t[y * w + 1 + i] = 'g'; g.map.t = t.join(''); E.touch(g);
    return { x: 1, y };
  }
  throw new Error('sin fila libre');
}
function build(g, owner, spec, x, y, lv, tier) {
  const u = E.newUnit(g, owner, x, y); u.lv = lv; u.pts = 0;
  const pts = lv - 1; const alloc = spec.alloc || { dano: .45, salud: .30, defensa: .25 };
  let left = pts; for (const k of Object.keys(alloc)) { const n = Math.round(pts * alloc[k]); u.sk[k] = Math.min(n, left); left -= u.sk[k]; } u.sk.dano += left;
  u.eq.arma = { k: spec.w, t: tier };
  if (!K[spec.w].two) u.eq.escudo = { k: 'escudo', t: tier };
  for (const s of SL) u.eq[s] = { k: s, t: tier };
  if (spec.cls) { u.cls = spec.cls; if (spec.sub) u.sub = spec.sub; }
  u.hp = E.eff(g, u).maxHp; return u;
}
function duel(g, row, A, B, lv, tier, aFirst) {
  const w = g.map.w;
  const a = build(g, 0, A, row.x + 3, row.y, lv, tier), b = build(g, 1, B, row.x + 10, row.y, lv, tier);
  const ids = [a.id, b.id], units = () => ids.map(id => g.units.find(u => u.id === id));
  const act = (me, foe) => {
    const e = E.eff(g, me); me.mp = e.mov; me.at = e.attacks; me.acted = false; me.moved = false;
    const want = e.range > 1 ? e.range : 1, tryAtk = () => { for (let i = 0; i < 3 && me.at > 0; i++) { const f = g.units.find(u => u.id === foe.id); if (!f) return; const d = Math.abs(f.x - me.x); if (d < e.min || d > e.range) return; const r = E.doAttack(g, me, 'u', f.id); if (typeof r === 'string') return; } };
    const f0 = g.units.find(u => u.id === foe.id); if (!f0) return;
    // elegir casilla: a distancia ideal (alcance) dentro de mp pasos, sin pasar al enemigo
    let best = me.x, bs = 1e9; const dir = Math.sign(f0.x - me.x) || 1;
    for (let step = (process.env.KITE ? -e.mov : 0); step <= e.mov; step++) { const nx = me.x + step * dir; if (nx < row.x || nx > row.x + 13) continue; const d = Math.abs(f0.x - nx); if (d < 1 || d < e.min || d > e.range) { if (d >= 1 && d <= e.range + e.mov) { /* acercarse */ } else continue; }
      const inR = d >= e.min && d <= e.range; const sc = (inR ? 0 : 100 + d) + Math.abs(d - want) * 0.1 + Math.abs(step) * 0.01; if (sc < bs) { bs = sc; best = nx; } }
    if (best !== me.x) E.doMove(g, me, best, me.y);
    tryAtk();
    if (process.env.TRACE) console.log('  ', me.eq.arma.k, 'x', me.x, 'foe', (g.units.find(u => u.id === foe.id) || {}).x, 'hp', Math.round(me.hp), 'foehp', Math.round((g.units.find(u => u.id === foe.id) || {}).hp));
  };
  for (let round = 0; round < 45; round++) {
    const [ua, ub] = units(); if (!ua || !ub) break;
    const order = aFirst ? [[ua, ub], [ub, ua]] : [[ub, ua], [ua, ub]];
    for (const [me, foe] of order) { const m = g.units.find(u => u.id === me.id); if (m && g.units.find(u => u.id === foe.id)) act(m, foe); }
    E.advanceTurn && 0; // sin avanzar el turno global: regeneraciones por turno no se aplican (se compara daño puro)
    for (const id of ids) { const u = g.units.find(x => x.id === id); if (u && E.eff(g, u).fx.regen) u.hp = Math.min(E.eff(g, u).maxHp, u.hp + E.eff(g, u).maxHp * E.eff(g, u).fx.regen); }
  }
  const [ua, ub] = units(); for (const id of ids) { const i = g.units.findIndex(u => u.id === id); if (i >= 0) g.units.splice(i, 1); } E.touch(g);
  if (ua && !ub) return 1; if (ub && !ua) return 0;
  if (ua && ub) return ua.hp / E.eff(g, ua).maxHp > ub.hp / E.eff(g, ub).maxHp ? 0.6 : 0.4;
  return 0.5;
}
function matrix(specs, lv, tier) {
  const g = arena(), row = findRow(g), n = specs.length, M = specs.map(() => specs.map(() => 0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (i === j) { M[i][j] = 0.5; continue; } const r1 = duel(g, row, specs[i], specs[j], lv, tier, true), r2 = duel(g, row, specs[i], specs[j], lv, tier, false); M[i][j] = (r1 + r2) / 2; }
  return specs.map((s, i) => ({ name: s.name, win: M[i].reduce((a, b, j) => a + (j === i ? 0 : b), 0) / (n - 1) })).sort((a, b) => b.win - a.win);
}
module.exports = { matrix, arena };
if (require.main === module && !['agg','cagg'].includes(process.argv[2])) {
  const mode = ['agg','cagg'].includes(process.argv[2]) ? 'agg' : (process.argv[2] || 'armas'), lv = +process.argv[3] || 10, tier = +process.argv[4] || 3;
  const specs = mode === 'clases'
    ? [{ name: 'sin clase', w: 'espada' }].concat(Object.keys(S.CLASSES).flatMap(c => Object.keys(S.CLASSES[c].sub).map(s => ({ name: c + '/' + s, w: ({ mago: 'baston', cazador: 'arco', nigromante: 'varita', invocador: 'espada', asesino: 'daga', guardian: 'espada', duelista: 'espada', sanador: 'varita' })[c] || 'espada', cls: c, sub: s }))))
    : S.WEAPON_KINDS.map(w => ({ name: w, w }));
  for (const r of matrix(specs, lv, tier)) console.log(r.name.padEnd(26), (r.win * 100).toFixed(0) + '%', '█'.repeat(Math.round(r.win * 40)));
}
// Promedio de varios niveles/tiers y de combate «trabado» y «con retirada»
module.exports.aggregate = function (specs, settings) {
  const acc = {}; specs.forEach(s => { acc[s.name] = []; });
  for (const kite of [false, true]) for (const [lv, tier] of settings) {
    if (kite) process.env.KITE = '1'; else delete process.env.KITE;
    for (const r of matrix(specs, lv, tier)) acc[r.name].push(r.win);
  }
  delete process.env.KITE;
  return Object.entries(acc).map(([name, v]) => ({ name, win: v.reduce((a, b) => a + b, 0) / v.length, min: Math.min(...v), max: Math.max(...v) })).sort((a, b) => b.win - a.win);
};
const CW = { mago: 'baston', cazador: 'arco', nigromante: 'varita', invocador: 'espada', asesino: 'daga', guardian: 'espada', duelista: 'espada', sanador: 'varita', elementalista: 'orbe', bardo: 'espada', alquimista: 'daga', monje: 'espada', paladin: 'espada', berserker: 'hacha' };
module.exports.classSpecs = () => [{ name: 'sin clase', w: 'espada' }].concat(Object.keys(S.CLASSES).flatMap(c => Object.keys(S.CLASSES[c].sub).map(s => ({ name: c + '/' + s, w: CW[c] || 'espada', cls: c, sub: s }))));
if (require.main === module && process.argv[2] === 'cagg') {
  for (const r of module.exports.aggregate(module.exports.classSpecs(), [[14, 3], [20, 4]])) console.log(r.name.padEnd(26), (r.win * 100).toFixed(0) + '%', ' (' + (r.min * 100).toFixed(0) + '–' + (r.max * 100).toFixed(0) + ')');
}
if (require.main === module && process.argv[2] === 'agg') {
  const specs = S.WEAPON_KINDS.map(w => ({ name: w, w }));
  for (const r of module.exports.aggregate(specs, [[10, 3], [20, 4], [5, 2]])) console.log(r.name.padEnd(14), (r.win * 100).toFixed(0) + '%', ' (' + (r.min * 100).toFixed(0) + '–' + (r.max * 100).toFixed(0) + ')');
}
