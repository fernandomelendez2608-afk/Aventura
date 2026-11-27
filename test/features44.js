require('./seed.js');
// v1.76.0: los bots usan guarniciones y farolas en la Ciudadela
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const g = E.createGame('BOTG1', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.addBot(g, 'azar'); E.startGame(g); g.cw.next = 999999; g.creatures = [];
const city = g.cities[0]; city.st.m = { hierro: 900, cuero: 900, hueso: 900, acero: 300, alma: 120, escama: 40 };
for (let i = 0; i < 40; i++) { city.st.m = Object.fromEntries(Object.keys(city.st.m).map(k => [k, Math.max(city.st.m[k], 400)])); g.creatures = []; g.cw.next = 999999; E.advanceTurn(g); }
const gars = g.units.filter(u => u.gr), bg = gars.filter(u => u.bg !== undefined);
ok(bg.length >= 2, 'los bots reclutan guarniciones (' + bg.length + ')');
ok(new Set(gars.map(u => u.gt)).size >= 3, 'mezclan tipos: ' + [...new Set(gars.map(u => u.gt))].join());
const P = S.CIT.plaza; ok(bg.some(u => Math.abs(u.y - (P.y + 3)) > 1 || Math.abs(u.x - P.x) > 2), 'las guarniciones de bots se colocan en su punto de defensa');
const lamps = g.defs.filter(d => d.k === 'farola').length; ok(lamps >= 1, 'los bots construyen farolas (' + lamps + ')');
ok(g.defs.filter(d => !S.DEFS[d.k].free).length > 0, 'siguen construyendo torres y trampas');
const human = gars.filter(u => u.bg === undefined); ok(human.every(u => u.x !== undefined), 'las guarniciones iniciales del humano no se tocan por flag');
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
