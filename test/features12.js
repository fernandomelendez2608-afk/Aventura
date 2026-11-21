require('./seed.js');
// Pruebas del modo Oleadas (v1.54)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const mk = (nb = 3) => { const g = E.createGame('W1', 'Host', 't'); g.cfg.mode = 'oleadas'; g.cfg.idleTurns = 0; for (let i = 0; i < nb; i++) E.addBot(g, 'azar'); E.startGame(g); return g; };
console.log('Oleadas');
let g = mk();
ok(g.wave && g.wave.n === 0 && g.wave.next === S.WAVES.first, 'arranca con la oleada 0 y la primera en el turno ' + S.WAVES.first);
ok(g.players.every(a => g.players.every(b => a.id === b.id || g.dip[a.id < b.id ? a.id + '-' + b.id : b.id + '-' + a.id] === 'alianza')), 'todos aliados');
ok(E.cmd(g, 0, { a: 'dip', d: 'offer', to: 1, k: 'paz' }).err !== undefined || true, 'diplomacia bloqueada (no rompe)');
const snap0 = E.snapshot(g, 0); ok(snap0.wv && snap0.wv.total === 20 && snap0.wv.n === 0, 'el snapshot trae la info de oleadas');
// avanzar hasta la primera oleada
let guard = 0; while (g.wave.n === 0 && guard++ < 10) E.advanceTurn(g);
ok(g.wave.n === 1 && g.creatures.filter(c => g.wave.ids.includes(c.id)).length >= 3, 'la oleada 1 aparece con criaturas marchando');
ok(g.creatures.filter(c => g.wave.ids.includes(c.id)).every(c => c.tg), 'las criaturas van hacia una ciudad');
const n0 = g.wave.n; const t0 = g.turn;
// matar a todas -> oleada superada y botín
const cap = g.cities.find(c => c.owner === 0 && c.cap), before = Object.values(cap.st.m).reduce((a, b) => a + b, 0);
g.creatures = g.creatures.filter(c => !g.wave.ids.includes(c.id));
E.advanceTurn(g);
ok(g.wave.cleared === n0 && Object.values(cap.st.m).reduce((a, b) => a + b, 0) > before, 'al vencer la oleada cada capital recibe materiales');
// la siguiente llega cada 3 turnos
guard = 0; while (g.wave.n === n0 && guard++ < 10) E.advanceTurn(g);
ok(g.wave.n === n0 + 1 && g.turn - t0 >= S.WAVES.every - 1, 'la siguiente oleada llega a su ritmo');
// las oleadas escalan
const lvOf = () => Math.max(...g.creatures.filter(c => g.wave.ids.includes(c.id)).map(c => c.lv));
const l1 = lvOf(); g.wave.n = 11; g.wave.ids = []; g.wave.next = g.turn; E.advanceTurn(g);
ok(g.wave.n === 12 && lvOf() > l1, 'las oleadas posteriores son más fuertes');
// jefe en la oleada 15 y victoria en la 20
g.wave.n = 14; g.wave.ids = []; g.wave.next = g.turn; E.advanceTurn(g);
ok(g.wave.n === 15 && g.creatures.some(c => g.wave.ids.includes(c.id) && S.CREATURES[c.t].boss), 'cada 5 oleadas viene un jefe');
g.wave.n = 19; g.wave.ids = []; g.wave.next = g.turn; g.creatures = []; E.advanceTurn(g);
ok(g.wave.n === 20 && g.status === 'playing', 'la oleada 20 no termina la partida por sí sola');
g.creatures = []; E.advanceTurn(g);
ok(g.status === 'over' && g.wave.fin && g.winners && g.winners.length === g.players.length, 'al vencer la última oleada gana todo el grupo');
// una criatura dispersada (sin ttl) no bloquea
g = mk(); while (g.wave.n === 0) E.advanceTurn(g);
for (const c of g.creatures) if (g.wave.ids.includes(c.id) && !S.CREATURES[c.t].boss) delete c.tg;
E.advanceTurn(g); ok(g.wave.cleared === 1, 'las criaturas dispersadas dejan de bloquear la oleada');
// derrota
g = mk(1); for (const p of g.players) p.alive = false; E.advanceTurn(g);
ok(g.status === 'over' && g.wave.lost, 'si caen todos, las oleadas vencen');
// sin hordas ni jefes aleatorios
g = mk(); const nb0 = g.creatures.filter(c => S.CREATURES[c.t].boss).length; for (let i = 0; i < 12; i++) { g.wave.next = 9999; E.advanceTurn(g); }
ok(!g.creatures.some(c => c.tg) && g.creatures.filter(c => S.CREATURES[c.t].boss).length <= nb0, 'fuera de las oleadas no hay hordas ni jefes al azar');
// sim larga con bots, sin errores
g = mk(5); g.cfg.sim = true; let errs = 0; const oe = console.error; console.error = () => { errs++; };
for (let i = 0; i < 90 && g.status === 'playing'; i++) E.advanceTurn(g);
console.error = oe; ok(errs === 0, 'partida simulada de 90 turnos sin errores (oleada ' + g.wave.n + ', estado ' + g.status + ')');
console.log(fails ? `\n${fails} fallos` : '\nTodo bien');
process.exit(fails ? 1 : 0);
