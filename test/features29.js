require('./seed.js');
// v1.65.1: bestiario de la Ciudadela, tanda 2 (bestias grandes, dracónidos, constructos y elementales)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const FAMS = ['bestia', 'draco', 'constructo', 'elemental'];
const NEW = Object.keys(S.CREATURES).filter(k => FAMS.includes(S.CREATURES[k].fam));
console.log('Bestiario, tanda 2');
ok(NEW.length === 26, '26 criaturas nuevas (' + NEW.length + ')');
ok(NEW.every(k => { const d = S.CREATURES[k]; return d.cit && d.n && d.e && d.hp > 0 && d.dmg > 0 && d.max > 1 && d.ds && d.drops; }), 'todas con datos, descripción y solo para la Ciudadela');
{ const g = E.createGame('B21', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g);
  const seen = new Set(), themes = new Set();
  for (let n = 1; n <= 20; n++) { const p = E.citPlan(g, n); p.types.forEach(t => seen.add(t)); if (p.theme) themes.add(p.theme); }
  ok(NEW.every(k => seen.has(k)), 'las 26 aparecen en alguna oleada (faltan: ' + NEW.filter(k => !seen.has(k)).join(',') + ')');
  ok(themes.size >= 7, 'hay temas de oleada variados en 20 oleadas (' + themes.size + ')');
  let err = null; try { for (let n = 0; n < 8; n++) { g.cw.next = g.turn; for (let i = 0; i < 25; i++) E.advanceTurn(g); } } catch (e) { err = e; }
  ok(!err, 'ocho oleadas simuladas sin errores' + (err ? ' ' + err.stack : '')); }
