require('./seed.js');
// v1.68: defensas de la Ciudadela (torre, escarcha, trampa, barricada)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Defensas de la Ciudadela');
const mk = () => { const g = E.createGame('D1', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g); g.creatures = []; const city = E.citCity(g); city.st.m = { cuero: 99, hueso: 99, hierro: 99, acero: 99, alma: 99 }; return { g, city }; };
const R = S.CIT.r, X = R.x1 + 4, Y = 37; // al este de la muralla, fuera
const clear = g => { const t = g.map.t.split(''), w = g.map.w; for (let y = Y - 6; y <= Y + 6; y++) for (let x = R.x1 + 2; x <= R.x1 + 9; x++) t[y * w + x] = 'g'; g.map.t = t.join(''); g.units.forEach(u => { u.x = 40; u.y = 33; }); };
const build = (g, k, x, y) => E.cmd(g, 0, { a: 'def', op: 'build', k, x, y });
{ const { g, city } = mk(); clear(g);
  const before = Object.assign({}, city.st.m); const r = build(g, 'torre', X, Y);
  ok(!r.err && g.defs.length === 1 && city.st.m.hierro === before.hierro - 12, 'construir una torre gasta materiales del almacén y la coloca');
  ok(build(g, 'torre', X, Y).err, 'no se puede construir sobre otra defensa');
  ok(build(g, 'torre', R.x0 + 3, R.y0 + 3).err, 'no se puede construir dentro de la muralla');
  ok(build(g, 'torre', X + 30, Y).err, 'ni demasiado lejos');
  ok(build(g, 'torre', S.CIT.gates[2].x, S.CIT.gates[2].y).err, 'ni sobre la puerta');
  city.st.m = {}; ok(build(g, 'trampa', X + 1, Y).err, 'sin materiales no se construye');
  city.st.m = { cuero: 99, hueso: 99, hierro: 99, acero: 99, alma: 99 };
  const id = g.defs[0].id; E.cmd(g, 0, { a: 'def', op: 'up', id }); E.cmd(g, 0, { a: 'def', op: 'up', id }); const r3 = E.cmd(g, 0, { a: 'def', op: 'up', id });
  ok(g.defs[0].lv === 3 && r3.err, 'mejora hasta nivel 3 y no pasa de ahí');
  const h0 = city.st.m.hierro; E.cmd(g, 0, { a: 'def', op: 'sell', id }); ok(!g.defs.length && city.st.m.hierro > h0, 'vender devuelve la mitad del coste'); }
{ const { g, city } = mk(); clear(g); build(g, 'torre', X, Y);
  const c = E.spawnCreature(g, 'lobo', X + 3, Y, 4); c.tg = city.id; c.hp = 40; const h = c.hp; E.citDefTick(g); ok(c.hp < h || !g.creatures.includes(c), 'la torre dispara a una criatura en alcance');
  const f = E.spawnCreature(g, 'lobo', X + 12, Y + 1, 4); f.tg = city.id; const hf = f.hp; E.citDefTick(g); ok(f.hp === hf, 'y no a las que están fuera de alcance'); }
{ const { g, city } = mk(); clear(g); const t = build(g, 'torre', X, Y);
  const c = E.spawnCreature(g, 'lobo', X + 2, Y, 4); c.tg = city.id; c.hp = 1; const n = Object.values(city.st.m).reduce((a, b) => a + b, 0); E.citDefTick(g);
  ok(!g.creatures.includes(c) && (g.cit.dk || 0) === 1, 'una criatura abatida por la torre muere y cuenta como baja de defensa'); }
{ const { g, city } = mk(); clear(g); build(g, 'escarcha', X, Y);
  const c = E.spawnCreature(g, 'lobo', X + 2, Y, 4); c.tg = city.id; c.hp = 9999; const h = c.hp; E.citDefTick(g); ok(c.hp < h && c.sl >= 1, 'la torre de escarcha daña y ralentiza'); }
{ const { g, city } = mk(); clear(g); build(g, 'trampa', X, Y);
  const c = E.spawnCreature(g, 'lobo', X + 1, Y, 4); c.tg = city.id; c.hp = 9999; const h = c.hp; E.citDefTick(g);
  ok(c.hp < h && g.defs[0].ch === 2, 'la trampa daña a quien pasa a su lado y gasta una carga');
  g.defs[0].ch = 0; const h2 = c.hp; E.citDefTick(g); ok(c.hp === h2, 'sin cargas no hace nada'); }
{ const { g, city } = mk(); clear(g); build(g, 'barricada', X, Y);
  const ix = E.idx(g); const bl = [{ x: X - 1, y: Y }]; const c = E.spawnCreature(g, 'lobo', X + 3, Y, 4); c.tg = city.id;
  const S0 = require('../shared.js'); const env = (() => { const w = g.map.w; return { terr: null }; })();
  // la criatura no puede atravesar la barricada: reach en esa casilla es imposible
  const cs = E.cstats(c, g); for (let i = 0; i < 6; i++) { E.creaturesTurn(g); } ok(!(c.x === X && c.y === Y), 'una criatura no entra en la casilla de la barricada');
  const d = g.defs[0]; d.hp = 1; const c2 = E.spawnCreature(g, 'lobo', X + 1, Y, 8); c2.tg = city.id; c2.hp = 99999; E.citDefTick(g); ok(!g.defs.length, 'las criaturas pegadas la destrozan');
  build(g, 'barricada', X, Y); g.defs[0].hp = 5; E.cmd(g, 0, { a: 'def', op: 'up', id: g.defs[0].id }); ok(g.defs[0].hp === g.defs[0].max && g.defs[0].lv === 2, 'mejorar la repara'); }
{ const { g } = mk(); clear(g); build(g, 'torre', X, Y); const snap = E.snapshot(g, 0); ok(snap.ct && Array.isArray(snap.ct.df) && snap.ct.df.length === 1 && snap.ct.dcap >= 8, 'el estado enviado al cliente incluye las defensas'); }
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
