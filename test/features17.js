require('./seed.js');
// Modo Ciudadela, fase 1 (v1.58): ciudad amurallada compartida, oleadas y escuadras
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Ciudadela');
const mk = (bots = 2, id = 'CT1') => { const g = E.createGame(id, 'Host', 't'); g.cfg.mode = 'ciudadela'; g.cfg.idleTurns = 0; g.cfg.sim = true; for (let i = 0; i < bots; i++) E.addBot(g, 'azar'); const r = E.startGame(g); return { g, r }; };
const { g, r } = mk();
ok(!r, 'la partida arranca (' + r + ')');
const C = S.CIT, w = g.map.w, t = g.map.t, at = (x, y) => t[y * w + x];
ok(w === C.w && g.map.h >= C.h, 'mapa del tamaño de la Ciudadela');
ok(C.gates.every(x => at(x.x, x.y) === 'O'), 'las tres puertas existen');
// las murallas son infranqueables salvo por las puertas, y todas las puertas comunican con la plaza
let wallOk = true; for (let x = C.r.x0 - 1; x <= C.r.x1 + 1; x++) for (const y of [C.r.y0 - 1, C.r.y1 + 1]) if (!'WO'.includes(at(x, y))) wallOk = false;
ok(wallOk, 'el anillo de muralla está completo');
const reach = (sx, sy) => { const seen = new Set([sy * w + sx]), q = [[sx, sy]]; for (let i = 0; i < q.length; i++) for (const [dx, dy] of S.DIRS) { const X = q[i][0] + dx, Y = q[i][1] + dy, k = Y * w + X; if (X < 0 || Y < 0 || X >= w || Y >= g.map.h || seen.has(k) || S.TERR[at(X, Y)].c >= 99) continue; seen.add(k); q.push([X, Y]); } return seen; };
const rp = reach(C.plaza.x, C.plaza.y);
ok(C.gates.every(x => rp.has(x.y * w + x.x)), 'desde la plaza se llega a todas las puertas');
ok(rp.has(2 * w + 2) || rp.has(5 * w + 5), 'se puede salir de la ciudad por las puertas');
// ciudad compartida
const sn0 = E.snapshot(g, 0), sn1 = E.snapshot(g, 1);
ok(g.cities.filter(c => c.cit).length === 1, 'una sola ciudad compartida');
ok(sn0.cities.find(c => c.cit).o === 0 && sn1.cities.find(c => c.cit).o === 1, 'cada jugador la ve como suya');
ok(sn0.ct && sn0.ct.w.total === C.waves && sn0.ct.hp === C.hp, 'snapshot con integridad y oleadas');
ok(g.units.filter(u => u.o === 0 && !u.sm).length === C.startUnits, 'unidades iniciales por jugador');
// cualquiera puede reclutar en la ciudad compartida
const cit = g.cities.find(c => c.cit); cit.st = Object.assign(cit.st, { cuero: 500, hueso: 200, hierro: 100, acero: 40 });
const before = g.units.filter(u => u.o === 1).length;
const rr = E.cmd(g, 1, { a: 'recruit', c: cit.id });
ok(rr && !rr.err && g.units.filter(u => u.o === 1).length === before + 1, 'el jugador 2 recluta en la ciudad compartida ' + (rr && rr.err || ''));
// escuadras
const me = g.players[0], mine = () => g.units.filter(u => u.o === 0 && !u.sm);
E.cmd(g, 0, { a: 'sq', d: 'new', n: 'Muro', ids: mine().map(u => u.id) });
ok(me.sq.length === 1 && mine().every(u => u.sq === 1), 'escuadra nueva con todas las unidades');
E.cmd(g, 0, { a: 'sq', d: 'ord', id: 1, k: 'guard', g: 'S' });
ok(me.sq[0].k === 'guard' && me.sq[0].g === 'S' && me.sq[0].y < C.r.y1 + 2, 'orden de defender la puerta sur');
E.cmd(g, 0, { a: 'sq', d: 'ord', id: 1, k: 'guard', g: 'P' });
ok(me.sq[0].x === C.plaza.x && me.sq[0].y === C.plaza.y, 'orden de defender la plaza');
E.cmd(g, 0, { a: 'sq', d: 'ord', id: 1, k: 'malo' });
ok(me.sq[0].k === 'guard', 'orden inválida rechazada');
E.cmd(g, 0, { a: 'sq', d: 'unit', u: mine()[0].id, id: 0 });
ok(!mine()[0].sq, 'sacar una unidad de la escuadra');
E.cmd(g, 0, { a: 'sq', d: 'fill', id: 1 }); ok(mine().every(u => u.sq === 1), 'rellenar escuadra');
E.cmd(g, 0, { a: 'sqrun' }); ok(true, 'ejecutar órdenes no rompe');
// oleadas: planificación escala con jugadores
const p2 = (() => { const a = mk(1, 'CT2').g; return a; })(), p4 = mk(3, 'CT3').g;
ok(E.citPlan(p4, 3).cnt > E.citPlan(p2, 3).cnt, 'más jugadores, más enemigos');
ok(E.citPlan(g, 5).boss && !E.citPlan(g, 4).boss, 'jefe cada 5 oleadas');
ok(E.citPlan(g, 20).cnt <= C.maxEnemies, 'tope de enemigos por oleada');
// simulación: avanzan oleadas y no hay excepciones
let thrown = null; try { for (let i = 0; i < 60 && g.status === 'playing'; i++) E.advanceTurn(g); } catch (e) { thrown = e; }
ok(!thrown, 'simular 60 turnos sin errores' + (thrown ? ': ' + thrown.message : ''));
ok(g.cw.n === 0 && g.cw.next === C.first, 'la primera oleada tarda ' + C.first + ' turnos (n=' + g.cw.n + ')');
ok(C.first === 100 && C.rest === 100, 'una oleada cada 100 turnos por defecto');
{ const q = E.createGame('CG1', 'Host', 't'); q.cfg.mode = 'ciudadela'; q.cfg.waveGap = 25; q.cfg.sim = true; E.addBot(q, 'azar'); E.startGame(q); ok(q.cw.next === 25, 'ajuste del lobby: primera oleada a los 25 turnos'); q.cw.next = q.turn; q.cw.n = 0; for (let i = 0; i < 2; i++) E.advanceTurn(q); const ids = q.cw.ids.slice(); for (const id of ids) { const ix = q.creatures.findIndex(c => c.id === id); if (ix >= 0) q.creatures.splice(ix, 1); } E.advanceTurn(q); ok(q.cw.n === 1 && q.cw.next - q.turn >= 23, 'al superarla la siguiente tarda 25 turnos (n=' + q.cw.n + ', next-turn=' + (q.cw.next - q.turn) + ')'); }
g.cw.next = g.turn; for (let i = 0; i < 3 && g.status === 'playing'; i++) E.advanceTurn(g);
ok(g.cw.n >= 1, 'al forzar el turno llega la oleada (n=' + g.cw.n + ')');
// escuadras (v1.61.3): orden inmediata, unidades nuevas que se unen solas y resumen de estado
{ const h = E.createGame('SQ9', 'Host', 't'); h.cfg.mode = 'ciudadela'; h.cfg.idleTurns = 0; h.cfg.sim = true; E.addBot(h, 'azar'); E.startGame(h);
  const mine = () => h.units.filter(u => u.o === 0 && !u.sm), p0 = h.players[0], x0 = mine().map(u => u.x + ',' + u.y).join();
  E.cmd(h, 0, { a: 'sq', d: 'new', n: 'A', ids: mine().map(u => u.id) });
  const r1 = E.cmd(h, 0, { a: 'sq', d: 'ord', id: 1, k: 'guard', g: 'S' });
  ok(/ponen en marcha/.test(r1.msg || '') && mine().map(u => u.x + ',' + u.y).join() !== x0, 'al dar la orden las unidades se mueven en el momento');
  let st = E.snapshot(h, 0).ct.sq[0]; ok(st.c === 4 && st.hp === 100 && st.ids.length === 4 && st.auto === 0, 'resumen: unidades, salud media y auto');
  E.cmd(h, 0, { a: 'sq', d: 'auto', id: 1 }); ok(p0.sq[0].auto === 1, 'activar «unidades nuevas se unen solas»');
  const city = h.cities.find(c => c.cit); city.st.m = { cuero: 500, hierro: 100, acero: 50, hueso: 100 };
  E.cmd(h, 0, { a: 'recruit', c: city.id }); E.cmd(h, 0, { a: 'sqrun' });
  ok(mine().every(u => u.sq === 1), 'la unidad recién reclutada entra en la escuadra automática');
  E.cmd(h, 0, { a: 'sq', d: 'auto', id: 1 }); ok(!p0.sq[0].auto, 'desactivar la unión automática');
  // defender no persigue lejos del puesto
  const sq = p0.sq[0], foe = { id: 99001, t: 'orco', lv: 1, x: sq.x, y: sq.y + 12, hp: 99, tg: city.id, ttl: 50 }; h.creatures.push(foe);
  for (const u of mine()) { u.x = sq.x; u.y = sq.y - 1; } E.cmd(h, 0, { a: 'sqrun' });
  ok(mine().every(u => Math.max(Math.abs(u.x - sq.x), Math.abs(u.y - sq.y)) <= 4), 'la escuadra que defiende no sale a perseguir enemigos lejanos'); }
