require('./seed.js');
// v1.62.2: contador de enemigos eliminados por personaje
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Contador de eliminados');
const g = E.createGame('KL', 'Host', 't'); Object.assign(g.cfg, { idleTurns: 0, hero: 'si' }); E.addBot(g, 'azar'); E.startGame(g);
const me = g.players[0].id, mine = g.units.filter(u => u.o === me), a = mine[0], b = mine[1];
ok(E.snapshot(g, me).mine.every(u => u.kl === 0), 'todas empiezan con 0 eliminados');
const mkc = (t, x, y) => { const c = { id: 9100 + g.creatures.length, t, x, y, lv: 2, hp: 1, hit: false }; g.creatures.push(c); return c; };
E.killCreature(g, mkc('orco', a.x + 1, a.y), a); E.killCreature(g, mkc('orco', a.x + 1, a.y), a);
ok(a.kl === 2 && !b.kl, 'matar criaturas suma al personaje que da el golpe (2 y 0)');
const foe = g.units.find(u => u.o !== me); foe.hp = 0; E.killUnit(g, foe, { unit: a });
ok(a.kl === 3, 'matar a una unidad enemiga también suma (3)');
ok(E.snapshot(g, me).mine.find(u => u.id === a.id).kl === 3, 'el snapshot envía el contador');
a.hero = a.hero || '👑'; E.killUnit(g, a, { creature: mkc('orco', 0, 0) });
const rv = (g.rv || []).find(r => r.o === me && r.name === a.name); ok(rv && rv.kl === 3, 'al caer el protagonista, el contador se guarda para cuando reaparezca');
if (rv) { rv.due = g.turn; for (const p of g.players) p.ready = true; g.creatures = []; E.advanceTurn(g); const back = g.units.find(u => u.o === me && u.name === a.name); ok(back && back.kl === 3, 'reaparece con sus 3 eliminados'); }
if (fails) { console.log(fails + ' fallos'); process.exit(1); } console.log('OK');
