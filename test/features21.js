require('./seed.js');
// v1.62.1: géneros y crías
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Géneros: requisito para las crías');
const run = (cfg, sa, sb) => {
  const g = E.createGame('GN', 'Host', 't'); Object.assign(g.cfg, { idleTurns: 0, breed: 'tres' }, cfg); E.addBot(g, 'azar'); E.startGame(g);
  const first = g.players[0].id, c = g.cities.find(x => x.owner === first && x.cap), [a, b] = g.units.filter(x => x.o === first);
  g.units = g.units.filter(x => x.o !== first || x === a || x === b);
  for (const p of g.players) if (p.id !== first) p.bot = false;
  a.x = c.x + 1; a.y = c.y + 1; b.x = c.x + 2; b.y = c.y + 1; if (sa) a.sx = sa; if (sb) b.sx = sb; E.touch(g); g.creatures = [];
  return { g, a, b, first };
};
const turns = (g, n) => { for (let i = 0; i < n; i++) { g.creatures = []; for (const p of g.players) p.ready = true; E.advanceTurn(g); } };
const cnt = (g, o) => g.units.filter(x => x.o === o).length;
let r = run({});
ok(r.g.units.filter(u => u.o === r.first).length === 2 && r.a.sx === 'M' && r.b.sx === 'F', 'las unidades iniciales alternan macho y hembra');
ok(S.WORLD_OPTS.gender.def === 'si' && r.g.cfg.gender === 'si', 'ajuste «gender» activado por defecto');
turns(r.g, 3); ok(cnt(r.g, r.first) === 3, '♂ + ♀: hay cría');
const kid = r.g.units.find(x => x.o === r.first && x !== r.a && x !== r.b); ok(kid && (kid.sx === 'M' || kid.sx === 'F'), 'la cría nace con género');
r = run({}, 'M', 'M'); turns(r.g, 6); ok(cnt(r.g, r.first) === 2, '♂ + ♂: no hay cría');
r = run({}, 'F', 'F'); turns(r.g, 6); ok(cnt(r.g, r.first) === 2, '♀ + ♀: no hay cría');
r = run({ gender: 'no' }, 'M', 'M'); turns(r.g, 3); ok(cnt(r.g, r.first) === 3, 'con el ajuste en «no», cualquier pareja puede tener cría');
const sn = E.snapshot(r.g, r.first); ok(sn.mine.every(u => u.sx === 'M' || u.sx === 'F') && sn.mine[0].pr, 'el snapshot envía género e info de pareja');
ok(S.sexOf({ id: 5 }) === S.sexOf({ id: 5 }) && new Set(Array.from({ length: 200 }, (_, i) => S.sexOf({ id: i }))).size === 2, 'unidades antiguas sin género: se deduce de su id (hay de ambos)');
{ const g = E.createGame('GB', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.idleTurns = 0; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g);
  ok(g.bar.c.some(c => c.sx === 'M') && g.bar.c.some(c => c.sx === 'F'), 'la taberna ofrece de los dos géneros');
  const city = g.cities.find(c => c.cit); city.st.m = { cuero: 900, hueso: 100, hierro: 300, acero: 200, alma: 100, escama: 30 };
  const cd = g.bar.c.find(c => c.sx === 'F'), res = E.cmd(g, 0, { a: 'bar', id: cd.id }), u = g.units.filter(x => x.o === 0).pop();
  ok(!res.err && u.sx === 'F', 'la reclutada conserva su género'); }
if (fails) { console.log(fails + ' fallos'); process.exit(1); } console.log('OK');