// derrota: plaza a 0
{ const { g: h } = mk(1, 'CT4'); h.cit.hp = 1; h.cw.n = 1; const c = h.cities.find(q => q.cit); h.creatures.push({ id: 99999, t: 'orco', lv: 3, x: S.CIT.plaza.x, y: S.CIT.plaza.y, hp: 999, tg: c.id, ttl: 50 }); h.cw.ids = [99999]; h.cw.cnt = 1; for (let i = 0; i < 3 && h.status === 'playing'; i++) E.advanceTurn(h); ok(h.status === 'over' || h.cw.lost || h.cit.hp <= 0, 'si los enemigos llegan a la plaza se pierde'); }
// victoria: todas las oleadas superadas
{ const { g: h } = mk(1, 'CT5'); h.cw.n = C.waves; h.cw.cleared = C.waves - 1; h.cw.ids = []; h.cw.cnt = 0; h.cw.next = h.turn + 99; let ok2 = true; try { for (let i = 0; i < 3; i++) E.advanceTurn(h); } catch (e) { ok2 = false; } ok(ok2, 'último tramo sin errores'); }
// visión: la ciudad siempre se ve
ok(sn0.terr.charAt(C.plaza.y * w + C.plaza.x) !== '?' && sn0.terr.charAt((C.r.y0 - 2) * w + C.r.x0) !== '?', 'la ciudad y su entorno siempre son visibles');
// otros modos intactos
{ const a = E.createGame('NM1', 'Host', 't'); E.addBot(a, 'azar'); E.startGame(a); ok(!a.cit && !E.snapshot(a, 0).ct, 'modo normal sin Ciudadela'); }
console.log(fails ? '\n' + fails + ' FALLOS' : '\nTodo bien'); process.exit(fails ? 1 : 0);
