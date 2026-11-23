require('./seed.js');
// v1.64.4: «Dejar ir» a un caído
const E = require('../engine.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Dejar ir');
const g = E.createGame('DJ', 'H', 't'); E.addBot(g, 'azar'); E.startGame(g);
g.graves.push({ id: 9001, o: 0, name: 'Caído', lv: 3, pts: 0, sk: {}, turn: 1 }, { id: 9002, o: 1, name: 'Ajeno', lv: 3, pts: 0, sk: {}, turn: 1 });
const n0 = g.units.length;
E.cmd(g, 0, { a: 'release', g: 9002 });
ok(g.graves.some(x => x.id === 9002), 'no se puede dejar ir al caído de otro jugador');
E.cmd(g, 0, { a: 'release', g: 9001 });
ok(!g.graves.some(x => x.id === 9001), 'el caído desaparece de la lista');
const city = g.cities.find(c => c.owner === 0); city.st.m = { alma: 99, hueso: 99, cuero: 99, hierro: 99 };
const r = E.cmd(g, 0, { a: 'revive', c: city.id, g: 9001 });
ok(g.units.length === n0 && !(g.rv || []).some(x => x.name === 'Caído'), 'ya no se puede resucitar');
ok(!E.snapshot(g, 0).graves.some(x => x.id === 9001), 'tampoco aparece en el estado del cliente');
console.log(fails ? '\n' + fails + ' FALLOS' : '\nOK'); process.exit(fails ? 1 : 0);
