require('./seed.js');
// v1.65.2: bestiario de la Ciudadela, tanda 3 (felinos, aves, reptiles y arácnidos)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const FAMS = ['felino', 'ave', 'reptil', 'aracnido'];
const NEW = Object.keys(S.CREATURES).filter(k => FAMS.includes(S.CREATURES[k].fam));
console.log('Bestiario, tanda 3');
ok(NEW.length === 24, '24 criaturas nuevas (' + NEW.length + ')');
ok(NEW.every(k => { const d = S.CREATURES[k]; return d.cit && d.n && d.e && d.hp > 0 && d.dmg > 0 && d.max > 1 && d.ds && d.drops; }), 'todas con datos, descripción y solo para la Ciudadela');
ok(Object.keys(S.CREATURES).filter(k => S.CREATURES[k].cit).length >= 71, 'al menos 71 en total');
{ const g = E.createGame('B31', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g);
  const seen = new Set(), themes = new Set();
  for (let n = 1; n <= 30; n++) { const p = E.citPlan(g, n); p.types.forEach(t => seen.add(t)); if (p.theme) themes.add(p.theme); }
  ok(NEW.every(k => seen.has(k)), 'las 24 aparecen en alguna oleada (faltan: ' + NEW.filter(k => !seen.has(k)).join(',') + ')');
  ok(themes.size >= 11, 'al menos 11 temas de oleada (' + themes.size + ')');
  let err = null; try { for (let n = 0; n < 12; n++) { g.cw.next = g.turn; for (let i = 0; i < 25; i++) E.advanceTurn(g); } } catch (e) { err = e; }
  ok(!err, 'doce oleadas simuladas sin errores' + (err ? ' ' + err.stack : '')); }
