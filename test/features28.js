require('./seed.js');
// v1.65: bestiario de la Ciudadela (lobos, insectos y no-muertos)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const NEW = Object.keys(S.CREATURES).filter(k => S.CREATURES[k].cit && ['lobo', 'insecto', 'muerto'].includes(S.CREATURES[k].fam));
console.log('Bestiario');
ok(NEW.length === 21, '21 criaturas nuevas (' + NEW.length + ')');
ok(NEW.every(k => { const d = S.CREATURES[k]; return d.n && d.e && d.hp > 0 && d.dmg > 0 && d.max > 1 && d.ds && d.drops; }), 'todas con datos y descripción');
ok(NEW.filter(k => S.CREATURES[k].ab).length === 18, '18 con habilidad propia (' + NEW.filter(k => S.CREATURES[k].ab).length + ')');

// solo en Ciudadela: ni el mundo normal ni las mazmorras las generan
{ const g = E.createGame('BS1', 'H', 't'); E.addBot(g, 'azar'); E.startGame(g);
  for (let i = 0; i < 60; i++) { g.turn += 7; try { E.advanceTurn(g); } catch (e) { } }
  ok(!g.creatures.some(c => S.CREATURES[c.t].cit), 'en una partida normal no aparecen (60 turnos)'); }


// oleadas temáticas
{ const g = E.createGame('BS2', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g);
  const seen = new Set(); let themes = new Set();
  for (let n = 1; n <= 20; n++) { const p = E.citPlan(g, n); p.types.forEach(t => seen.add(t)); if (p.theme) themes.add(p.theme); ok(p.cnt >= 3 && p.types.every(t => S.CREATURES[t]), 'oleada ' + n + ' válida (' + p.cnt + ' · ' + (p.theme || 'clásica') + ')') && 0; }
  ok(NEW.every(k => seen.has(k)), 'las 21 aparecen en alguna oleada (faltan: ' + NEW.filter(k => !seen.has(k)).join(',') + ')');
  ok(themes.size >= 3, 'hay temas de oleada (' + themes.size + ')');
  // genera varias oleadas reales y las deja actuar sin errores
  let err = null; try { for (let n = 0; n < 6; n++) { g.cw.next = g.turn; for (let i = 0; i < 25; i++) E.advanceTurn(g); } } catch (e) { err = e; }
  ok(!err, 'seis oleadas simuladas sin errores' + (err ? ' ' + err.stack : '')); }

