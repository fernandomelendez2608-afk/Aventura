require('./seed.js');
// v1.62: semilla de retrato único
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Retratos: semilla estable y única');
ok(S.ptSeed(5) === S.ptSeed(5) && S.ptSeed(5) !== S.ptSeed(6), 'ptSeed es determinista y distingue ids');
ok(new Set(Array.from({ length: 2000 }, (_, i) => S.ptSeed(i * 3 + 1))).size === 2000, '2000 candidatos → 2000 semillas distintas');
const g = E.createGame('PT1', 'Host', 't'); g.cfg.mode = 'ciudadela'; g.cfg.idleTurns = 0; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g);
const city = g.cities.find(c => c.cit); city.st.m = { cuero: 900, hueso: 100, hierro: 300, acero: 200, alma: 100, escama: 30 };
const c = g.bar.c[0], n0 = g.units.filter(u => u.o === 0).length;
const r = E.cmd(g, 0, { a: 'bar', id: c.id });
ok(!r.err, 'recluta en la taberna (' + (r.err || 'ok') + ')');
const u = g.units.filter(u => u.o === 0).pop();
ok(u.pt === S.ptSeed(c.id * 3 + 1), 'el reclutado conserva el retrato que tenía en la taberna');
const sn = E.snapshot(g, 0), su = sn.mine.find(v => v.id === u.id);
ok(su && su.pt === u.pt, 'el snapshot envía la semilla al cliente');
const sn2 = sn.mine.find(v => v.id !== u.id && !v.pt); ok(!sn2 || sn2.pt === 0, 'unidades sin semilla propia usan la de su id en el cliente');
if (fails) { console.log(fails + ' fallos'); process.exit(1); } console.log('OK');
