'use strict';
// Pruebas de: historial por turnos (gráficas y crónica) (v1.45)
const E = require('../engine.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const g = E.createGame('H7', 'Host', 't'); E.addBot(g, 'azar'); E.addBot(g, 'granjero'); E.startGame(g);
const turns = n => { for (let i = 0; i < n; i++) { for (const p of g.players) p.ready = true; E.advanceTurn(g); } };
console.log('Historial');
ok(g.hist.length === 1 && g.hist[0].p.length === 3, 'se anota el estado al empezar la partida');
turns(5);
ok(g.hist.length === 6 && g.hist[5].t === g.turn, 'una anotación por turno: ' + g.hist.length);
const sn = E.snapshot(g, 0);
ok(sn.hist && sn.hist.ids.length === 3 && sn.hist.rows.length === 6 && sn.hist.rows[0].length === 4, 'la instantánea trae las series de los jugadores');
ok(sn.hist.rows[0][1].length === 3, 'cada punto trae puntos, unidades y ciudades');
console.log('Crónica');
const before = (g.chron || []).length;
g.turn = 99; E.cmd(g, 0, { a: 'rename', u: g.units.find(u => u.o === 0).id, name: 'X' });
g.cities.find(c => c.owner === 0).owner = null; // fuerza algún evento público
for (let i = 0; i < 520; i++) { g.turn++; E.advanceTurn(g); if (g.status !== 'playing') break; }
ok(g.hist.length <= 500, 'el historial se limita a 500 anotaciones: ' + g.hist.length);
ok((g.chron || []).length <= 400, 'la crónica se limita a 400');
const rt = E.deserialize(E.serialize(g));
ok(rt.hist.length === g.hist.length && Array.isArray(rt.chron), 'se guardan y recuperan');
const g2 = E.createGame('H8', 'Host', 't'); E.addBot(g2, 'azar'); E.startGame(g2); delete g2.hist; delete g2.chron;
const old = E.deserialize(E.serialize(g2)); ok(Array.isArray(old.hist) && Array.isArray(old.chron), 'una partida antigua sin historial carga bien');
console.log(fails ? `\n${fails} fallos` : '\nTodo bien');
process.exit(fails ? 1 : 0);