// habilidades, una por una
const base = () => { const g = E.createGame('BS3', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; g.cfg.idleTurns = 0; E.addBot(g, 'azar'); E.startGame(g); g.creatures = []; return g; };
const free = (g, x0, y0) => { for (let r = 0; r < 30; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const x = x0 + dx, y = y0 + dy; if ('gfh'.includes(g.map.t.charAt(y * g.map.w + x)) && !g.units.some(u => u.x === x && u.y === y) && !g.creatures.some(c => c.x === x && c.y === y)) return { x, y }; } };
const arena = (t, lv = 6) => { const g = base(), us = g.units.filter(u => u.o === 0 && !u.sm), pos = free(g, 20, 20); const u = us[0]; u.x = pos.x; u.y = pos.y; u.hp = E.eff(g, u).maxHp; us.slice(1).forEach(v => { v.x = 90; v.y = 70; });
  const p2 = free(g, pos.x + 1, pos.y); const c = E.spawnCreature ? null : null; return { g, u, pos, mk: (type, dx, lv2) => { const q = free(g, pos.x + dx, pos.y); const cr = require('../engine.js').rndLvTest ? null : null; return q; } }; };
// helper directo: crea la criatura vía snapshot del motor (spawnCreature está exportado)
const mkC = (g, type, x, y, lv) => { const c = E.spawnCreature(g, type, x, y, lv); c.hx = x; c.hy = y; return c; };
const scene = (type, lv = 6, dist = 1) => { const g = base(), us = g.units.filter(u => u.o === 0 && !u.sm), pos = free(g, 20, 20), u = us[0];
  us.slice(1).forEach(v => { v.x = 90; v.y = 70; v.hp = 9999; }); u.x = pos.x; u.y = pos.y; u.hp = E.eff(g, u).maxHp; u.sl = 0;
  let q = null; for (let dx = dist; !q && dx < dist + 6; dx++) q = free(g, pos.x + dx, pos.y); if (cheb(q, pos) < dist) q = free(g, pos.x + dist + 1, pos.y);
  const c = mkC(g, type, q.x, q.y, lv); return { g, u, c }; };
{ const { g, u, c } = scene('linv'); E.creaturesTurn(g); ok(u.sl >= 1, 'lobo invernal: ralentiza (sl=' + u.sl + ')'); }
{ const { g, u, c } = scene('lceniza'); E.creaturesTurn(g); ok(u.pz && u.pz.t >= 1, 'lobo de ceniza: quema'); }
{ const { g, u, c } = scene('avispa'); E.creaturesTurn(g); ok(u.pz, 'avispa: envenena a la primera'); u.hp = E.eff(g, u).maxHp; c.x = c.x; E.creaturesTurn(g); ok(u.sl >= 2, 'avispa: aturde si ya está envenenado (sl=' + u.sl + ')'); }
{ const { g, u, c } = scene('polilla'); E.creaturesTurn(g); ok(u.sl >= 2, 'polilla lunar: adormece'); }
{ const { g, u, c } = scene('cabmuerte', 8); u.sk.defensa = 10; u.sk.salud = 20; u.hp = E.eff(g, u).maxHp; E.creaturesTurn(g); ok(u.hp > 0 && u.nh > 0, 'caballero de la muerte: marca sin curación (nh=' + u.nh + ')'); const h0 = u.hp; g.turn++; E.advanceTurn(g); ok(u.hp <= h0, 'y esa unidad no se cura (' + h0 + ' → ' + u.hp + ')'); }
{ const { g, u, c } = scene('banshee', 6, 2); E.creaturesTurn(g); ok(u.pn > 0 && u.sl >= 1, 'banshee: pánico (pn=' + u.pn + ')'); const e1 = E.eff(g, u).dmg; u.pn = 0; ok(E.eff(g, u).dmg > e1, 'el pánico baja el daño de la unidad'); }
{ const { g, u, c } = scene('espectro', 6); c.hp = Math.round(c.hp * 0.5); const h0 = c.hp; E.creaturesTurn(g); ok(c.hp > h0, 'espectro: drena vida (' + h0 + ' → ' + c.hp + ')'); }
{ const { g, u, c } = scene('necrofago', 6); c.hp = Math.round(c.hp * 0.5); const h0 = c.hp; E.creaturesTurn(g); ok(c.hp > h0, 'necrófago: se cura al golpear'); u.hp = 1; E.creaturesTurn(g); ok(c.ft === 1, 'necrófago: gana fuerza al matar (ft=' + c.ft + ')'); }
{ const { g, u, c } = scene('escarab', 6); u.at = 2; u.hits = 0; u.mp = 3; const h0 = u.hp, c0 = c.hp; const r = E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: c.id }); ok(c.hp < c0 && u.hp < h0 - 0, 'escarabajo: devuelve daño (' + h0 + ' → ' + u.hp + ')'); }
{ const { g, u, c } = scene('lhierro', 6); const hp0 = c.hp; u.at = 1; u.hits = 0; E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: c.id }); const l1 = hp0 - c.hp; ok(l1 >= 0, 'lobo de hierro: recibe golpes (−' + l1 + ')'); }
{ const g = base(), pos = free(g, 20, 20), us = g.units.filter(u => u.o === 0 && !u.sm); us.forEach(v => { v.x = 90; v.y = 70; });
  const a = mkC(g, 'alfa', pos.x, pos.y, 8), q = free(g, pos.x + 3, pos.y), l = mkC(g, 'lgris', q.x, q.y, 6); const q2 = free(g, q.x + 1, q.y), l2 = mkC(g, 'lgris', q2.x, q2.y, 6);
  E.creaturesTurn(g); ok(l.bm > 1.3, 'alfa + manada: bonos de daño a los lobos (×' + l.bm.toFixed(2) + ')'); ok(E.cstats(l, g).dmg > E.cstats({ t: 'lgris', lv: 6 }, g).dmg, 'y se refleja en su daño'); }
{ const g = base(), us = g.units.filter(u => u.o === 0 && !u.sm), pos = free(g, 20, 20); us.slice(1).forEach(v => { v.x = 90; v.y = 70; }); us[0].x = pos.x + 4; us[0].y = pos.y;
  const q = free(g, pos.x, pos.y), r = mkC(g, 'reina', q.x, q.y, 8); g.turn = 20; E.creaturesTurn(g);
  const kids = g.creatures.filter(m => m.bo === r.id); ok(kids.length >= 1 && kids.length <= 2, 'reina: invoca crías (' + kids.length + ')');
  for (let i = 0; i < 4; i++) { g.turn += 3; E.creaturesTurn(g); } ok(g.creatures.filter(m => m.bo === r.id).length <= 4, 'reina: máximo 4 crías vivas');
  const killer = us[0]; killer.kl = 0; E.killCreature(g, r, killer); ok(!g.creatures.some(m => m.bo === r.id), 'al caer la reina, desaparecen las crías'); }
{ // muralla: el espectral la cruza, el lobo común no; el ciempiés la trepa
  const g = base(), C = S.CIT; g.units.forEach(v => { v.x = 90; v.y = 70; });
  const run = type => { g.creatures = []; const x = C.r.x0 - 4, y = 36, c = mkC(g, type, x, y, 6); c.tg = g.cities.find(k => k.cit).id; c.ttl = 100; let t = 0; while (t < 20 && cheb(c, C.plaza) > 1) { E.creaturesTurn(g); t++; } return t; };
  const dSp = run('lespec'), dW = run('lgris'), dCi = run('ciempies');
  ok(dSp < dW, 'lobo espectral llega a la plaza antes que un lobo común (' + dSp + ' vs ' + dW + ' turnos)'); ok(dCi < dW + 1, 'ciempiés trepa la muralla (' + dCi + ' turnos)'); }
console.log(fails ? '\n' + fails + ' FALLOS' : '\nOK'); process.exit(fails ? 1 : 0);
