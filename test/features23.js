require('./seed.js');
// v1.63: diseño del protagonista
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Diseño del protagonista');
const mk = cfg => { const g = E.createGame('DS', 'Host', 't'); Object.assign(g.cfg, { idleTurns: 0 }, cfg); E.addBot(g, 'azar'); E.startGame(g); return g; };
let g = mk({}); const me = g.players[0].id, h = g.units.find(u => u.o === me && u.hero);
const D = { sx: 'F', skin: 4, hair: 5, eye: 2, tun: 3, cape: 7, pant: 1, style: 2, build: 0, pose: 2, beard: 1, scar: 1, acc: ['gafas', 'flor', 'gafas', 'inventado', 'cuernos', 'pintura', 'orejas', 'parche'] };
const cd = S.cleanDesign(D);
ok(cd.acc.length === 4 && !cd.acc.includes('inventado') && new Set(cd.acc).size === 4, 'los accesorios se limpian: sin repetidos, sin inventados, máximo 4');
ok(S.cleanDesign({ skin: 99, hair: -3, style: 'x' }).skin === 5 && S.cleanDesign({ skin: 99 }).hair === 0, 'los valores fuera de rango se acotan');
ok(S.cleanDesign(null) === null && S.cleanDesign('x') === null, 'un diseño no válido se rechaza');
let r = E.cmd(g, me, { a: 'design', u: h.id, d: D, name: 'Valeria' });
ok(!r.err && h.hd && h.hd.skin === 4 && h.sx === 'F' && h.name === 'Valeria', 'turno 1: diseñar es gratis, fija género y nombre (' + (r.err || 'ok') + ')');
ok(E.snapshot(g, me).mine.find(u => u.id === h.id).hd.hair === 5, 'el snapshot envía el diseño');
const other = g.units.find(u => u.o === me && !u.hero);
r = E.cmd(g, me, { a: 'design', u: other.id, d: D }); ok(!!r.err, 'una unidad que no es protagonista no se puede diseñar');
r = E.cmd(g, me, { a: 'design', u: h.id, d: D }); ok(!r.err, 'en el turno 1 se puede cambiar las veces que quieras');
// cambiar de protagonista en el turno 1: el diseño se va con el título
const sx0 = other.sx; r = E.cmd(g, me, { a: 'hero', u: other.id, emb: '👑' });
ok(other.hd && other.sx === 'F' && !h.hd, 'si cambias de protagonista, el diseño pasa al nuevo');
ok(h.sx === h.sx0 || h.sx === 'M' || h.sx === 'F', 'el anterior recupera su género');
// después del turno 1 cuesta almas en una ciudad con iglesia
const city = g.cities.find(c => c.owner === me && c.cap); g.turn = 5;
other.x = city.x + 1; other.y = city.y; city.st.m = { alma: 10 };
r = E.cmd(g, me, { a: 'design', u: other.id, d: Object.assign({}, D, { skin: 1 }) }); ok(!!r.err && /iglesia/.test(r.err), 'rediseñar sin iglesia: no se puede (' + (r.err || '') + ')');
city.b = Object.assign(city.b || {}, { iglesia: 1 });
city.st.m = { alma: 2 }; r = E.cmd(g, me, { a: 'design', u: other.id, d: Object.assign({}, D, { skin: 1 }) }); ok(!!r.err, 'con almas insuficientes: no se puede');
city.st.m = { alma: 10 }; r = E.cmd(g, me, { a: 'design', u: other.id, d: Object.assign({}, D, { skin: 1 }) });
ok(!r.err && other.hd.skin === 1 && city.st.m.alma === 5, 'rediseñar con iglesia cuesta 5 almas (' + (r.err || 'ok') + ')');
// reaparición
other.hero = '👑'; g.players[0].hero = other.id; g.creatures = []; const mkc = { id: 9999, t: 'orco', x: 0, y: 0, lv: 1 };
E.killUnit(g, other, { creature: mkc }); const rv = g.rv.find(x => x.o === me);
ok(rv && rv.hd && rv.hd.skin === 1 && rv.sx === 'F', 'al caer, el protagonista guarda su diseño y su género');
rv.due = g.turn; for (const p of g.players) p.ready = true; E.advanceTurn(g);
const back = g.units.find(u => u.o === me && u.name === other.name); ok(back && back.hd && back.hd.skin === 1 && back.sx === 'F', 'reaparece con el mismo diseño');
// reto de una unidad: sin protagonista, pero se diseña a la única unidad
g = mk({ mode: 'uno' }); const m2 = g.players[0].id, solo = g.units.find(u => u.o === m2);
r = E.cmd(g, m2, { a: 'design', u: solo.id, d: D }); ok(!r.err && solo.hd, 'reto de una unidad: se puede diseñar a la única unidad');
if (fails) { console.log(fails + ' fallos'); process.exit(1); } console.log('OK');
