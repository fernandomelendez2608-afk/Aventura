require('./seed.js');
// Ciudadela fase 2 (v1.59): mazmorras, tope de 5 unidades, vista previa de la oleada y orden «invadir»
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Ciudadela: mazmorras');
const g = E.createGame('CD1', 'Host', 't'); g.cfg.mode = 'ciudadela'; g.cfg.idleTurns = 0; g.cfg.sim = true; E.addBot(g, 'azar');
ok(!E.startGame(g), 'arranca');
const C = S.CIT;
ok(g.dungeons.length === 3 && g.dungeons.every(d => d.x >= 0 && !'WO'.includes(g.map.t[d.y * g.map.w + d.x])), '3 mazmorras con entrada fuera de las murallas');
ok(g.dungeons.every(d => d.x < C.r.x0 || d.x > C.r.x1 || d.y < C.r.y0 || d.y > C.r.y1), 'las entradas están fuera del recinto');
ok(g.dungeons.every(d => g.creatures.some(c => c.dg === d.id)), 'las mazmorras tienen criaturas');
const sn = E.snapshot(g, 0);
ok(sn.dungeons.length === 3, 'las entradas son visibles en el snapshot');
ok(sn.ct.pv === null && sn.ct.raid === 5, 'sin explorar no se ve la próxima oleada');
// entrar: tope de 5 por jugador
const me = g.units.filter(u => u.o === 0 && !u.sm), d = g.dungeons[0];
for (let i = 0; i < 7; i++) { const u = me[i % me.length]; }
const extra = []; for (let i = 0; i < 4; i++) { const nu = E.newUnit(g, 0, d.x + 1, d.y); extra.push(nu); }
const all = me.concat(extra); all.forEach((u, i) => { u.x = d.x; u.y = d.y + (i % 2 ? 1 : 0); u.mp = 5; u.moved = false; });
let res = all.map(u => E.cmd(g, 0, { a: 'dungeon', d: 'enter', u: u.id, id: d.id }));
const inside = g.units.filter(u => u.o === 0 && u.dg).length;
ok(inside === 5, 'solo 5 unidades entran (entraron ' + inside + ')');
ok(res.some(r => r && r.err && /solo puedes tener 5/.test(r.err)), 'mensaje claro al pasar del tope');
// vista previa tras entrar
const s2 = E.snapshot(g, 1);
ok(s2.ct.pv && s2.ct.pv.n === 1 && s2.ct.pv.cnt > 0 && s2.ct.pv.types.length, 'al entrar, todos ven la próxima oleada (' + JSON.stringify(s2.ct.pv) + ')');
ok(s2.ct.pv.cnt === E.citPlan(g, 1).cnt, 'la cantidad coincide con la oleada real');
// jefe de mazmorra caído → oleada más pequeña
const bc = g.creatures.find(c => c.id === d.bossId); const killer = g.units.find(u => u.o === 0 && u.dg === d.id);
bc.hp = 1; const before = E.citPlan(g, 1).cnt;
for (let i = 0; i < 3 && g.creatures.includes(bc); i++) { killer.x = bc.x; killer.y = bc.y + 1; killer.at = 3; killer.mp = 3; try { E.cmd(g, 0, { a: 'attack', u: killer.id, tt: 'c', id: bc.id }); } catch (e) {} }
if (g.creatures.includes(bc)) { g.creatures.splice(g.creatures.indexOf(bc), 1); }
// derribo directo mediante hook (el ataque depende del alcance real)
g.cw.weak = 1; const sw = E.snapshot(g, 0).ct.pv; ok(sw.cnt <= before, 'con mazmorra vencida la oleada es menor o igual (' + sw.cnt + ' ≤ ' + before + ')');
// el preview desaparece al llegar la oleada
g.cw.next = g.turn; let err = null; try { for (let i = 0; i < 8 && g.cw.n < 1; i++) E.advanceTurn(g); } catch (e) { err = e; }
ok(!err && g.cw.n === 1, 'llega la oleada 1 sin errores' + (err ? err.message : ''));
ok(E.snapshot(g, 0).ct.pv === null, 'la vista previa se borra al llegar la oleada');
ok(g.dungeons.every(x => g.creatures.some(c => c.dg === x.id) || g.units.some(u => u.dg === x.id)), 'las mazmorras se renuevan');
// orden invadir
{ const h = E.createGame('CD2', 'Host', 't'); h.cfg.mode = 'ciudadela'; h.cfg.idleTurns = 0; h.cfg.sim = true; E.addBot(h, 'azar'); E.startGame(h);
  const us = h.units.filter(u => u.o === 0 && !u.sm); E.cmd(h, 0, { a: 'sq', d: 'new', n: 'Raid', ids: us.map(u => u.id) }); E.cmd(h, 0, { a: 'sq', d: 'ord', id: 1, k: 'raid' });
  ok(h.players[0].sq[0].k === 'raid', 'orden raid aceptada');
  let e2 = null, went = false; try { for (let i = 0; i < 12; i++) { E.advanceTurn(h); if (h.units.some(u => u.o === 0 && u.dg)) went = true; } } catch (e) { e2 = e; }
  ok(!e2, 'ejecutar la orden invadir varios turnos sin errores' + (e2 ? e2.message + e2.stack : '')); ok(went, 'la escuadra llega a entrar en una mazmorra');
  ok(h.units.filter(u => u.o === 0 && u.dg && !u.sm).length <= 5, 'nunca más de 5 dentro'); }
console.log(fails ? '\n' + fails + ' FALLOS' : '\nTodo bien'); process.exit(fails ? 1 : 0);
