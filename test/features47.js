require('./seed.js');
// v1.79.0: en la Ciudadela se puede criar en cualquier punto dentro de la muralla
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const g = E.createGame('BR79', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; g.cfg.breed = 'cinco'; g.cfg.gender = 'no'; E.addBot(g, 'azar'); E.startGame(g); g.cw.next = 999999; g.creatures = [];
const R = S.CIT.r, P = S.CIT.plaza, mine = g.units.filter(u => u.o === 0 && !u.gr && !u.sm && !u.cart);
const place = (a, b, x, y) => { for (const u of g.units) u.mp = 0; a.x = x; a.y = y; b.x = x + 1; b.y = y; };
const far = Math.abs(R.x0 + 2 - P.x) > 3 ? { x: R.x0 + 2, y: R.y0 + 2 } : { x: R.x1 - 3, y: R.y1 - 3 };
ok(Math.max(Math.abs(far.x - P.x), Math.abs(far.y - P.y)) > 2, 'el punto de prueba está lejos de la plaza');
const [a, b] = mine; for (const u of [a, b]) { u.hp = 9999; u.bc = 0; }
for (let i = 0; i < 3; i++) { place(a, b, far.x, far.y); E.advanceTurn(g); }
const k1 = Math.min(a.id, b.id) + '-' + Math.max(a.id, b.id);
ok(g.pairs && g.pairs[k1] > 0, 'dentro de la muralla pero lejos de la plaza avanza el tiempo juntas');
const g2 = E.createGame('BR79b', 'H', 't'); g2.cfg.mode = 'ciudadela'; g2.cfg.sim = true; g2.cfg.breed = 'cinco'; g2.cfg.gender = 'no'; E.addBot(g2, 'azar'); E.startGame(g2); g2.cw.next = 999999; g2.creatures = [];
const m2 = g2.units.filter(u => u.o === 0 && !u.gr && !u.sm && !u.cart), [c, d] = m2; for (const u of [c, d]) { u.hp = 9999; u.bc = 0; }
for (let i = 0; i < 3; i++) { for (const u of g2.units) u.mp = 0; c.x = R.x0 - 8; c.y = R.y0 - 8; d.x = c.x + 1; d.y = c.y; E.advanceTurn(g2); }
const k2 = Math.min(c.id, d.id) + '-' + Math.max(c.id, d.id);
ok(!(g2.pairs && g2.pairs[k2]), 'fuera de la muralla no cuenta');
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
