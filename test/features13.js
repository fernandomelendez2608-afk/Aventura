require('./seed.js');
// Pruebas del modo Laberinto (v1.55)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const mk = (floors = '10', nb = 3, sim = false) => { const g = E.createGame('LB1', 'Host', 't'); g.cfg.mode = 'laberinto'; g.cfg.floors = floors; g.cfg.idleTurns = 0; if (sim) g.cfg.sim = true; for (let i = 0; i < nb; i++) E.addBot(g, 'azar'); E.startGame(g); return g; };
const fl = (g, u) => g.dungeons.find(d => d.id === u.dg);
const reach = (g, a, b) => { const w = g.map.w, seen = new Set([a.y * w + a.x]), q = [[a.x, a.y]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (y + dy) * w + x + dx; if (!seen.has(k) && g.map.t[k] === 'r') { seen.add(k); q.push([x + dx, y + dy]); } } } return seen.has(b.y * w + b.x); };
console.log('Laberinto');
let g = mk('10');
ok(g.dungeons.length === 10 && g.cities.every(c => c.vela), '10 pisos y solo velas (sin ciudades)');
ok(g.players.every(p => g.units.filter(u => u.o === p.id).length === 2), 'cada jugador empieza con 2 unidades');
ok(g.players.every(p => g.cities.filter(c => c.owner === p.id).length === 1), 'una vela por jugador en el primer piso');
ok(g.units.every(u => fl(g, u).floor === 1), 'todos empiezan en el piso 1');
ok(g.dungeons.every(d => reach(g, d.exit, d.down)), 'en todos los pisos se llega de la subida a la bajada');
ok(g.dungeons.map(d => d.boss).join() === [0, 1, 0, 1, 0, 1, 0, 1, 0, 1].map(Boolean).join(), 'jefe cada 2 pisos (y en el último)');
ok(mk('15').dungeons.length === 15 && mk('20').dungeons.length === 20 && mk('15').dungeons[14].boss, '15 y 20 pisos; el último siempre tiene jefe');
ok(g.dungeons.filter(d => d.boss).every(d => g.creatures.find(c => c.id === d.bossId)), 'los pisos con jefe tienen jefe');
ok(S.CREATURES[g.creatures.find(c => c.id === g.dungeons[9].bossId).t].n === S.CREATURES.dragon.n, 'el jefe final es el Dragón');
const snap = E.snapshot(g, 0);
ok(snap.lab && snap.lab.n === 10 && snap.dungeons.every(d => d.lab) && snap.cities.every(c => c.vela), 'el snapshot trae pisos y velas');
const dip = E.cmd(g, 0, { a: 'dip', d: 'war', to: 1 }); ok(g.players.every(a => g.players.every(b => a.id === b.id || g.dip[a.id < b.id ? a.id + '-' + b.id : b.id + '-' + a.id] === 'alianza')), 'todos aliados');
// sin reclutar ni construir
const vela = g.cities.find(c => c.owner === 0);
ok(E.cmd(g, 0, { a: 'recruit', c: vela.id }).err && E.cmd(g, 0, { a: 'build', c: vela.id, k: 'herreria' }).err, 'las velas no reclutan ni construyen');
// forjar en la vela
vela.st.m.hierro = 20; vela.st.m.cuero = 20; const u0 = g.units.find(u => u.o === 0); const n0 = vela.st.it.length;
const r = E.cmd(g, 0, { a: 'craft', c: vela.id, k: 'espada', tr: 1 }); ok(!r.err && vela.st.it.length === n0 + 1, 'se puede forjar en la vela ' + (r.err || ''));
// escalera: no se puede bajar lejos, ni con el jefe vivo
const d1 = g.dungeons[0];
ok(!!E.cmd(g, 0, { a: 'dungeon', d: 'down', u: u0.id }).err, 'lejos de la escalera no se baja');
// piso 1 sin jefe: se baja y se enciende la vela del piso 2
u0.x = d1.down.x; u0.y = d1.down.y - 1; u0.mp = 5; g.creatures = g.creatures.filter(c => c.dg !== d1.id);
let rr = E.cmd(g, 0, { a: 'dungeon', d: 'down', u: u0.id }); ok(!rr.err && fl(g, u0).floor === 2, 'junto a la escalera se baja al piso 2 ' + (rr.err || ''));
ok(g.cities.filter(c => c.owner === 0).length === 2 && g.cities.some(c => c.owner === 0 && c.dg === g.dungeons[1].id), 'aparece una vela tuya en el piso 2 (una por piso)');
const u1 = g.units.filter(u => u.o === 0 && u.id !== u0.id)[0]; u1.x = g.dungeons[1].down.x; u1.y = g.dungeons[1].down.y; u1.dg = g.dungeons[1].id; u1.mp = 5;
rr = E.cmd(g, 0, { a: 'dungeon', d: 'down', u: u1.id }); ok(!!rr.err && /jefe/.test(rr.err), 'la escalera de un piso con jefe está sellada ' + (rr.err || ''));
ok(g.cities.filter(c => c.owner === 0).length === 2, 'no se duplican velas');
g.creatures = g.creatures.filter(c => c.id !== g.dungeons[1].bossId); g.dungeons[1].cleared = g.turn;
rr = E.cmd(g, 0, { a: 'dungeon', d: 'down', u: u1.id }); ok(!rr.err && fl(g, u1).floor === 3, 'con el jefe vencido se puede bajar');
// subir
u1.x = g.dungeons[2].exit.x; u1.y = g.dungeons[2].exit.y + 1; u1.mp = 5;
rr = E.cmd(g, 0, { a: 'dungeon', d: 'leave', u: u1.id }); ok(!rr.err && fl(g, u1).floor === 2, 'se puede subir por la escalera de subida');
const ux = g.units.find(u => u.o === 1); ux.x = d1.exit.x; ux.y = d1.exit.y + 1; ux.mp = 5; ok(!!E.cmd(g, 1, { a: 'dungeon', d: 'leave', u: ux.id }).err, 'desde el piso 1 no hay salida');
// el almacén se comparte entre las velas del jugador
const v2 = g.cities.find(c => c.owner === 0 && c.dg === g.dungeons[1].id); v2.st.m.alma = (v2.st.m.alma || 0) + 5;
ok(vela.st.m.alma === v2.st.m.alma, 'las velas de un jugador comparten almacén');
// la vela no cura ni da bonos
ok(S.LAB.mats.cuero > 0 && Object.keys(require('../engine.js').snapshot(g, 0).cities.find(c => c.id === vela.id).inc || {}).length === 0, 'la vela no produce nada');
// revivir con la vela
{ const v0 = g.units.find(u => u.o === 2), vl2 = g.cities.find(c => c.owner === 2); vl2.st.m.alma = 20; vl2.st.m.hueso = 20;
  E.killUnit(g, v0, { creature: g.creatures[0] }); const gr = (g.graves || []).find(x => x.o === 2); ok(!!gr, 'al caer una unidad queda en los caídos');
  const rv = gr && E.cmd(g, 2, { a: 'revive', c: vl2.id, g: gr.id }); ok(rv && !rv.err, 'se puede revivir desde la vela ' + (rv && rv.err || ''));
  E.advanceTurn(g); E.advanceTurn(g); E.advanceTurn(g);
  const back = g.units.filter(u => u.o === 2 && u.dg === g.dungeons[0].id); ok(back.length >= 2 && back.every(u => g.map.t[u.y * g.map.w + u.x] === 'r'), 'la unidad revivida reaparece dentro del piso, junto a la vela'); }
