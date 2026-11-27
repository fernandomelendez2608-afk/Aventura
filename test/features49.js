require('./seed.js');
// v1.81.0: dejar ir a unidades vivas (alma, acero y equipo vuelven al almacén)
const E = require('../engine.js'), S = require('../shared.js'), fs = require('fs');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const g = E.createGame('LG81', 'H', 't'); g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g);
const city = g.cities.find(c => c.owner === 0), mine = () => g.units.filter(u => u.o === 0 && !u.gr && !u.sm && !u.cart);
const u = mine()[1]; u.lv = 20; u.inv.m.hueso = 7; u.inv.it.push({ id: 9001, k: 'daga', t: 'hierro', q: 1, fx: [] });
const a0 = city.st.m.alma || 0, c0 = city.st.m.acero || 0, it0 = city.st.it.length, n0 = mine().length;
u.x = 0; u.y = 0; let r = E.cmd(g, 0, { a: 'dismiss', u: u.id }); ok(!!r.err, 'lejos de la ciudad no se puede (' + (r.err || '') + ')');
u.x = city.x; u.y = city.y; r = E.cmd(g, 0, { a: 'dismiss', u: u.id });
ok(!r.err && mine().length === n0 - 1, 'se despide dentro de la ciudad' + (r.err ? ' (' + r.err + ')' : ''));
ok((city.st.m.alma || 0) === a0 + 4 && (city.st.m.acero || 0) === c0 + 30, `devuelve 4 almas y 30 de acero (nivel 20): ${(city.st.m.alma || 0) - a0}/${(city.st.m.acero || 0) - c0}`);
ok(city.st.it.length >= it0 + 1 && (city.st.m.hueso || 0) >= 7, 'su mochila y equipo vuelven al almacén');
const rest = mine(); const h = rest.find(x => x.hero); if (h) { h.x = city.x; h.y = city.y; ok(!!E.cmd(g, 0, { a: 'dismiss', u: h.id }).err, 'el protagonista no se puede dejar ir'); }
while (mine().length > 1) { const x = mine().find(q => !q.hero) || mine()[0]; if (x.hero) break; x.x = city.x; x.y = city.y; E.cmd(g, 0, { a: 'dismiss', u: x.id }); if (mine().length > 1 && mine().every(q => q.hero)) break; }
ok(mine().length >= 1, 'siempre queda al menos una unidad');

console.log('Destruir equipo');
{ const g2 = E.createGame('SC81', 'H', 't'); g2.cfg.sim = true; E.addBot(g2, 'azar'); E.startGame(g2);
  const c = g2.cities.find(q => q.owner === 0); c.st.m = {}; c.st.it = [];
  const base = S.recipe('espada', 3), en1 = S.ENCHANT_STEPS[0].cost, so1 = S.SOCKET_STEPS[0].cost;
  c.st.it.push({ id: 7001, k: 'espada', t: 3, fx: [S.WEAPON_FX[0]], so: 1, gm: ['rubi1'], rf: 1 }, { id: 7002, k: 'espada', t: 1 });
  const exp = {}; for (const q of [base, en1, so1, S.REFORGE_COST]) for (const k in q) exp[k] = (exp[k] || 0) + q[k];
  const rf = S.scrapRefund(c.st.it[0]); ok(JSON.stringify(rf) === JSON.stringify(exp) || Object.keys(exp).every(k => rf[k] === exp[k]), 'reembolso = construcción + encantamiento + engarce + reforja');
  c.st.m.rubi1 = 0; const r = E.cmd(g2, 0, { a: 'scrap', c: c.id, ids: [7001] });
  ok(!r.err && c.st.it.length === 1, 'se destruye y sale del almacén' + (r.err ? ' (' + r.err + ')' : ''));
  ok(Object.keys(exp).every(k => (c.st.m[k] || 0) === exp[k]), 'el almacén recibe los materiales');
  ok(!(c.st.m.rubi1 > 0) && !Object.keys(c.st.m).some(k => S.gemOf(k) && c.st.m[k] > 0), 'las gemas engastadas no se devuelven');
  const r2 = E.cmd(g2, 0, { a: 'scrap', c: c.id, ids: [7002, 9999] }); ok(!r2.err && c.st.it.length === 0, 'varios a la vez; los ids que no existen se ignoran');
  ok(!!E.cmd(g2, 0, { a: 'scrap', c: c.id, ids: [123456] }).err, 'objeto inexistente da error'); }

console.log('Sin límite de unidades en la Ciudadela');
{ const g3 = E.createGame('UL81', 'H', 't'); Object.assign(g3.cfg, { mode: 'ciudadela', sim: true, breed: 'cinco', gender: 'no' }); E.addBot(g3, 'azar'); E.startGame(g3); g3.cw.next = 999999; g3.creatures = [];
  const P = S.CIT.plaza, c3 = g3.cities[0]; c3.st.m = { cuero: 99999, hueso: 99999, hierro: 99999, acero: 999, alma: 999 };
  let made = 0; for (let i = 0; i < 40; i++) { const r = E.cmd(g3, 0, { a: 'recruit', c: c3.id }); if (!r.err) made++; for (const u of g3.units) { u.moved = false; } }
  const own = () => g3.units.filter(u => u.o === 0 && !u.gr && !u.sm && !u.cart && !u.bld).length;
  ok(own() > 24, 'se pueden tener más de 20/24 unidades reclutando (' + own() + ')');
  ok(E.snapshot(g3, 0).maxUnits >= 500, 'el cliente recibe «sin límite» (' + E.snapshot(g3, 0).maxUnits + ')');
  const [a, b] = g3.units.filter(u => u.o === 0 && !u.gr && !u.sm && !u.cart && !u.bld && !u.bs).slice(0, 2); const before = own();
  for (const u of g3.units) u.mp = 0; a.x = P.x + 5; a.y = P.y + 4; b.x = a.x + 1; b.y = a.y; a.hp = b.hp = 99999; a.bc = b.bc = 0;
  for (let i = 0; i < 8; i++) { for (const u of g3.units) u.mp = 0; a.x = P.x + 5; a.y = P.y + 4; b.x = a.x + 1; b.y = a.y; a.bc = b.bc = 0; E.advanceTurn(g3); if (own() > before) break; }
  ok(own() > before, 'las crías siguen naciendo con más de 20 unidades (' + before + ' → ' + own() + ')'); }
const hh = fs.readFileSync(__dirname + '/../public/index.html', 'utf8'); ok(hh.includes('data-lg') && hh.includes('SH.LETGO') && hh.includes('data-sc='), 'botón en la ficha de la unidad');
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
