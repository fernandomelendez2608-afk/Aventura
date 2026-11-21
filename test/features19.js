require('./seed.js');
// Ciudadela v1.61: mundo exterior con viajeros, taberna, mercado y torneo de la arena
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Ciudadela: mundo, taberna, mercado y arena');
const mk = id => { const g = E.createGame(id, 'Host', 't'); g.cfg.mode = 'ciudadela'; g.cfg.idleTurns = 0; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g); return g; };
const g = mk('CW1'); const C = S.CIT, city = g.cities.find(c => c.cit);
ok(g.map.w === 96 && g.map.h0 === 76, 'mundo grande alrededor de la muralla');
ok(g.npcs.length === 7 && g.npcs.every(n => Math.max(Math.abs(n.x - C.plaza.x), Math.abs(n.y - C.plaza.y)) >= 9), 'viajeros repartidos fuera de la ciudad');
ok(g.npcs.some(n => n.k === 'recluta' && n.lv >= 1 && n.cost && n.sk), 'hay reclutas con nivel, atributos y precio');
city.st.m = { cuero: 900, hueso: 100, hierro: 300, acero: 200, alma: 100, escama: 30 };
// recluta a un viajero
const nr = g.npcs.find(n => n.k === 'recluta'), me = g.units.find(u => u.o === 0 && !u.sm); me.x = nr.x; me.y = nr.y + 1;
const before = g.units.filter(u => u.o === 0).length;
let r = E.cmd(g, 0, { a: 'npc', id: nr.id, u: me.id });
ok(r && !r.err && g.units.filter(u => u.o === 0).length === before + 1 && !g.npcs.includes(nr), 'reclutar a un viajero (' + (r && r.err || 'ok') + ')');
const nu = g.units.filter(u => u.o === 0).pop(); ok(nu.lv === nr.lv && Object.values(nu.sk).reduce((a, b) => a + b, 0) === nr.lv, 'conserva nivel y atributos del viajero');
r = E.cmd(g, 0, { a: 'npc', id: 9999, u: me.id }); ok(r.err, 'viajero inexistente rechazado');
// sanador y maestro
const ns = g.npcs.find(n => n.k === 'sanador'); me.x = ns.x; me.y = ns.y + 1; me.hp = 1;
r = E.cmd(g, 0, { a: 'npc', id: ns.id, u: me.id }); ok(!r.err && me.hp > 1, 'el curandero cura');
const nm = g.npcs.find(n => n.k === 'maestro'); me.x = nm.x; me.y = nm.y + 1; const pt = me.pts;
r = E.cmd(g, 0, { a: 'npc', id: nm.id, u: me.id }); ok(!r.err && me.pts === pt + 2, 'el maestro da +2 puntos');
// taberna
ok(g.bar && g.bar.c.length === 3, 'la taberna tiene 3 clientes'); const sn = E.snapshot(g, 1); ok(sn.ct.bar.c.length === 3 && sn.ct.bar.left === 30, 'visible para todos, renueva cada 30 turnos');
const cd = g.bar.c[0]; const b0 = g.units.filter(u => u.o === 1).length;
r = E.cmd(g, 1, { a: 'bar', id: cd.id }); ok(!r.err && g.units.filter(u => u.o === 1).length === b0 + 1, 'otro jugador recluta en la taberna (' + (r.err || '') + ')');
r = E.cmd(g, 0, { a: 'bar', id: cd.id }); ok(r.err, 'no se puede reclutar dos veces al mismo');
// forzar legendario y comprobar vampirismo
{ const h = mk('CW2'); const c2 = h.cities.find(c => c.cit); c2.st.m = { cuero: 900, hierro: 300, acero: 200, alma: 100, escama: 30 };
  h.bar.c[0].rar = 4; h.bar.c[0].vamp = 1; h.bar.c[0].cls = 'duelista'; h.bar.c[0].lv = 10; h.bar.c[0].cost = S.BAR.cost[4];
  const rr = E.cmd(h, 0, { a: 'bar', id: h.bar.c[0].id }); const u = h.units.filter(x => x.o === 0).pop();
  ok(!rr.err && u.vamp === 1 && u.cls === 'duelista' && u.inv.it.length >= 1, 'el legendario llega vampiro, con clase y un objeto (' + (rr.err || '') + ')'); }
