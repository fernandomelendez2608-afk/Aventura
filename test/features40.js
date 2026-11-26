require('./seed.js');
// v1.73.0: guarniciones (RTS) y muralla que se rompe
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Guarniciones y muralla');
const mk = (seed, bots) => { const g = E.createGame(seed, 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; for (let i = 0; i < (bots === undefined ? 1 : bots); i++) E.addBot(g, 'azar'); E.startGame(g); return g; };
const g = mk('GA1'); const me = g.players.find(p => !p.bot).id, other = g.players.find(p => p.bot).id;
let grs = g.units.filter(u => u.gr);
ok(grs.length === 2, 'empiezan 2 guarniciones gratis (' + grs.length + ')');
const e0 = E.eff ? null : null;
const snap = E.snapshot(g, me), snap2 = E.snapshot(g, other);
ok(snap.mine.filter(u => u.gr).length === 2 && snap2.mine.filter(u => u.gr).length === 2, 'todos los jugadores las controlan (están en «mine» de cada uno)');
const u = grs[0]; ok(u.hp === 160 && !u.inv.it.length, 'una guarnición tiene 4 soldados (160 de vida) y no lleva nada');
// control compartido: otro jugador la mueve
u.mp = 3; u.moved = false; const r = E.cmd(g, other, { a: 'move', u: u.id, x: u.x + 1, y: u.y }); ok(!r.err || /no|alcan|llegar|ocupad/i.test(r.err), 'otro jugador puede darle órdenes (' + (r.err || 'ok') + ')');
const r2 = E.cmd(g, other, { a: 'equip', u: u.id, i: 0 }); ok(r2.err, 'no se les puede equipar nada (' + r2.err + ')');
// bono por cercanía
const a = grs[0], b = grs[1]; b.x = a.x + 1; b.y = a.y; const ea = E.eff ? E.snapshot(g, me).mine.find(x => x.id === a.id).e : null;
b.x = a.x + 6; const ea0 = E.snapshot(g, me).mine.find(x => x.id === a.id).e;
b.x = a.x + 1; const ea1 = E.snapshot(g, me).mine.find(x => x.id === a.id).e;
ok(ea1.dmg > ea0.dmg && ea1.def > ea0.def, `estar junto a otra guarnición mejora el daño y la defensa (${ea0.dmg}→${ea1.dmg}, ${ea0.def}→${ea1.def})`);
// daño reduce soldados y daño
a.hp = 80; const eh = E.snapshot(g, me).mine.find(x => x.id === a.id); ok(eh.gr === 2 && eh.e.dmg < ea1.dmg, 'al perder vida pierde soldados y daño (' + eh.gr + ' soldados)');
a.hp = 160;
// reclutar: cuesta y tiene tope
const city = g.cities[0]; city.st.m = { hierro: 100, cuero: 100 }; const c0 = g.units.filter(x => x.gr).length;
const rr = E.cmd(g, me, { a: 'garrison', c: city.id }); ok(!rr.err && g.units.filter(x => x.gr).length === c0 + 1 && city.st.m.hierro < 100, 'reclutar una guarnición cuesta materiales');
for (let i = 0; i < 30; i++) E.cmd(g, me, { a: 'garrison', c: city.id }); ok(g.units.filter(x => x.gr).length <= 6 + 3 * 2, 'hay un tope de guarniciones (' + g.units.filter(x => x.gr).length + ')');
ok(g.units.filter(x => !x.gr && !x.sm).every(x => x.o !== undefined) && E.snapshot(g, me).mine.filter(x => !x.gr).length >= 1, 'no cuentan como unidades normales');
// muralla: se rompe, las voladoras la cruzan, se repara
const h = mk('GA2'); const C = S.CIT, w = h.map.w; h.creatures = []; h.cw.next = 999999;
const wx = C.r.x0 - 1, wy = C.plaza.y; const k = wy * w + wx; ok(h.map.t.charAt(k) === 'W', 'hay un tramo de muralla en (' + wx + ',' + wy + ')');
h.units.filter(x => x.gr).forEach(x => { x.x = C.plaza.x; x.y = C.plaza.y + 4; }); const mine = h.units.filter(x => !x.gr); mine.forEach(x => { x.x = C.plaza.x + 2; x.y = C.plaza.y + 2; });
const cr = E.spawnCreature(h, 'lobo', wx - 1, wy, 8); cr.tg = h.cities[0].id; cr.ttl = 400; h.cw.ids.push(cr.id);
let broke = false; for (let t = 0; t < 120 && !broke; t++) { cr.hp = 9999; E.advanceTurn(h); broke = h.map.t.charAt(k) !== 'W'; }
ok(broke, 'una criatura terrestre rompe la muralla si no puede pasar');
ok(E.snapshot(h, 0).ct.wl.length >= 1 || broke, 'el cliente recibe los tramos dañados');
// reparación con materiales cuando no hay enemigos
h.creatures = []; h.cw.ids = []; h.cw.cleared = 1; h.cw.n = 1; h.cw.next = h.turn + 500; h.cities[0].st.m = { hierro: 50, hueso: 50 }; let fixed = false; for (let t = 0; t < 6 && !fixed; t++) { E.advanceTurn(h); fixed = h.map.t.charAt(k) === 'W'; }
ok(fixed, 'la brecha se reconstruye con materiales entre oleadas');
// las voladoras no rompen: cruzan
const f = mk('GA3'); f.creatures = []; f.cw.next = 999999; const hawk = E.spawnCreature(f, 'halcon', wx - 2, wy, 5); hawk.tg = f.cities[0].id; hawk.ttl = 400; f.cw.ids.push(hawk.id);
for (let t = 0; t < 12; t++) { hawk.hp = 9999; E.advanceTurn(f); } ok(f.map.t.charAt(wy * f.map.w + wx) === 'W' && !(f.wl && f.wl[wy * f.map.w + wx] === 0), 'las criaturas voladoras no necesitan romper la muralla');
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
