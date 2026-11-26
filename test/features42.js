require('./seed.js');
// v1.74.0: cuatro tipos de guarnición
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Tipos de guarnición');
const mk = seed => { const g = E.createGame(seed, 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g); g.cw.next = 999999; g.creatures = []; return g; };
const g = mk('GT1'); const city = g.cities[0]; city.st.m = { hierro: 300, cuero: 300, hueso: 300, alma: 50 };
ok(Object.keys(S.GAR.types).join() === 'esp,lan,arq,mag', 'hay 4 tipos: espadachines, lanceros, arqueros y magos');
const made = {}; for (const t of ['lan', 'arq', 'mag']) { const r = E.cmd(g, 0, { a: 'garrison', c: city.id, k: t }); ok(!r.err, 'reclutar ' + t + (r.err ? ' (' + r.err + ')' : '')); made[t] = g.units.filter(u => u.gr && u.gt === t).pop(); }
for (const t of ['lan', 'arq', 'mag']) { const u = made[t], T = S.GAR.types[t]; ok(u && u.hp === T.hp * 4, t + ' tiene ' + T.hp * 4 + ' de vida'); }
const snap = E.snapshot(g, 0).mine, ef = id => snap.find(x => x.id === id).e;
ok(ef(made.lan.id).range === 2 && ef(made.arq.id).range === 3 && ef(made.mag.id).range === 3, 'alcances: lanza 2, arco 3, magia 3');
ok(S.GAR.types.mag.cost.alma === 1 && !S.GAR.types.arq.cost.hierro, 'cada tipo cuesta materiales distintos');
// ataque a distancia contra una criatura
const C = S.CIT; const arq = made.arq; arq.x = C.plaza.x; arq.y = C.plaza.y + 6; arq.hp = arq.hp; arq.at = 1; arq.acted = false; arq.mp = 3;
const wolf = E.spawnCreature(g, 'lobo', arq.x, arq.y - 3, 3); wolf.hp = 200;
const r = E.cmd(g, 0, { a: 'attack', u: arq.id, t: 'c', id: wolf.id }); ok(!r.err && wolf.hp < 200, 'los arqueros disparan a 3 casillas (' + (r.err || 'daño ' + (200 - wolf.hp)) + ')');
// ejército combinado: tipos distintos suman más que el mismo tipo
const esp = g.units.find(u => u.gr && u.gt === 'esp'); const lan = made.lan, arq2 = made.arq, mag = made.mag;
for (const u of g.units.filter(x => x.gr)) { u.x = C.plaza.x - 14 + (u.id % 5) * 6; u.y = C.plaza.y + 12; }
const dmgOf = u => E.snapshot(g, 0).mine.find(x => x.id === u.id).e.dmg;
esp.x = C.plaza.x + 20; esp.y = C.plaza.y + 8; lan.x = esp.x + 1; lan.y = esp.y; const d1 = dmgOf(esp);
arq2.x = esp.x + 1; arq2.y = esp.y + 1; const d2 = dmgOf(esp); mag.x = esp.x; mag.y = esp.y + 1; const d3 = dmgOf(esp);
ok(d2 > d1 && d3 > d2, `cada guarnición y cada tipo nuevo cerca mejora el daño (${d1} → ${d2} → ${d3})`);
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
