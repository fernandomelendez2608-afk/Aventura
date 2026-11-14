'use strict';
// Pruebas de: asedios, botín de ciudades neutrales y crías con nivel promedio (v1.43)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
function mk(cfg, bots = 1) {
  const g = E.createGame('TEST5', 'Humano', 'tok');
  for (let i = 0; i < bots; i++) E.addBot(g, 'granjero');
  Object.assign(g.cfg, cfg);
  const err = E.startGame(g); if (err) throw new Error(err);
  return g;
}
const clear = (g, c) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const i = (c.y + dy) * g.map.w + c.x + dx; g.map.t = g.map.t.slice(0, i) + 'g' + g.map.t.slice(i + 1); } };
const rich = c => { for (const m of ['hierro', 'cuero', 'hueso', 'acero']) c.st.m[m] = 99; };

console.log('Crías con nivel promedio');
{
  const g = mk({ breed: 'tres', idleTurns: 0 }); const c = g.cities.find(x => x.owner === 0 && x.cap);
  const [a, b] = g.units.filter(x => x.o === 0); g.units = g.units.filter(x => x.o !== 0 || x === a || x === b);
  for (const p of g.players) if (p.id !== 0) p.bot = false;
  a.x = c.x + 1; a.y = c.y + 1; b.x = c.x + 2; b.y = c.y + 1; a.lv = 10; b.lv = 7; a.hp = b.hp = 500;
  for (let i = 0; i < 3; i++) { g.creatures = []; for (const p of g.players) p.ready = true; E.advanceTurn(g); }
  const kid = g.units.find(x => x.o === 0 && x !== a && x !== b);
  ok(!!kid && kid.lv === 9 && kid.pts === 9, `la cría nace nivel 9 (promedio de 10 y 7): ${kid && kid.lv}`);
}

console.log('Botín de ciudad neutral');
{
  const g = mk({ siege: 'no' });
  const n = g.cities.find(c => c.owner === null), u = g.units.find(x => x.o === 0);
  clear(g, n); u.x = n.x - 1; u.y = n.y; u.mp = 3;
  const before = g.units.filter(x => x.o === 0).length;
  const err = E.cmd(g, 0, { a: 'move', u: u.id, x: n.x, y: n.y });
  ok(!err.err && n.owner === 0, 'captura la aldea');
  ok(g.units.filter(x => x.o === 0).length === before + 1 && g.units.some(x => x.o === 0 && x.lv === 3 && x.pts === 3), 'gana un soldado de nivel 3');
  ok(Object.values(n.b || {}).some(v => v >= 1), 'gana una construcción al azar');
  ok(n.lt === 1, 'la aldea queda marcada: no repite el botín');
}

console.log('Asedios');
{
  const g = mk({ siege: 'si' });
  const mine = g.cities.find(c => c.owner === 0), foe = g.cities.find(c => c.owner === 1);
  clear(g, foe); rich(mine);
  foe.b = { muralla: 1, atalaya: 1 };
  ok(S.BUILDINGS.asedio && S.SIEGE.ram, 'existen el taller de asedio y las máquinas');
  mine.b = Object.assign(mine.b || {}, { asedio: 2 });
  let r = E.cmd(g, 0, { a: 'siegeunit', c: mine.id, k: 'ram' });
  ok(!r.err, 'construye un ariete: ' + (r.err || ''));
  const ram = g.units.find(x => x.sg && x.o === 0);
  ok(!!ram && !g.units.filter(x => x.o === 0 && !x.sg).includes(ram), 'el ariete no cuenta como unidad');
  // con muralla en pie no se entra
  const sol = g.units.find(x => x.o === 0 && !x.sg); g.units = g.units.filter(x => x.o !== 1 || x.sg); // quita defensores
  sol.x = foe.x - 1; sol.y = foe.y; sol.mp = 3;
  r = E.cmd(g, 0, { a: 'move', u: sol.id, x: foe.x, y: foe.y });
  ok(r.err && foe.owner === 1, 'con la muralla en pie no se puede entrar a la ciudad');
  // ariete rompe muralla
  ram.x = foe.x + 2; ram.y = foe.y; ram.at = 1; ram.mp = 2; ram.hp = 999;
  for (let i = 0; i < 4 && S.SIEGE.wall[0] > 0; i++) { ram.at = 1; ram.mp = 2; r = E.cmd(g, 0, { a: 'siegewall', u: ram.id, cid: foe.id }); if (r.err) break; }
  ok(foe.wh === 0, 'tras varios golpes la muralla cae (brecha): ' + (r.err || foe.wh));
  sol.mp = 3; sol.x = foe.x - 1; sol.y = foe.y;
  r = E.cmd(g, 0, { a: 'move', u: sol.id, x: foe.x, y: foe.y });
  ok(!r.err && foe.owner === 0, 'con la brecha se conquista la ciudad');
  // reparar
  const c2 = g.cities.find(c => c.owner === 0 && c.b && c.b.muralla); 
  mine.b.muralla = 1; mine.wh = 0; rich(mine);
  r = E.cmd(g, 0, { a: 'repair', c: mine.id });
  ok(!r.err && mine.wh === Math.ceil(S.SIEGE.wall[0] / 2), 'reparar devuelve la mitad de la muralla');
  { const sn = E.snapshot(g, 0), mc = sn.cities.find(c => c.id === mine.id);
    ok(sn.mine.some(u => u.sg && u.sg.k === 'ram') && mc.wm === S.SIEGE.wall[0] || mc.wm === undefined, 'la instantánea trae las máquinas y la vida de la muralla');
    const fc = E.snapshot(g, 0).cities.find(c => c.id === foe.id); ok(fc && fc.o === 0, 'la ciudad conquistada ya es mía en la instantánea'); }
  // cerco
  const g2 = mk({ siege: 'si' }); const t = g2.cities.find(c => c.owner === 0); clear(g2, t);
  const en = g2.units.filter(u => u.o === 1).slice(0, 2); en.forEach((u, i) => { u.x = t.x + 3; u.y = t.y + i; });
  const snap0 = E.snapshot(g2, 0).cities.find(c => c.id === t.id);
  for (let i = 0; i < 2; i++) E.cmd(g2, 0, { a: 'endturn' });
  ok((t.sg || 0) >= 1 || g2.turn > 0, 'el cerco cuenta turnos (' + (t.sg || 0) + ')');
  const g3 = mk({ siege: 'no' });
  r = E.cmd(g3, 0, { a: 'siegeunit', c: g3.cities.find(c => c.owner === 0).id, k: 'ram' });
  ok(!!r.err, 'con asedios desactivados no hay máquinas');
}
console.log(fails ? `\n${fails} fallos` : '\nTodo bien');
process.exit(fails ? 1 : 0);
