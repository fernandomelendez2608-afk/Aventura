require('./seed.js');
// v1.65.3: bestiario de la Ciudadela, tanda 4 (plantas, demonios, sombras, aberraciones y slimes)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const FAMS = ['planta', 'demonio', 'sombra', 'aberracion', 'slime'];
const NEW = Object.keys(S.CREATURES).filter(k => FAMS.includes(S.CREATURES[k].fam));
console.log('Bestiario, tanda 4');
ok(NEW.length === 30, '30 criaturas nuevas (' + NEW.length + ')');
ok(NEW.every(k => { const d = S.CREATURES[k]; return d.cit && d.n && d.e && d.hp > 0 && d.dmg > 0 && d.max > 1 && d.ds && d.drops; }), 'todas con datos, descripción y solo para la Ciudadela');
const ALL = Object.keys(S.CREATURES).filter(k => S.CREATURES[k].cit);
ok(ALL.length === 101, 'el bestiario de la Ciudadela suma 101 criaturas (' + ALL.length + ')');
{ const g = E.createGame('B41', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g);
  const seen = new Set(), themes = new Set();
  for (let n = 1; n <= 20; n++) { const p = E.citPlan(g, n); p.types.forEach(t => seen.add(t)); if (p.theme) themes.add(p.theme); ok(p.cnt >= 3 && p.cnt <= S.CIT.maxEnemies, 'oleada ' + n + ' con tamaño válido (' + p.cnt + ')') || 0; }
  ok(ALL.every(k => seen.has(k)), 'las 101 aparecen en alguna de las 20 oleadas (faltan: ' + ALL.filter(k => !seen.has(k)).join(',') + ')');
  ok(themes.size >= 15, 'hay 15 o más temas distintos en 20 oleadas (' + themes.size + ')');
  let err = null; try { for (let n = 0; n < 14; n++) { g.cw.next = g.turn; for (let i = 0; i < 25; i++) E.advanceTurn(g); } } catch (e) { err = e; }
  ok(!err, 'catorce oleadas simuladas sin errores' + (err ? ' ' + err.stack : '')); }