// junto a la vela de un aliado se usa el propio almacén
{ const ga = mk('10'), ownA = ga.cities.find(c => c.owner === 0), ownB = ga.cities.find(c => c.owner === 1), ub = ga.units.find(u => u.o === 1);
  ub.x = ownA.x + 1; ub.y = ownA.y + 1; if (ga.map.t[ub.y * ga.map.w + ub.x] !== 'r') { ub.x = ownA.x; ub.y = ownA.y + 1; }
  ownB.st.m.cuero = 50; const sn = E.snapshot(ga, 1);
  ok(sn.mine.find(u => u.id === ub.id).nearCity === true, 'una unidad junto a la vela de un aliado cuenta como junto a una vela');
  E.addMats(ub, { hueso: 5 }); const hb = ownB.st.m.hueso || 0, ha = ownA.st.m.hueso || 0; const r2 = E.cmd(ga, 1, { a: 'dep', u: ub.id, all: 1 });
  ok(!r2.err && (ownB.st.m.hueso || 0) >= hb + 5 && (ownA.st.m.hueso || 0) === ha, 'guarda en SU almacén y no en el del aliado ' + (r2.err || '')); }
// victoria al vencer el jefe final
const g2 = mk('10'); const last = g2.dungeons[9]; g2.creatures = g2.creatures.filter(c => c.id !== last.bossId); last.cleared = g2.turn; E.advanceTurn(g2);
ok(g2.status === 'over' && g2.lab.fin && g2.winners.length === g2.players.length, 'al vencer al jefe final gana todo el grupo');
// derrota
const g3 = mk('10', 1); for (const u of g3.units.slice()) g3.units.splice(g3.units.indexOf(u), 1); E.advanceTurn(g3);
ok(g3.status === 'over' && g3.lab.lost, 'si todos caen sin poder revivir, pierden');
// no hay mundo exterior: sin hordas, jefes ni eventos
const g4 = mk('10'); const nb = g4.creatures.length; for (let i = 0; i < 20; i++) E.advanceTurn(g4); ok(g4.creatures.length <= nb && !g4.creatures.some(c => c.tg), 'sin hordas ni apariciones al azar');
// simulación con bots, sin errores
const g5 = mk('10', 5, true); g5.players[0].bot = true; let errs = 0; const oe = console.error; console.error = () => { errs++; };
for (let i = 0; i < 120 && g5.status === 'playing'; i++) E.advanceTurn(g5);
console.error = oe; ok(errs === 0, `120 turnos con bots sin errores (piso más hondo: ${g5.lab.best})`); ok(g5.lab.best >= 2, 'los bots bajan por las escaleras');
const re = E.deserialize ? E.deserialize(E.serialize(g5)) : null; if (re) ok(re.lab && re.dungeons.length === 10 && re.cities.filter(c => c.vela).length === g5.cities.filter(c => c.vela).length, 'se guarda y se carga bien');
console.log(fails ? `\n${fails} fallos` : '\nTodo bien');
process.exit(fails ? 1 : 0);
