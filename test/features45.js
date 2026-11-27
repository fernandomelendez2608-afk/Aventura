require('./seed.js');
// v1.77.0: oleadas con fuerza total suave + integridad de la plaza según la muralla
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const g = E.createGame('W77', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g); g.cw.next = 999999;
const thr = n => { const p = E.citPlan(g, n); let t = 0, c = 0; for (const ty of p.types) { const d = S.CREATURES[ty]; if (d.cit && d.xp >= 28) continue; const cs = E.cstats({ t: ty, lv: Math.min(p.lv, d.max) }); t += cs.mhp * cs.dmg * (1 + cs.def / 40); c++; } return p.cnt * t / Math.max(1, c); };
const tr = Array.from({ length: 20 }, (_, i) => thr(i + 1));
let worst = 0; for (let i = 1; i < 20; i++) worst = Math.max(worst, tr[i] / tr[i - 1]);
console.log('  razón máxima entre oleadas consecutivas: ' + worst.toFixed(2));
ok(worst < 3.2, 'sin picos enormes entre oleadas (antes 4×)');
ok(tr[19] > tr[9] && tr[9] > tr[4], 'la fuerza crece con las oleadas');
ok(Array.from({ length: 20 }, (_, i) => E.citPlan(g, i + 1).cnt).every(c => c >= 3 && c <= S.CIT.maxEnemies), 'cantidades dentro de los límites');
const city = g.cities[0]; const m0 = g.cit.max; city.b.muralla = 3; E.advanceTurn(g);
ok(g.cit.max === m0 + 3 * S.CIT.hpPerWall, 'la plaza sube ' + S.CIT.hpPerWall + ' de vida máxima por nivel de muralla (' + g.cit.max + ')');
ok(g.cit.hp >= m0 + 3 * S.CIT.hpPerWall - 1 || g.cit.hp > m0, 'la vida actual también sube');
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
