'use strict';
// Pruebas de: mochila 45, objeto Mochila, prioridad de botín y mercader equilibrado (v1.46)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const g = E.createGame('M8', 'Host', 't'); E.addBot(g, 'azar'); E.startGame(g);
const P = g.players[0], u = g.units.find(x => x.o === P.id && !x.cart);
console.log('Capacidad y mochila');
ok(E.capOf(u) === 45, 'la mochila base es de 45: ' + E.capOf(u));
u.eq.mochila = { id: g.nid++, k: 'mochila', t: 3, r: 0, fx: [], so: 0, gm: [] };
ok(E.capOf(u) === 45 + S.PACK[3], 'la Mochila de acero suma +' + S.PACK[3] + ': ' + E.capOf(u));
ok(S.PACK[5] > S.PACK[4] && S.PACK[4] > S.PACK[3] && S.PACK[3] > S.PACK[2] && S.PACK[2] > S.PACK[1], 'más material, más espacio');
const st = E.eff(g, u); ok(Number.isFinite(st.def), 'la mochila no rompe las estadísticas (def ' + st.def + ')');
console.log('Equipar');
delete u.eq.mochila; u.inv = { m: {}, it: [] };
const city = g.cities.find(c => c.owner === P.id && c.cap); u.x = city.x; u.y = city.y; E.touch(g);
const bag = { id: g.nid++, k: 'mochila', t: 2, r: 0, fx: [], so: 0, gm: [] }; u.inv.it.push(bag);
let r = E.cmd(g, P.id, { a: 'equip', u: u.id, i: bag.id }); ok(!r.err && u.eq.mochila === bag && E.capOf(u) === 45 + S.PACK[2], 'se equipa y amplía el inventario');
u.inv.m = { cuero: 45 + S.PACK[2] - 2 }; r = E.cmd(g, P.id, { a: 'unequip', u: u.id, s: 'mochila' }); ok(!!r.err && u.eq.mochila === bag, 'no se la puede quitar con la carga por encima de 45');
u.inv.m = { cuero: 10 }; r = E.cmd(g, P.id, { a: 'unequip', u: u.id, s: 'mochila' }); ok(!r.err && !u.eq.mochila, 'con poca carga sí');
console.log('Forja');
const fg = E.createGame('M9', 'Host', 't'); E.addBot(fg, 'azar'); E.startGame(fg);
const fc = fg.cities.find(c => c.owner === 0 && c.cap); fc.st.m = { cuero: 20, hierro: 20 }; fc.crafts = 0;
const fu = fg.units.find(x => x.o === 0); fu.x = fc.x; fu.y = fc.y; E.touch(fg);
r = E.cmd(fg, 0, { a: 'craft', c: fc.id, k: 'mochila', tr: 1 }); ok(!r.err && fc.st.it.some(i => i.k === 'mochila'), 'se forja una mochila de cuero' + (r.err ? ' (' + r.err + ')' : ''));
console.log('Prioridad del botín');
const w = { inv: { m: { hueso: 20, cuero: 20 }, it: [] }, eq: {}, o: 0 };
const dropped = {}; let lost = E.addMats(w, { hueso: 8, alma: 5, rubi3: 1, acero: 4 }, dropped);
ok(!lost.alma && !lost.rubi3 && !lost.acero, 'almas, gema y acero entran aunque la mochila esté llena de hueso/cuero');
ok((w.inv.m.alma || 0) === 5 && w.inv.m.rubi3 === 1 && w.inv.m.acero === 4, 'están todos en la mochila');
ok((dropped.hueso || 0) + (dropped.cuero || 0) > 0 && E.invW(w) <= 45, 'se descartó cuero/hueso para hacer sitio (' + JSON.stringify(dropped) + ')');
const w2 = { inv: { m: { alma: 45 }, it: [] }, eq: {}, o: 0 }; lost = E.addMats(w2, { hueso: 5 }, {}); ok(lost.hueso === 5 && w2.inv.m.alma === 45, 'lo barato nunca desplaza a lo valioso');
const big = { inv: { m: { hueso: 45 }, it: [] }, eq: {}, o: 0 }; lost = E.addMats(big, { cuero: 40, alma: 30 }, {}); ok(big.inv.m.alma === 30, 'un botín de 30+ conserva las 30 almas');
console.log('Jefe con botín enorme');
const bg = E.createGame('M10', 'Host', 't'); E.addBot(bg, 'azar'); E.startGame(bg);
const bu = bg.units.find(x => x.o === 0); bu.inv = { m: { hueso: 25, cuero: 20 }, it: [{ id: 9001, k: 'espada', t: 1 }, { id: 9002, k: 'espada', t: 1 }, { id: 9003, k: 'espada', t: 1 }].slice(0, 0) };
let kept = 0, tries = 0;
for (let i = 0; i < 12; i++) {
  bu.inv = { m: { hueso: 25, cuero: 20 }, it: [] };
  const c = E.spawnCreature(bg, 'dragon', bu.x + 1, bu.y, 12); E.killCreature(bg, c, bu); tries++;
  if (bu.inv.it.length >= 1) kept++;
  if (E.invW(bu) > E.capOf(bu)) { ok(false, 'la mochila no supera su capacidad'); break; }
}
ok(kept === tries, 'el objeto raro del jefe siempre se conserva con la mochila llena (' + kept + '/' + tries + ')');
console.log('Mercader');
const mg = E.createGame('M11', 'Host', 't'); E.addBot(mg, 'azar'); E.startGame(mg);
let bad = 0, n = 0;
for (let i = 0; i < 60; i++) { for (const o of E.merchOffers(mg)) { n++;
  const cv = Object.keys(o.cost).reduce((a, k) => a + o.cost[k] * (S.MAT_VAL[k] || 0), 0);
  const gv = (o.item ? S.itemVal(o.item) : 0) + Object.keys(o.give).reduce((a, k) => a + o.give[k] * (S.MAT_VAL[k] || 0), 0);
  if (o.k !== 'map' && (cv < gv * 1.2 || cv > gv * 1.9)) bad++; } }
ok(bad === 0, 'precios entre ×1,2 y ×1,9 del valor de lo que venden (' + bad + ' fuera de rango de ' + n + ')');
mg.merch = [{ id: 77, x: 5, y: 5, name: 'T', until: 99, offers: E.merchOffers(mg) }];
const mu = mg.units.find(x => x.o === 0); mu.x = 5; mu.y = 5; E.touch(mg);
const m0 = mg.merch[0], g0 = m0.offers.findIndex(o => o.k === 'gem'), other = m0.offers.findIndex((o, i) => i !== g0 && o.k !== 'map'), before = JSON.stringify(m0.offers[other].cost);
mu.inv = { m: Object.assign({}, m0.offers[g0].cost), it: [] }; r = E.cmd(mg, 0, { a: 'merch', id: 77, i: g0, u: mu.id });
ok(!r.err && JSON.stringify(m0.offers[other].cost) !== before, 'tras una venta, lo que queda sube de precio');
console.log(fails ? `\n${fails} fallos` : '\nTodo bien');
process.exit(fails ? 1 : 0);