const base = () => { const g = E.createGame('B22', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; g.cfg.idleTurns = 0; E.addBot(g, 'azar'); E.startGame(g); g.creatures = []; return g; };
const free = (g, x0, y0) => { for (let r = 0; r < 30; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const x = x0 + dx, y = y0 + dy; if ('gfh'.includes(g.map.t.charAt(y * g.map.w + x)) && !g.units.some(u => u.x === x && u.y === y) && !g.creatures.some(c => c.x === x && c.y === y)) return { x, y }; } };
const mkC = (g, type, x, y, lv) => { const c = E.spawnCreature(g, type, x, y, lv); c.hx = x; c.hy = y; return c; };
const scene = (type, lv = 6, dist = 1, extra = 0) => { const g = base(), us = g.units.filter(u => u.o === 0 && !u.sm), pos = free(g, 20, 20), u = us[0];
  g.units.forEach(v => { if (v !== u) { v.x = 90; v.y = 70; v.hp = 9999; } }); u.x = pos.x; u.y = pos.y; u.hp = E.eff(g, u).maxHp; u.sl = 0; u.sk.salud = 10; u.hp = E.eff(g, u).maxHp;
  let q = free(g, pos.x + dist, pos.y); if (cheb(q, pos) < dist) q = free(g, pos.x + dist + 1, pos.y);
  const c = mkC(g, type, q.x, q.y, lv); return { g, u, c, us }; };
{ const { g, u, c } = scene('jabpiedra'); E.creaturesTurn(g); ok(u.sl >= 2, 'jabalí colmillo de piedra: derriba (sl=' + u.sl + ')'); }
{ const { g, u, c, us } = scene('mamut'); const v = us[1]; v.x = u.x; v.y = u.y + 2; E.creaturesTurn(g); ok(u.sl >= 2 && v.sl >= 2, 'mamut: pisotón ralentiza a los cercanos'); }
{ const { g, u, c } = scene('uro'); const ds = []; for (let i = 0; i < 25; i++) { u.hp = E.eff(g, u).maxHp; const h0 = u.hp; E.creaturesTurn(g); ds.push(h0 - u.hp); } ok(Math.max(...ds) > Math.min(...ds) + 3, 'uro: daño variable (' + Math.min(...ds) + '–' + Math.max(...ds) + ')'); }
{ const { g, u, c, us } = scene('bufalo'); const v = us[1]; v.x = u.x; v.y = u.y + 2; v.hp = E.eff(g, v).maxHp; const h0 = v.hp; E.creaturesTurn(g); ok(v.hp < h0, 'búfalo de tormenta: el rayo salta a otro enemigo (' + h0 + ' → ' + v.hp + ')'); }
{ const { g, u, c, us } = scene('elrayo', 6, 2); us.slice(1, 3).forEach((v, i) => { v.x = u.x; v.y = u.y + 1 + i; v.hp = E.eff(g, v).maxHp; }); const h = us.slice(1, 3).map(v => v.hp); E.creaturesTurn(g); ok(us.slice(1, 3).some((v, i) => v.hp < h[i]), 'elemental de rayo: arco voltaico'); }
{ const { g, u, c } = scene('wyvern'); E.creaturesTurn(g); ok(u.pz, 'wyvern: inyecta toxina'); }
{ const { g, u, c } = scene('salamandra', 6, 2); E.creaturesTurn(g); ok(u.pz, 'salamandra: quema con su aliento'); u.pz = null; u.at = 2; u.hits = 0; u.mp = 3; c.x = u.x + 1; c.y = u.y; E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: c.id }); ok(u.pz, 'salamandra: manto ígneo quema al atacante'); }
{ const { g, u, c } = scene('criaesm', 6, 2); E.creaturesTurn(g); ok(u.pz, 'cría esmeralda: gas ácido envenena'); }
{ const { g, u, c } = scene('drake'); const h0 = u.hp; E.creaturesTurn(g); const d1 = h0 - u.hp; u.hp = h0; E.creaturesTurn(g); const d2 = h0 - u.hp; ok(d1 > d2 * 1.3, 'drake de pantano: primer golpe más fuerte (' + d1 + ' vs ' + d2 + ')'); }
{ const { g, u, c, us } = scene('dracescarcha', 8, 3); const v = us[1]; v.x = u.x; v.y = u.y + 1; v.sl = 0; E.creaturesTurn(g); ok(u.sl >= 2 && v.sl >= 2, 'dragón de escarcha: congela alrededor del objetivo'); }
{ const { g, u, c } = scene('serpdraco'); E.creaturesTurn(g); ok(u.pz && u.pz.t === 3, 'serpiente dracónica: mordida abrasadora'); }
{ const g = base(), pos = free(g, 20, 20), u = g.units.find(x => x.o === 0 && !x.sm); g.units.forEach(v => { if (v !== u) { v.x = 90; v.y = 70; } }); u.x = pos.x; u.y = pos.y; u.at = 1; u.hits = 0; u.mp = 3; u.sk.dano = 25;
  const a = free(g, pos.x + 1, pos.y), c1 = mkC(g, 'golvolc', a.x, a.y, 6), c2 = mkC(g, 'golhierro', a.x, a.y + 1, 6); const ref = mkC(g, 'ospardo', a.x + 1, a.y, 6);
  const dmgTo = c => { const h0 = c.hp; u.at = 1; u.hits = 0; u.mp = 3; E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: c.id }); return h0 - c.hp; };
  const d1 = dmgTo(c1), d0 = dmgTo(ref); ok(d1 < d0 * 0.8, 'gólem volcánico: piel de roca reduce el daño (' + d1 + ' vs ' + d0 + ' sin ella)'); }
{ const { g, u, c } = scene('gargola'); const h0 = u.hp; E.creaturesTurn(g); ok(u.sl >= 1 && u.hp < h0, 'gárgola: caída pétrea aturde'); }
{ const { g, u, c } = scene('elfuego'); E.creaturesTurn(g); ok(u.pz, 'elemental de fuego: quema'); }
{ const { g, u, c } = scene('elagua'); c.hp = Math.round(c.hp * 0.5); const h0 = c.hp; u.x = 90; u.y = 60; E.creaturesTurn(g); ok(c.hp > h0, 'elemental de agua: se regenera'); }
{ const { g, u, c } = scene('eltierra'); E.creaturesTurn(g); ok(u.sl >= 1, 'elemental de tierra: aturde'); }
{ const { g, u, c } = scene('elhielo', 6, 2); E.creaturesTurn(g); ok(u.sl >= 1, 'elemental de hielo: enfría a su alrededor'); }
{ const { g, u, c } = scene('elaire'); const x0 = u.x, y0 = u.y; E.creaturesTurn(g); ok(cheb(u, { x: x0, y: y0 }) >= 1 || u.sl >= 1, 'elemental de aire: empuja (' + x0 + ',' + y0 + ' → ' + u.x + ',' + u.y + ')'); }
{ const g = base(), pos = free(g, 20, 20), u = g.units.find(x => x.o === 0 && !x.sm); g.units.forEach(v => { if (v !== u) { v.x = 90; v.y = 70; } }); u.x = pos.x; u.y = pos.y; u.at = 1; u.hits = 0; u.mp = 3;
  const a = free(g, pos.x + 2, pos.y), cr = mkC(g, 'colosocr', a.x, a.y, 6), r2 = mkC(g, 'golhierro', a.x, a.y + 1, 6); ok(S.CREATURES.colosocr.rr === 0.5, 'coloso de cristal: desvía proyectiles (rr 0.5)'); }
{ // voladores: cruzan la muralla
  const g = base(), C = S.CIT; g.units.forEach(v => { v.x = 90; v.y = 70; });
  const run = type => { g.creatures = []; const c = mkC(g, type, C.r.x0 - 4, 36, 6); c.tg = g.cities.find(k => k.cit).id; c.ttl = 100; let t = 0; while (t < 20 && cheb(c, C.plaza) > 1) { E.creaturesTurn(g); t++; } return t; };
  const w = run('wyvern'), o = run('ospardo'); ok(w < o, 'wyvern (vuela) llega antes que el oso por las puertas (' + w + ' vs ' + o + ' turnos)'); }
console.log(fails ? '\n' + fails + ' FALLOS' : '\nOK'); process.exit(fails ? 1 : 0);