// mercado: puestos en la calle
{ const h = mk('CW4'); const c2 = h.cities.find(c => c.cit); c2.st.m = { hierro: 500, acero: 300, alma: 100, cuero: 100 }; let m = null; for (let i = 0; i < 12 && !m; i++) { E.advanceTurn(h); m = h.merch[0]; }
  ok(m && m.fixed && m.y === C.plaza.y + C.market.dy && C.market.dx.includes(m.x - C.plaza.x), 'los mercaderes aparecen en un puesto de la calle del mercado');
  if (m) { const us = h.units.find(u => u.o === 0 && !u.sm); const k = m.offers.findIndex(o => o.k === 'gem' || o.k === 'mat'); const hb = JSON.stringify(c2.st.m); const rr = E.cmd(h, 0, { a: 'merch', id: m.id, i: k, u: us.id }); ok(!rr.err && JSON.stringify(c2.st.m) !== hb, 'se compra desde el almacén de la ciudad (' + (rr.err || '') + ')'); } }
// arena
{ const h = mk('CW5'); const c2 = h.cities.find(c => c.cit); c2.st.m = { cuero: 10, hierro: 10 }; let rr = E.cmd(h, 0, { a: 'arena', u: h.units[0].id }); ok(rr.err, 'sin torneo abierto no se puede entrar');
  for (let i = 0; i < 12 && !h.arena; i++) E.advanceTurn(h); ok(h.arena, 'el torneo se abre');
  const u = h.units.find(x => x.o === 0 && !x.sm); u.x = C.plaza.x; u.y = C.plaza.y; const hp0 = u.hp, lv0 = u.lv; const n0 = h.units.length;
  rr = E.cmd(h, 0, { a: 'arena', u: u.id }); ok(!rr.err && /🏟️/.test(rr.msg), 'la unidad lucha en la arena');
  ok(h.units.includes(u) && h.units.length === n0 && u.hp === hp0, 'si cae, no pierde a la unidad ni su vida (' + (rr.msg || '').slice(0, 90) + ')');
  rr = E.cmd(h, 0, { a: 'arena', u: u.id }); ok(rr.err, 'una unidad compite una vez por torneo');
  const sn2 = E.snapshot(h, 0); ok(sn2.ct.ar.open === 1 && sn2.ct.ar.ent.includes(u.id), 'snapshot con el estado del torneo');
  // campeón: unidad muy fuerte
  const v = h.units.find(x => x.o === 0 && x.id !== u.id && !x.sm); v.lv = 40; v.sk.dano = 30; v.sk.salud = 30; v.sk.defensa = 30; v.x = C.plaza.x; v.y = C.plaza.y; v.hp = 9999;
  rr = E.cmd(h, 0, { a: 'arena', u: v.id }); ok(!rr.err && /CAMPE/.test(rr.msg), 'una unidad fuerte gana el torneo y hay premio'); 
  for (let i = 0; i < 6; i++) E.advanceTurn(h); ok(!h.arena || h.arena.start > 8, 'el torneo se cierra'); }
// simulación larga sin errores
{ const h = mk('CW6'); let err = null; try { for (let i = 0; i < 70 && h.status === 'playing'; i++) E.advanceTurn(h); } catch (e) { err = e; } ok(!err, 'simulación de 70 turnos sin errores'); ok(h.npcs.length <= S.NPC.cap, 'tope de viajeros'); }
console.log(fails ? '\n' + fails + ' FALLOS' : '\nTodo bien'); process.exit(fails ? 1 : 0);