const base = () => { const g = E.createGame('B32', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; g.cfg.idleTurns = 0; E.addBot(g, 'azar'); E.startGame(g); g.creatures = []; return g; };
const free = (g, x0, y0) => { for (let r = 0; r < 30; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const x = x0 + dx, y = y0 + dy; if ('gfh'.includes(g.map.t.charAt(y * g.map.w + x)) && !g.units.some(u => u.x === x && u.y === y) && !g.creatures.some(c => c.x === x && c.y === y)) return { x, y }; } };
const mkC = (g, type, x, y, lv) => { const c = E.spawnCreature(g, type, x, y, lv); c.hx = x; c.hy = y; return c; };
const scene = (type, lv = 6, dist = 1) => { const g = base(), us = g.units.filter(u => u.o === 0 && !u.sm), pos = free(g, 20, 20), u = us[0];
  g.units.forEach(v => { if (v !== u) { v.x = 90; v.y = 70; v.hp = 9999; } }); u.x = pos.x; u.y = pos.y; u.sl = 0; u.sk.salud = 10; u.sk.dano = 25; u.hp = E.eff(g, u).maxHp;
  let q = free(g, pos.x + dist, pos.y); if (cheb(q, pos) < dist) q = free(g, pos.x + dist + 1, pos.y);
  const c = mkC(g, type, q.x, q.y, lv); return { g, u, c, us }; };
const hit = (g, u, c) => { u.hp = E.eff(g, u).maxHp; c.hp = 9999; const h0 = c.hp; u.acted = false; u.at = 2; u.hits = 0; u.mp = 3; E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: c.id }); return h0 - c.hp; };
{ const { g, u, c } = scene('pantera'); const h0 = u.hp; E.creaturesTurn(g); const d1 = h0 - u.hp; u.hp = h0; E.creaturesTurn(g); ok(d1 > (h0 - u.hp) * 1.4, 'pantera: el primer golpe pega mucho más (' + d1 + ' vs ' + (h0 - u.hp) + ')'); }
{ const { g, u, c } = scene('sable'); E.creaturesTurn(g); ok(u.pz && u.pz.t === 4, 'tigre dientes de sable: sangrado'); }
{ const { g, u, c, us } = scene('leon'); const c2 = mkC(g, 'leon', c.x, c.y + 1, 6); E.creaturesTurn(g); ok(u.pn > 0 && c.bm > 1, 'león: rugido intimida y los leones se potencian en grupo (×' + (c.bm || 1).toFixed(2) + ')'); }
{ const { g, u, c } = scene('astral', 6, 6); const d0 = cheb(u, c); E.creaturesTurn(g); ok(cheb(u, c) <= 1 && d0 > 2, 'gato astral: salto dimensional (' + d0 + ' → ' + cheb(u, c) + ' casillas)'); }
{ const { g, u, c } = scene('jaguar'); ok(S.CREATURES.jaguar.cross === 'Z' && S.CREATURES.jaguar.dd > 0, 'jaguar: trepa y esquiva'); }
{ const { g, u, c } = scene('halcon'); E.creaturesTurn(g); ok(u.pn >= 1, 'halcón: ciega (pn=' + u.pn + ')'); }
{ const { g, u, c } = scene('buho'); c.dg = null; let t = 0; const tf = (() => { for (let y = 5; y < 90; y++) for (let x = 5; x < 90; x++) if (g.map.t.charAt(y * g.map.w + x) === 'f' && !g.units.some(v => v.x === x && v.y === y) && !g.creatures.some(v => v.x === x && v.y === y)) return { x, y }; })();
  if (tf) { u.x = tf.x; u.y = tf.y; c.x = tf.x + 1; c.y = tf.y; const dm = []; for (let i = 0; i < 6; i++) { u.hp = E.eff(g, u).maxHp; const h0 = u.hp; E.creaturesTurn(g); dm.push(h0 - u.hp); } ok(Math.min(...dm) >= Math.max(...dm) * 0.9, 'búho: en el bosque siempre hace crítico (' + dm.join(',') + ')'); } else ok(true, 'búho: (sin bosque en el mapa de prueba)'); }
{ const { g, u, c, us } = scene('aguila'); const v = us[1]; v.x = u.x; v.y = u.y + 2; v.sl = 0; E.creaturesTurn(g); ok(u.sl >= 1 && v.sl >= 1, 'águila: el trueno ralentiza a los cercanos'); }
{ const { g, u, c } = scene('cuervo'); const c2 = mkC(g, 'cuervo', c.x, c.y + 1, 6), c3 = mkC(g, 'cuervo', c.x + 1, c.y + 1, 6); E.creaturesTurn(g); ok(c.bm > 1.15, 'cuervos: bandada (×' + (c.bm || 1).toFixed(2) + ')'); }
{ const { g, u, c } = scene('fenix'); const n0 = g.creatures.length; c.hp = 1; E.killCreature(g, c, u); ok(g.creatures.includes(c) && c.hp > 10, 'fénix: resurge una vez (' + c.hp + ' vida)'); E.killCreature(g, c, u); ok(!g.creatures.includes(c), 'fénix: la segunda vez cae de verdad'); }
{ const { g, u, c } = scene('roc'); const x0 = u.x, y0 = u.y, w = g.map.w; let t = g.map.t.split(''); for (let k = -4; k <= 1; k++) t[y0 * w + x0 + k] = 'g'; g.map.t = t.join(''); g.units.forEach(v => { if (v !== u && Math.abs(v.y - y0) < 2 && Math.abs(v.x - x0) < 6) v.x += 20; }); g.creatures.forEach(v => { if (v !== c && Math.abs(v.y - y0) < 2 && Math.abs(v.x - x0) < 6) v.x += 20; }); E.creaturesTurn(g); ok(x0 - u.x >= 2 && u.sl >= 1, 'roc: levanta y empuja a su presa (' + x0 + ' → ' + u.x + ') y la aturde'); }
{ const { g, u, c } = scene('basilisco', 6, 2); E.creaturesTurn(g); ok(u.sl >= 1, 'basilisco: la mirada ralentiza'); }
{ const { g, u, c } = scene('constrictora'); const ds = []; for (let i = 0; i < 4; i++) { u.hp = E.eff(g, u).maxHp; const h0 = u.hp; E.creaturesTurn(g); ds.push(h0 - u.hp); } ok(ds[3] > ds[0] * 1.4, 'constrictora: daño creciente (' + ds.join(' → ') + ')'); }
{ const { g, u, c } = scene('camaleon'); let ev = 0; for (let i = 0; i < 60; i++) { const h0 = c.hp; hit(g, u, c); if (c.hp === h0) ev++; c.hp = 9999; } ok(ev >= 8 && ev <= 30, 'camaleón: esquiva ~30% (' + ev + ' de 60)'); }
{ const { g, u, c } = scene('sapo'); E.creaturesTurn(g); ok(u.pz, 'sapo: la mordida envenena'); u.pz = null; hit(g, u, c); ok(u.pz, 'sapo: piel tóxica envenena a quien lo golpea'); }
{ const { g, u, c } = scene('cocodrilo'); const ds = []; for (let i = 0; i < 3; i++) { u.hp = E.eff(g, u).maxHp; const h0 = u.hp; E.creaturesTurn(g); ds.push(h0 - u.hp); } ok(ds[2] > ds[0] * 1.3, 'cocodrilo: giro mortal (' + ds.join(' → ') + ')'); }
{ const { g, u, c } = scene('triton'); let ev = 0; for (let i = 0; i < 60; i++) { const h0 = c.hp; hit(g, u, c); if (c.hp === h0) ev++; c.hp = 9999; } ok(ev >= 4 && ev <= 22, 'tritón: esquiva ~20% (' + ev + ' de 60)'); }
{ const { g, u, c, us } = scene('tejedora'); const v = us[1]; v.x = u.x; v.y = u.y + 1; v.sl = 0; E.creaturesTurn(g); ok(u.sl >= 2 && v.sl >= 1, 'araña tejedora: atrapa al objetivo y ralentiza a los cercanos'); }
{ const { g, u, c } = scene('viuda'); E.creaturesTurn(g); ok(u.pz && u.pz.t === 4, 'viuda de sombras: veneno fuerte'); }
{ const { g, u, c } = scene('tarantula'); const h0 = u.hp; E.creaturesTurn(g); const d1 = h0 - u.hp; u.hp = h0; E.creaturesTurn(g); ok(d1 > (h0 - u.hp) * 1.2, 'tarántula: embestida inicial'); }
{ const { g, u, c } = scene('arcristal'); E.creaturesTurn(g); ok(u.pz && S.CREATURES.arcristal.dd === 0.25, 'araña de cristal: veneno y esquiva'); }
{ const { g, u, c } = scene('escdunas'); E.creaturesTurn(g); ok(u.pz && u.sl >= 1, 'escorpión de dunas: sujeta y envenena'); }
{ const { g, u, c } = scene('nieblaar'); const h0 = u.hp; E.creaturesTurn(g); const d1 = h0 - u.hp; u.hp = h0; E.creaturesTurn(g); ok(u.sl >= 1 && d1 > (h0 - u.hp) * 1.25, 'tejedora de niebla: primer golpe +50% y atrapa'); }
{ const g = base(), C = S.CIT; g.units.forEach(v => { v.x = 90; v.y = 70; });
  const run = type => { g.creatures = []; const c = mkC(g, type, C.r.x0 - 4, 36, 6); c.tg = g.cities.find(k => k.cit).id; c.ttl = 100; let t = 0; while (t < 20 && cheb(c, C.plaza) > 1) { E.creaturesTurn(g); t++; } return t; };
  const a = run('halcon'), l = run('lince'), s = run('sable'); ok(a < s && l < s + 1, 'halcón (vuela) y lince (trepa) llegan antes que el tigre (' + a + ', ' + l + ' vs ' + s + ' turnos)'); }
console.log(fails ? '\n' + fails + ' FALLOS' : '\nOK'); process.exit(fails ? 1 : 0);
