require('./seed.js');
// v1.75.0: farola + selección por arrastre
const E = require('../engine.js'), S = require('../shared.js'), fs = require('fs');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Farola');
const g = E.createGame('FAR1', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g); g.cw.next = 999999; g.creatures = [];
const city = g.cities[0]; city.st.m = { hierro: 500, cuero: 500, hueso: 500, acero: 50 };
const R = S.CIT.r, cx = S.CIT.plaza.x, cy = S.CIT.plaza.y;
const r1 = E.cmd(g, 0, { a: 'def', op: 'build', k: 'farola', x: cx + 3, y: cy + 3 });
ok(!r1.err, 'farola dentro de la muralla permitida' + (r1.err ? ' (' + r1.err + ')' : ''));
const r2 = E.cmd(g, 0, { a: 'def', op: 'build', k: 'farola', x: R.x0 - 1, y: R.y0 + 3 });
ok(!!r2.err, 'no sobre la muralla (' + (r2.err || '') + ')');
const r3 = E.cmd(g, 0, { a: 'def', op: 'build', k: 'torre', x: cx + 3, y: cy + 4 });
ok(!!r3.err, 'las torres siguen sin poder ir dentro');
let n = 1; for (let i = 0; i < 14; i++) { const r = E.cmd(g, 0, { a: 'def', op: 'build', k: 'farola', x: cx - 8 + i, y: cy + 5 }); if (!r.err) n++; }
ok(n === 12, 'tope de 12 farolas (' + n + ')');
const t1 = E.cmd(g, 0, { a: 'def', op: 'build', k: 'torre', x: R.x1 + 3, y: R.y0 }); ok(!t1.err, 'las farolas no gastan el cupo de defensas' + (t1.err ? ' (' + t1.err + ')' : ''));
const lamp = g.defs.find(d => d.k === 'farola');
ok(E.snapshot(g, 0).ct.df.some(d => d.k === 'farola'), 'las farolas aparecen en el snapshot');
const lv1 = lamp.lv; E.cmd(g, 0, { a: 'def', op: 'up', id: lamp.id }); ok(lamp.lv === lv1 + 1, 'se mejoran de nivel');
const src = fs.readFileSync(__dirname + '/../engine.js', 'utf8');
ok(/torchCover[\s\S]{0,200}farola/.test(src), 'la farola anula el bono nocturno (torchCover)');
console.log('Cliente (selección por arrastre y farola)');
const h = fs.readFileSync(__dirname + '/../public/index.html', 'utf8');
for (const f of ['mselBoxApply', 'groupTap', 'drawSelFx', 'drawLamps', 'reachFor', "d.k === 'farola'"]) ok(h.includes(f), 'cliente: ' + f);
ok(h.includes('id="nSel"') && h.includes('id="msel"'), 'botón y banner de selección');
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
