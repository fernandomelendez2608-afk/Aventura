'use strict';
require('./seed.js');
// Pruebas de: trueque de materiales en la ciudad (v1.49)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const g = E.createGame('M9', 'Host', 't'); E.addBot(g, 'azar'); E.startGame(g);
const c = g.cities.find(x => x.owner === 0 && x.cap);
console.log('Trueque');
c.st.m = { cuero: 1000, hueso: 1000, hierro: 5 };
let r = E.cmd(g, 0, { a: 'conv', c: c.id, from: 'cuero', n: 1 });
ok(!r.err && c.st.m.cuero === 990 && c.st.m.hierro === 6, '10 de cuero → 1 de hierro');
r = E.cmd(g, 0, { a: 'conv', c: c.id, from: 'hueso', n: 100 });
ok(!r.err && !c.st.m.hueso && c.st.m.hierro === 106, '1000 de hueso → 100 de hierro (y no queda un 0 en el almacén)');
r = E.cmd(g, 0, { a: 'conv', c: c.id, from: 'cuero', n: 999 });
ok(!r.err && !c.st.m.cuero && c.st.m.hierro === 205, 'pedir de más convierte solo lo que alcanza (99 → 205 de hierro)');
r = E.cmd(g, 0, { a: 'conv', c: c.id, from: 'hierro', n: 1000 }); ok(!r.err && c.st.m.acero === 25 && c.st.m.hierro === 5, '205 de hierro → 25 de acero (sobran 5)');
r = E.cmd(g, 0, { a: 'conv', c: c.id, from: 'acero', n: 100 }); ok(!r.err && c.st.m.alma === 4 && c.st.m.acero === 1, '25 de acero → 4 de alma');
r = E.cmd(g, 0, { a: 'conv', c: c.id, from: 'alma', n: 1 }); ok(!!r.err && c.st.m.alma === 4, 'sin material suficiente da error y no cambia nada');
c.st.m.alma = 16; r = E.cmd(g, 0, { a: 'conv', c: c.id, from: 'alma', n: 2 }); ok(!r.err && c.st.m.escama === 2 && !('alma' in c.st.m), '16 de alma → 2 escamas');
r = E.cmd(g, 0, { a: 'conv', c: c.id, from: 'escama', n: 1 }); ok(!!r.err, 'la escama es lo más alto: no se convierte');
r = E.cmd(g, 0, { a: 'conv', c: c.id, from: 'cuero', n: -5 }); ok(!!r.err, 'cantidades negativas se rechazan');
const c2 = g.cities.find(x => x.owner !== 0 && x.owner !== null); if (c2) { c2.st.m = { cuero: 50 }; r = E.cmd(g, 0, { a: 'conv', c: c2.id, from: 'cuero', n: 1 }); ok(!!r.err && c2.st.m.cuero === 50, 'no se puede comerciar en ciudades ajenas'); }
ok(S.CONVERT.every(x => S.MATS[x.from] && S.MATS[x.to] && S.MAT_VAL[x.to] * 1 > S.MAT_VAL[x.from] * 1 / 1 - 1e-9 && x.rate * S.MAT_VAL[x.from] > S.MAT_VAL[x.to]), 'siempre sale con pérdida (no se gana valor)');
console.log(fails ? `\n${fails} fallos` : '\nTodo bien');
process.exit(fails ? 1 : 0);
