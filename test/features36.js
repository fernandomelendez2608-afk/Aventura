require('./seed.js');
// v1.69.1: los bots buscan pareja y crían
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Bots que crían');
const run = (breed, seed) => {
  const g = E.createGame(seed, 'H', 't'); g.cfg.mode = 'normal'; g.cfg.sim = true; g.cfg.breed = breed; g.cfg.events = 'calma'; E.addBot(g, 'azar'); E.startGame(g);
  const p = g.players.find(q => q.bot); const us = g.units.filter(u => u.o === p.id && !u.sm && !u.cart);
  us.forEach((u, i) => { u.sx = i % 2 ? 'f' : 'm'; });
  const c = g.cities.find(x => x.owner === p.id);
  const n0 = g.units.filter(u => u.o === p.id).length; let born = 0, turns = 0;
  for (let t = 0; t < 40; t++) { g.creatures = []; E.advanceTurn(g); turns++; born = g.units.filter(u => u.o === p.id && u.born).length; if (born) break; }
  return { g, p, born, turns, n0 };
};
const r = run('tres', 'K1'); ok(r.born >= 1, 'con crías activadas, el bot consigue una cría (turno ' + r.turns + ')');
const kid = r.g.units.find(u => u.o === r.p.id && u.born); ok(kid && kid.gen >= 1 && kid.bn && kid.bn.hp >= 10, 'la cría trae su bonus de nacimiento');
const r0 = run('apagado', 'K1'); ok(r0.born === 0, 'con las crías apagadas no cría');
let sum = 0, cnt = 0; for (const s of ['K2', 'K3', 'K4']) { const q = run('cinco', s); sum += q.born; cnt++; } ok(sum >= 2, 'con parejas de 5 turnos también cría (' + sum + ' crías en ' + cnt + ' partidas)');
{ const g = E.createGame('K5', 'H', 't'); g.cfg.mode = 'normal'; g.cfg.sim = true; g.cfg.breed = 'tres'; E.addBot(g, 'azar'); E.startGame(g);
  const p = g.players.find(q => q.bot); const us = g.units.filter(u => u.o === p.id && !u.sm && !u.cart); us.forEach((u, i) => { u.sx = i % 2 ? 'f' : 'm'; });
  const c = g.cities.find(x => x.owner === p.id); g.creatures = []; const t = E.spawnCreature(g, 'troll', c.x + 3, c.y, 8); t.hx = t.x; t.hy = t.y;
  const done = new Set(); E.botBreed(g, p, us, done); ok(!p.brd && !done.size, 'con una amenaza junto a la ciudad no se ponen a criar'); }
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
