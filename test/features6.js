'use strict';
// Pruebas de: mundo abierto fase 2 (regiones, protección, jefe mundial, gremios) (v1.44)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
function mkw(opts = {}) { const g = E.createGame('MW6', 'Host', 't'); g.cfg.mode = 'mundo'; g.cfg.worldSize = 'grande'; Object.assign(g.cfg, opts); const r = E.startGame(g); if (r) throw new Error(r); return g; }
const turns = (g, n) => { for (let i = 0; i < n; i++) { for (const p of g.players) p.ready = true; E.advanceTurn(g); } };

console.log('Regiones por peligro');
{
  const g = mkw(); const R = S.WORLD.regions;
  ok(R.length === 3 && R[0].lv < R[1].lv && R[1].lv < R[2].lv && R[0].loot < R[2].loot, 'tres regiones con peligro y botín crecientes');
  const sn = E.snapshot(g, 0); ok(sn.cfg.mode === 'mundo' && typeof sn.prot === 'number', 'la instantánea trae la protección');
  const lv = (x, y) => { let mx = 0; for (let i = 0; i < 300; i++) mx = Math.max(mx, E.rndLvTest ? E.rndLvTest(g, 'jabali', x, y) : 0); return mx; };
  const c = g.map.w >> 1; ok(!E.rndLvTest || lv(c, c) < lv(2, 2), 'cerca del centro los monstruos son más débiles');
}

console.log('Protección de novato');
{
  const g = mkw(); const a = g.players[0], b = E.joinWorld(g, 'B', 'tb');
  ok(b && a.prot > g.turn && b.prot > g.turn, 'al llegar al mundo hay protección de novato');
  const ua = g.units.find(u => u.o === 0), ub = g.units.find(u => u.o === b.id);
  ua.x = ub.x - 1; ua.y = ub.y; ua.at = 1;
  let r = E.cmd(g, 0, { a: 'attack', u: ua.id, tt: 'u', id: ub.id });
  ok(r.err && /protecci/i.test(r.err), 'no se puede atacar a un novato protegido: ' + (r.err || ''));
  r = E.cmd(g, b.id, { a: 'endprot' }); ok(!r.err && !E.snapshot(g, b.id).prot, 'se puede terminar la protección');
  r = E.cmd(g, 0, { a: 'attack', u: ua.id, tt: 'u', id: ub.id });
  ok(r.err && /protecci/i.test(r.err), 'el atacante con protección tampoco puede atacar');
  E.cmd(g, 0, { a: 'endprot' }); ua.at = 1; r = E.cmd(g, 0, { a: 'attack', u: ua.id, tt: 'u', id: ub.id });
  ok(!r.err, 'sin protección ambos se pueden atacar: ' + (r.err || ''));
}

console.log('Jefe mundial');
{
  const g = mkw(); const b = E.joinWorld(g, 'B', 'tb');
  turns(g, S.WORLD.wb.first + 1);
  const wb = g.creatures.find(c => c.wb);
  ok(!!wb && wb.lv >= Math.round(S.CREATURES[wb.t].max * 0.8), 'aparece el jefe mundial: ' + (wb && wb.t));
  const sn = E.snapshot(g, 0); ok(sn.wb && sn.wb.t === wb.t && sn.wb.mhp > 0, 'todos conocen su ubicación y vida');
  const d = S.CREATURES[wb.t]; ok(E.cstats(wb, g).mhp >= Math.round(d.hp * 2), 'es mucho más duro que un jefe normal');
  const u = g.units.find(x => x.o === 0); u.x = wb.x - 1; u.y = wb.y; u.at = 1; u.hp = 9999;
  E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: wb.id });
  ok(wb.pt && wb.pt[0] > 0, 'se anota el daño de quien participa');
  const city = g.cities.find(c => c.owner === 0), before = city.st.m.alma || 0;
  wb.pt[b.id] = 50; wb.hp = 1; u.at = 1; u.x = wb.x - 1; u.y = wb.y; E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: wb.id });
  ok(!g.creatures.some(c => c.wb) && (city.st.m.alma || 0) > before, 'al caer, el que participó cobra en su ciudad');
  const cb = g.cities.find(c => c.owner === b.id); ok((cb.st.m.escama || 0) >= 3, 'otro participante también cobra');
  ok(g.wb.next > g.turn, 'el siguiente jefe se programa');
}

console.log('Gremios');
{
  const g = mkw(); const b = E.joinWorld(g, 'B', 'tb'), c = E.joinWorld(g, 'C', 'tc');
  let r = E.cmd(g, 0, { a: 'guild', d: 'create', n: 'Lobos', t: 'lb' });
  ok(!r.err && g.players[0].gd, 'se funda un gremio: ' + (r.err || ''));
  r = E.cmd(g, 0, { a: 'guild', d: 'create', n: 'Otro', t: 'x' }); ok(!!r.err, 'no puedes fundar otro estando en uno');
  r = E.cmd(g, 0, { a: 'guild', d: 'invite', to: b.id }); ok(!r.err, 'el líder invita');
  ok(E.snapshot(g, b.id).ginv.length === 1, 'el invitado ve la invitación');
  r = E.cmd(g, b.id, { a: 'guild', d: 'accept', id: g.players[0].gd });
  ok(!r.err && b.gd === g.players[0].gd, 'acepta y entra: ' + (r.err || ''));
  ok(g.dip && g.dip[[0, b.id].sort((x, y) => x - y).join('-')] === 'alianza', 'los miembros son aliados');
  r = E.cmd(g, b.id, { a: 'guild', d: 'invite', to: c.id }); ok(!!r.err, 'solo el líder invita');
  const sn = E.snapshot(g, 0); ok(sn.gd && sn.gd.m.length === 2 && sn.players[b.id].gt === 'LB', 'la etiqueta se ve en la lista de jugadores');
  const ua = g.units.find(u => u.o === 0), ub = g.units.find(u => u.o === b.id); ua.at = 1; ua.x = ub.x - 1; ua.y = ub.y;
  E.cmd(g, 0, { a: 'endprot' }); E.cmd(g, b.id, { a: 'endprot' });
  r = E.cmd(g, 0, { a: 'attack', u: ua.id, tt: 'u', id: ub.id }); ok(!!r.err, 'los miembros no se atacan');
  r = E.cmd(g, 0, { a: 'guild', d: 'kick', to: b.id }); ok(!r.err && !b.gd, 'el líder expulsa');
  ok(!g.dip[[0, b.id].sort((x, y) => x - y).join('-')], 'se acaba la alianza');
  r = E.cmd(g, b.id, { a: 'guild', d: 'leave' }); ok(!!r.err, 'sin gremio no puedes salir');
  const g2 = E.createGame('XX', 'H', 't'); g2.cfg.mode = 'normal'; E.addBot(g2, 'azar'); E.startGame(g2);
  r = E.cmd(g2, 0, { a: 'guild', d: 'create', n: 'Nada', t: 'nn' }); ok(!!r.err, 'fuera del mundo abierto no hay gremios');
  const rt = E.deserialize(E.serialize(g)); ok(rt.guilds && rt.guilds.length === 1 && rt.players[0].gd, 'los gremios se guardan y recuperan');
}
console.log(fails ? `\n${fails} fallos` : '\nTodo bien');
process.exit(fails ? 1 : 0);
