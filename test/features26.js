require('./seed.js');
// v1.64.3: la habilidad General llega a 2 casillas (mitad de efecto)
const E = require('../engine.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Habilidad General: alcance 2');
const g = E.createGame('GA', 'H', 't'); E.addBot(g, 'azar'); E.startGame(g);
const us = g.units.filter(u => u.o === 0 && !u.sm), [gen, a] = us;
for (const u of us) { u.sk.general = 0; u.cls = null; }
gen.sk.general = 10; gen.x = 20; gen.y = 20;
const A = (d) => { a.x = 20 + d; a.y = 20; return E.aura(g, a); };
ok(Math.abs(A(1) - 0.2) < 1e-9, 'pegado: +20 % (' + A(1) + ')');
ok(Math.abs(A(2) - 0.1) < 1e-9, 'a 2 casillas: +10 % (' + A(2) + ')');
ok(A(3) === 0, 'a 3 casillas: nada');
console.log(fails ? '\n' + fails + ' FALLOS' : '\nOK'); process.exit(fails ? 1 : 0);
