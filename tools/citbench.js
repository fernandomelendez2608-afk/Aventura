// Banco de equilibrio de la Ciudadela: partidas solo de bots; muestra en qué oleada cae la ciudad. Uso: node tools/citbench.js [bots=3] [gap=25] [semillas=3] [turnos=700]
require('../test/seed.js');
const E = require('../engine.js'), S = require('../shared.js');
const nb = +process.argv[2] || 3, gap = +process.argv[3] || 25, ns = +process.argv[4] || 3, maxT = +process.argv[5] || 700;
for (let i = 0; i < ns; i++) {
  const g = E.createGame('CB' + i, 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; g.cfg.waveGap = gap; for (let k = 0; k < nb; k++) E.addBot(g, 'azar'); E.startGame(g);
  const t0 = Date.now(); let last = -1, lost = false;
  for (let t = 0; t < maxT; t++) { E.advanceTurn(g); const w = g.cw; if (w.fin || w.lost || g.status === 'over') { lost = !!w.lost; break; } }
  const w = g.cw, us = g.units.filter(u => !u.gr && !u.sm && !u.cart), gs = g.units.filter(u => u.gr), ds = (g.defs || []);
  console.log(`semilla ${i}: turno ${g.turn} · oleada ${w.n}/${w.total} (superadas ${w.cleared}) · ${w.fin ? 'VICTORIA' : w.lost ? 'CAÍDA' : 'en curso'} · plaza ${g.cit.hp}/${g.cit.max} · unidades ${us.length} (nivel máx ${Math.max(0, ...us.map(u => u.lv))}) · guarniciones ${gs.length} · defensas ${ds.length} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