const base = () => { const g = E.createGame('B42', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; g.cfg.idleTurns = 0; E.addBot(g, 'azar'); E.startGame(g); g.creatures = []; return g; };
const free = (g, x0, y0) => { for (let r = 0; r < 30; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const x = x0 + dx, y = y0 + dy; if ('gfh'.includes(g.map.t.charAt(y * g.map.w + x)) && !g.units.some(u => u.x === x && u.y === y) && !g.creatures.some(c => c.x === x && c.y === y)) return { x, y }; } };
const mkC = (g, type, x, y, lv) => { const c = E.spawnCreature(g, type, x, y, lv); c.hx = x; c.hy = y; return c; };
const flat = (g, x0, y0, n) => { const t = g.map.t.split(''), w = g.map.w; for (let k = -n; k <= n; k++) for (let j = -2; j <= 2; j++) t[(y0 + j) * w + x0 + k] = 'g'; g.map.t = t.join(''); g.units.forEach(v => { if (Math.abs(v.y - y0) <= 2 && Math.abs(v.x - x0) <= n) v.x += 30; }); };
const scene = (type, lv = 6, dist = 1) => { const g = base(), us = g.units.filter(u => u.o === 0 && !u.sm); g.units.forEach(v => { v.x = 90; v.y = 70; v.hp = 9999; });
  const pos = free(g, 20, 20), u = us[0]; flat(g, pos.x, pos.y, 6); u.x = pos.x; u.y = pos.y; u.sl = 0; u.sk.salud = 10; u.sk.dano = 25; u.hp = E.eff(g, u).maxHp;
  const c = mkC(g, type, pos.x + dist, pos.y, lv); return { g, u, c, us, pos }; };
const hit = (g, u, c) => { u.hp = E.eff(g, u).maxHp; c.hp = 99999; const h0 = c.hp; u.acted = false; u.at = 2; u.hits = 0; u.mp = 3; E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: c.id }); return h0 - c.hp; };
{ const { g, u, c } = scene('treant'); c.hp = Math.round(c.hp * 0.5); const h0 = c.hp; u.x = 90; u.y = 60; E.creaturesTurn(g); ok(c.hp > h0, 'treant: regenera'); }
{ const { g, u, c, us } = scene('hongo'); const v = us[1]; v.x = c.x; v.y = c.y + 1; v.pz = null; hit(g, u, c); ok(u.pz && v.pz, 'hongo: al ser golpeado la nube envenena a todos a 2 casillas'); }
{ const { g, u, c } = scene('plantacarn', 6, 6); const x0 = c.x; for (let i = 0; i < 5; i++) E.creaturesTurn(g); ok(c.x === x0 && !c.aw, 'planta carnívora: inmóvil mientras no hay presa'); u.x = c.x - 2; u.y = c.y; const h0 = u.hp; E.creaturesTurn(g); ok(c.aw && u.hp < h0, 'planta carnívora: despierta y ataca cuando alguien se acerca'); }
{ const { g, u, c } = scene('plantacarn', 6, 6); for (let i = 0; i < 22; i++) E.creaturesTurn(g); ok(!g.creatures.includes(c), 'planta carnívora: se marchita si nadie llega en 20 turnos (no bloquea la oleada)'); }
{ const { g, u, c } = scene('liana'); E.creaturesTurn(g); ok(u.sl >= 3, 'liana: apresa 3 turnos (sl=' + u.sl + ')'); }
{ const { g, u, c, us } = scene('florsolar', 6, 2); const v = us[1]; v.x = u.x; v.y = u.y + 1; E.creaturesTurn(g); ok(u.pn >= 2 && v.pn >= 2, 'flor solar: el destello ciega a todos alrededor'); }
{ const { g, u, c } = scene('musgo', 6, 2); E.creaturesTurn(g); ok(u.sl >= 1, 'musgo viviente: frena el movimiento'); }
{ const { g, u, c } = scene('diablillo', 6, 3); E.creaturesTurn(g); ok(u.pz, 'diablillo: brasas desde 3 casillas'); }
{ const { g, u, c } = scene('sabinf', 6, 2); E.creaturesTurn(g); ok(u.pz, 'sabueso infernal: el rastro de azufre quema'); }
{ const { g, u, c } = scene('cadenas', 6, 3); const d0 = cheb(u, c); E.creaturesTurn(g); ok(cheb(u, c) < d0 && u.sl >= 2, 'demonio de cadenas: arrastra y atrapa (' + d0 + ' → ' + cheb(u, c) + ')'); }
{ const { g, u, c } = scene('sucubo'); let n = 0; for (let i = 0; i < 40; i++) { u.cf = 0; c.hp = 99999; u.hp = E.eff(g, u).maxHp; E.creaturesTurn(g); if (u.cf) n++; } ok(n >= 8 && n <= 26, 'súcubo: encanto ~40% (' + n + ' de 40) y baja el daño (pn=' + u.pn + ')');
  u.cf = 1; u.hp = E.eff(g, u).maxHp; u.x = 90; u.y = 60; g.units.forEach(v => { v.x = v.x; }); E.advanceTurn(g); ok(u.at === 0, 'unidad encantada pierde su ataque el siguiente turno (at=' + u.at + ')'); }
{ const { g, u, c } = scene('bruto'); const h0 = u.hp; E.creaturesTurn(g); const d1 = h0 - u.hp; u.hp = h0; E.creaturesTurn(g); ok(d1 > (h0 - u.hp) * 1.3, 'bruto abisal: embestida inicial'); }
{ const { g, u, c } = scene('senorbr', 8, 2); u.sk.defensa = 10; const def0 = E.eff(g, u).def; E.creaturesTurn(g); ok(u.dw > 0 && E.eff(g, u).def < def0 * 0.85 && u.pz, 'señor de las brasas: aura sofocante baja la defensa (' + def0 + ' → ' + E.eff(g, u).def + ') y quema'); }
{ const { g, u, c } = scene('sabpes', 6, 3); E.creaturesTurn(g); ok(u.pn >= 1, 'sabueso de pesadilla: mirada de terror'); }
{ const { g, u, c } = scene('cuervoecl'); let ev = 0; for (let i = 0; i < 60; i++) if (hit(g, u, c) === 0) ev++; ok(ev >= 6 && ev <= 28, 'cuervo de eclipse: esquiva ~25% (' + ev + ' de 60)'); }
{ const { g, u, c } = scene('ciervobr'); let ev = 0; for (let i = 0; i < 60; i++) if (hit(g, u, c) === 0) ev++; ok(ev >= 12 && ev <= 34, 'ciervo de la bruma: esquiva ~35% (' + ev + ' de 60)'); }
{ const { g, u, c } = scene('gatomed', 6, 6); const d0 = cheb(u, c); E.creaturesTurn(g); ok(cheb(u, c) <= 1 && d0 > 2, 'gato de medianoche: salto de sombra'); }
{ const { g, u, c } = scene('torotin'); E.creaturesTurn(g); ok(u.sl >= 1, 'toro de tinieblas: aliento frío'); }
{ const { g, u, c } = scene('tejsue'); E.creaturesTurn(g); ok(u.sl >= 2 && u.pn >= 1, 'tejedora de sueños: atrapa y fatiga'); }
{ const { g, u, c } = scene('ojo', 6, 4); const h0 = u.hp; E.creaturesTurn(g); ok(u.hp < h0 && S.CREATURES.ojo.pierce === 0.5, 'ojo errante: rayo psíquico a 4 casillas'); }
{ const run = ls => { const { g, u, c } = scene('devsom'); S.CREATURES.devsom.ls = ls; c.hp = Math.round(c.hp * 0.5); E.creaturesTurn(g); return c.hp; }; const a = run(0.5), b = run(0); S.CREATURES.devsom.ls = 0.5; ok(a > b, 'devorador de sombras: se cura al golpear (' + a + ' vs ' + b + ' sin la habilidad)'); }
{ const { g, u, c } = scene('tentabis', 6, 3); const d0 = cheb(u, c); E.creaturesTurn(g); ok(cheb(u, c) < d0 || cheb(u, c) <= 1, 'tentáculo del abismo: arrastra a su presa (' + d0 + ' → ' + cheb(u, c) + ')'); }
{ const { g, u, c } = scene('mimico', 6, 3); for (let i = 0; i < 3; i++) E.creaturesTurn(g); ok(c.aw, 'mímico: despierta al acercarse'); }
{ const { g, u, c } = scene('mimico', 6, 1); const h0 = u.hp; E.creaturesTurn(g); const d1 = h0 - u.hp; u.hp = h0; E.creaturesTurn(g); ok(d1 > (h0 - u.hp) * 1.8, 'mímico: ataque inicial por sorpresa (' + d1 + ' vs ' + (h0 - u.hp) + ')'); }
{ const { g, u, c, us } = scene('susurrador', 6, 3); const v = us[1]; v.x = u.x; v.y = u.y + 1; E.creaturesTurn(g); ok(u.pn >= 2 && v.pn >= 2, 'susurrador: eco mental desorienta a todos'); }
{ const { g, u, c } = scene('espastral', 6, 6); const d0 = cheb(u, c); E.creaturesTurn(g); ok(cheb(u, c) <= 1 && d0 > 2, 'espectro astral: se teletransporta'); }
{ const { g, u, c } = scene('slimeac'); E.creaturesTurn(g); ok(u.dw >= 3, 'slime ácido: corroe la armadura'); }
{ const { g, u, c } = scene('cubo'); E.creaturesTurn(g); ok(u.sl >= 2 && u.pz, 'cubo gelatinoso: engulle y disuelve'); }
{ const { g, u, c } = scene('baba', 8); u.sk.dano = 40; const n0 = g.creatures.length; c.hp = c.hp; E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: c.id }); u.hp = E.eff(g, u).maxHp; ok(g.creatures.filter(k => k.t === 'baba').length >= 2, 'baba dividida: mitosis al recibir un golpe fuerte'); }
{ const { g, u, c } = scene('slimemag'); E.creaturesTurn(g); ok(u.pz, 'slime de magma: quema'); }
{ const { g, u, c } = scene('lodo', 6, 2); const h0 = u.hp; E.creaturesTurn(g); ok(u.hp < h0 && u.sl >= 1, 'amalgama de lodo: ataca a 2 casillas y ralentiza'); }
console.log(fails ? '\n' + fails + ' FALLOS' : '\nOK'); process.exit(fails ? 1 : 0);
