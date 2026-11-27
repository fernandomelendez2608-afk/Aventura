require('./seed.js');
// v1.80.0: bono antiaéreo de arqueros/magos, criaturas errantes, sprites rehechos
const E = require('../engine.js'), S = require('../shared.js'), fs = require('fs');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const mk = (seed, cfg) => { const g = E.createGame(seed, 'H', 't'); Object.assign(g.cfg, { mode: 'ciudadela', sim: true }, cfg || {}); E.addBot(g, 'azar'); E.startGame(g); g.cw.next = 999999; g.creatures = []; return g; };
console.log('Antiaéreo');
const hit = (gt, fly) => { const g = mk('AIR' + gt + fly), P = S.CIT.plaza; const u = g.units.find(x => x.gr && x.gt === gt) || E.garSpawn(g, 0, gt);
  const t = 'halcon', old = S.CREATURES[t].cross; if (!fly) delete S.CREATURES[t].cross;
  u.x = P.x; u.y = P.y + 3; u.at = 1; u.acted = false; u.hp = u.hp || 100; const c = E.spawnCreature(g, t, P.x, P.y + 1, 5); c.hp = 5000; const h0 = c.hp;
  try { E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: c.id }); } catch (e) {}
  S.CREATURES[t].cross = old; return h0 - c.hp; };
for (const gt of ['arq', 'mag']) { const a = hit(gt, true), b = hit(gt, false); ok(a > 0 && b > 0 && a / b > 1.5, `${gt}: daño a voladora ${a} vs terrestre ${b}`); }
const e1 = hit('esp', true), e2 = hit('esp', false); ok(e1 === 0 || e1 / Math.max(1, e2) < 1.3, 'espadachines sin bono antiaéreo (' + e1 + ' / ' + e2 + ')');
console.log('Errantes');
const g = mk('ROAM1'); for (let i = 0; i < 80; i++) E.advanceTurn(g);
const r = g.creatures.filter(c => c.rm);
ok(r.length >= 1, 'aparecen criaturas errantes (' + r.length + ')');
ok(r.every(c => !(c.x >= S.CIT.r.x0 && c.x <= S.CIT.r.x1 && c.y >= S.CIT.r.y0 && c.y <= S.CIT.r.y1)), 'fuera de la muralla');
ok(r.every(c => !g.cw.ids.includes(c.id) && !c.tg), 'no cuentan como oleada ni van a por la ciudad');
const g2 = mk('ROAM2', { citRoam: 'no' }); for (let i = 0; i < 80; i++) E.advanceTurn(g2);
ok(g2.creatures.filter(c => c.rm).length === 0, 'el ajuste «no» las desactiva');
const g3 = mk('ROAM3'); for (let i = 0; i < 400; i++) E.advanceTurn(g3); ok(g3.creatures.filter(c => c.rm).length <= S.CIT.roam.max + 3, 'respetan el tope');
ok(S.WORLD_OPTS.citRoam && S.WORLD_OPTS.citRoam.o.no, 'ajuste en el lobby');
console.log('Sprites');
const h = fs.readFileSync(__dirname + '/../public/index.html', 'utf8');
for (const n of ['ciempies', 'tentabis', 'devsom']) { const m = h.match(new RegExp('SPR\\.c_' + n + ' = (\\[.*?\\]);')); ok(m && JSON.parse(m[1]).length === 16 && JSON.parse(m[1]).every(x => x.length === 16), 'sprite ' + n + ' 16×16'); }
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
