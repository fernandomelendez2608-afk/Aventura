require('./seed.js');
// v1.69: bots más listos (huir de lo que no pueden vencer, cazar y construir defensas en la Ciudadela, focus fire)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
console.log('Bots más inteligentes');
const flat = (g, x0, y0, x1, y1) => { const t = g.map.t.split(''), w = g.map.w; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t[y * w + x] = 'g'; g.map.t = t.join(''); };
{ // huida: una unidad sola de nivel 1 ante un troll fuerte se aleja
  const g = E.createGame('F1', 'H', 't'); g.cfg.mode = 'normal'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g);
  const p = g.players.find(q => q.bot), u = g.units.find(x => x.o === p.id && !x.sm && !x.cart);
  flat(g, 4, 30, 22, 50); g.units.forEach(v => { if (v !== u) { v.x = 3; v.y = 3; } }); g.creatures = []; u.x = 16; u.y = 40; u.mp = 4; u.hp = 40;
  const c = E.spawnCreature(g, 'troll', 13, 40, 12); c.hx = c.x; c.hy = c.y; p._ok = new Set();
  const d0 = cheb(u, c); const fled = E.botFlee(g, p, u, E.eff(g, u));
  ok(fled && cheb(u, c) > d0, 'huye de un troll nivel 12 (distancia ' + d0 + ' → ' + cheb(u, c) + ')');
  p._ok = new Set([c.id]); u.x = 16; u.y = 40; u.mp = 4; ok(!E.botFlee(g, p, u, E.eff(g, u)), 'pero no huye de lo que su grupo puede vencer'); }
{ // Ciudadela: construye defensas con excedentes
  const g = E.createGame('F2', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g); g.creatures = [];
  const p = g.players.find(q => q.bot), city = E.citCity(g); city.st.m = { cuero: 999, hueso: 999, hierro: 999, acero: 999, alma: 99 };
  for (let i = 0; i < 40; i++) { g.turn = 2 + i * 2; E.citBotDefs(g, p); }
  const ks = {}; (g.defs || []).forEach(d => { ks[d.k] = (ks[d.k] || 0) + 1; });
  ok((g.defs || []).length >= 8 && ks.torre >= 2 && ks.trampa >= 1, 'el bot levanta torres y trampas junto a las puertas (' + JSON.stringify(ks) + ')');
  ok(g.defs.some(d => d.lv >= 2), 'y las mejora cuando le sobra material');
  city.st.m = { cuero: 5, hueso: 5, hierro: 5, acero: 0, alma: 0 }; const n = g.defs.length; g.turn += 2; E.citBotDefs(g, p); ok(g.defs.length === n, 'sin excedente no gasta el almacén'); }
{ // Ciudadela: entre oleadas caza lo que puede vencer
  const g = E.createGame('F3', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g); g.creatures = [];
  const p = g.players.find(q => q.bot), mine = g.units.filter(x => x.o === p.id && !x.sm && !x.cart);
  const pl = S.CIT.plaza; flat(g, pl.x + 8, pl.y - 6, pl.x + 30, pl.y + 6); mine.forEach(u => { u.x = pl.x + 9; u.y = pl.y; u.hp = 9999; u.lv = 8; });
  const c = E.spawnCreature(g, 'ciervo', pl.x + 26, pl.y, 1); c.hx = c.x; c.hy = c.y; const d0 = cheb(mine[0], c); mine.forEach(u => { u.mp = 6; u.at = 1; });
  E.citBotHunt(g, p, mine); ok(mine.some(u => cheb(u, c) < d0), 'las unidades salen a cazar una criatura salvaje (' + d0 + ' → ' + Math.min(...mine.map(u => cheb(u, c))) + ')'); }
{ // 130 turnos de Ciudadela con 3 bots sin errores y con progreso
  const g = E.createGame('F4', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; for (let i = 0; i < 3; i++) E.addBot(g, 'azar'); E.startGame(g);
  let err = null; try { for (let t = 0; t < 130; t++) E.advanceTurn(g); } catch (e) { err = e; }
  const us = g.units.filter(u => !u.sm && !u.cart), avg = us.reduce((a, u) => a + u.lv, 0) / Math.max(1, us.length), kills = g.players.reduce((a, q) => a + q.stats.kills, 0);
  ok(!err, '130 turnos de Ciudadela con bots sin errores' + (err ? ' (' + err.message + ')' : '')); ok(kills >= 8 && avg > 1.2, 'los bots cazan y suben de nivel antes de la primera oleada (kills ' + kills + ', nivel medio ' + avg.toFixed(2) + ')'); }
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
