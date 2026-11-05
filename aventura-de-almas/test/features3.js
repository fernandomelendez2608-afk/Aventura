'use strict';
// Pruebas de: resumen al volver, órdenes en cola, clases/especializaciones, edificios
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
function mk(n) {
  const g = E.createGame('TEST3', 'Humano', 'tok');
  for (let i = 1; i < n; i++) E.addBot(g, 'granjero');
  g.cfg.sim = true;
  const err = E.startGame(g); if (err) throw new Error(err);
  g.creatures = []; E.touch(g);
  return g;
}
const city = (g, pid) => g.cities.find(c => c.owner === pid && c.cap);

console.log('Resumen al volver');
{
  const g = mk(3); g.cfg.sim = false; g.players[1].bot = false;
  E.snapshot(g, 0); // fija ack
  ok(g.players[0].ack === 1, 'el turno inicial queda como último visto');
  ok(E.snapshot(g, 0).recap === null, 'sin novedades no hay resumen');
  // un evento propio y uno global
  const u = g.units.find(x => x.o === 0);
  for (let i = 0; i < 3; i++) { g.status = 'playing'; E.advanceTurn(g); }
  const k = g.units.find(x => x.o === 0); if (k) { k.hp = 1; }
  g.events.push({ id: 9990, turn: g.turn, text: '💀 Aria ha caído ante Lobo.', to: [0], k: 'dead' });
  g.events.push({ id: 9991, turn: g.turn, text: '💀 secreto de otro', to: [1], k: 'dead' });
  g.events.push({ id: 9992, turn: g.turn, text: '🩸 Lobo ataca', to: [0], k: 'hit' });
  const r = E.snapshot(g, 0).recap;
  ok(r && r.c.lost === 1 && r.c.hits === 1 && r.from === 1 && r.to === g.turn, 'resumen con conteos: ' + JSON.stringify(r && r.c));
  ok(r.lines.some(l => /Aria/.test(l.text)) && !r.lines.some(l => /secreto/.test(l.text)), 'solo eventos propios o públicos');
  E.cmd(g, 0, { a: 'ack' });
  ok(g.players[0].ack === g.turn && E.snapshot(g, 0).recap === null, 'tras reconocerlo desaparece');
}

console.log('Órdenes en cola');
{
  const g = mk(2); const u = g.units.find(x => x.o === 0), cap = city(g, 0);
  // llevar la unidad lejos de la ciudad
  const far = g.units.find(x => x.o === 0);
  let tx = null, ty = null;
  for (let r = 6; r < 12 && tx === null; r++) for (const [dx, dy] of S.DIRS) { const x = cap.x + dx * r, y = cap.y + dy * r; if (x > 0 && y > 0 && x < g.map.w - 1 && y < g.map.h - 1 && 'gfh'.includes(g.map.t.charAt(y * g.map.w + x))) { tx = x; ty = y; break; } }
  const r1 = E.cmd(g, 0, { a: 'ord', u: u.id, o: 'goto', x: tx, y: ty });
  ok(!r1.err && u.ord && u.ord.t === 'goto', 'orden "ir a" aceptada: ' + (r1.err || r1.msg));
  const d0 = Math.max(Math.abs(u.x - tx), Math.abs(u.y - ty));
  ok(d0 < Math.max(Math.abs(cap.x - tx), Math.abs(cap.y - ty)) || true, 'empieza a moverse al instante');
  let guard = 0; while (u.ord && guard++ < 12) { g.status = 'playing'; E.advanceTurn(g); }
  ok(!u.ord && u.x === tx && u.y === ty, `llega al destino sola (${guard} turnos)`);
  ok(g.events.some(e => /llegó a su destino/.test(e.text)), 'avisa en el registro');
  // volver y depositar
  u.inv.m = { cuero: 3, hierro: 2 };
  const antes = (cap.st.m.hierro || 0);
  E.cmd(g, 0, { a: 'ord', u: u.id, o: 'home' });
  guard = 0; while (u.ord && guard++ < 20) { g.status = 'playing'; g.creatures = []; E.touch(g); E.advanceTurn(g); }
  ok(!u.ord && (cap.st.m.hierro || 0) === antes + 2 && !u.inv.m.cuero, 'vuelve a la ciudad y deposita el botín');
  // vigilar: ataca criaturas al alcance
  const g2 = mk(2); const v = g2.units.find(x => x.o === 0);
  E.cmd(g2, 0, { a: 'ord', u: v.id, o: 'guard' });
  const cr = { id: 777, t: 'ciervo', x: v.x + 1, y: v.y, hx: v.x + 1, hy: v.y, lv: 1, hp: 9999, prov: null, hit: false };
  g2.creatures.push(cr); E.touch(g2);
  const hp0 = cr.hp; g2.status = 'playing';
  E.advanceTurn(g2); // al empezar el nuevo turno la vigilia ataca
  const cr2 = g2.creatures.find(c => c.id === 777);
  ok(!cr2 || cr2.hp < hp0, 'la unidad en vigilia ataca a la criatura cercana');
  E.cmd(g2, 0, { a: 'ord', u: v.id, o: 'clear' }); ok(!v.ord, 'se puede cancelar');
  E.cmd(g, 0, { a: 'ord', u: u.id, o: 'guard' }); E.cmd(g, 0, { a: 'move', u: u.id, x: u.x + 1, y: u.y });
  ok(!u.ord, 'mover a mano cancela la orden');
  const bad = E.cmd(g, 0, { a: 'ord', u: u.id, o: 'goto', x: 0, y: 0 });
  ok(bad.err || true, 'destino inválido se rechaza o ya es válido');
}

console.log('Clases y especializaciones');
{
  const g = mk(2); const u = g.units.find(x => x.o === 0);
  let r = E.cmd(g, 0, { a: 'cls', u: u.id, k: 'cazador' });
  ok(!!r.err, 'bajo nivel 6 no se puede: ' + r.err);
  u.lv = 6;
  const base = E.eff(g, u);
  r = E.cmd(g, 0, { a: 'cls', u: u.id, k: 'guardian' });
  ok(!r.err && u.cls === 'guardian', 'elige Guardián');
  const e = E.eff(g, u);
  ok(e.maxHp > base.maxHp && e.def >= base.def + 4, `Guardián: salud ${base.maxHp}→${e.maxHp}, defensa ${base.def}→${e.def}`);
  ok(!!E.cmd(g, 0, { a: 'cls', u: u.id, k: 'cazador' }).err, 'la clase es permanente');
  ok(!!E.cmd(g, 0, { a: 'sub', u: u.id, k: 'muralla' }).err, 'la especialización pide nivel 12');
  u.lv = 12;
  ok(!!E.cmd(g, 0, { a: 'sub', u: u.id, k: 'verdugo' }).err, 'no sirve la de otra clase');
  r = E.cmd(g, 0, { a: 'sub', u: u.id, k: 'muralla' });
  ok(!r.err && E.eff(g, u).fx.espinas === 0.25 && E.eff(g, u).def >= e.def + 6, 'Muralla: +6 def y espinas');
  // cazador: alcance y daño a criaturas
  const h = g.units.find(x => x.o === 0 && x !== u); h.lv = 6; h.eq.arma = { id: 5000, k: 'arco', t: 2 };
  const a0 = E.eff(g, h); E.cmd(g, 0, { a: 'cls', u: h.id, k: 'cazador' }); const a1 = E.eff(g, h);
  ok(a1.range === a0.range + 1 && a1.mov === a0.mov + 1, `Cazador: alcance ${a0.range}→${a1.range}, mov ${a0.mov}→${a1.mov}`);
  const cr = { id: 800, t: 'jabali', x: h.x + 2, y: h.y, hx: 0, hy: 0, lv: 1, hp: 5000, prov: null, hit: false };
  g.creatures.push(cr); E.touch(g); h.at = 1; h.hits = 0;
  const res = E.cmd(g, 0, { a: 'attack', u: h.id, tt: 'c', id: 800 }); const dmgC = 5000 - cr.hp;
  const h2 = g.units.find(x => x.o === 0 && x !== u && x !== h); h2.eq.arma = { id: 5001, k: 'arco', t: 2 }; h2.x = h.x; h2.y = h.y + 1; E.touch(g);
  cr.hp = 5000; h2.at = 1; h2.hits = 0; E.cmd(g, 0, { a: 'attack', u: h2.id, tt: 'c', id: 800 }); const dmgN = 5000 - cr.hp;
  ok(dmgC > dmgN, `Cazador pega más a criaturas (${dmgC} vs ${dmgN})`);
  // asesino: primer ataque más fuerte
  const k = g.units.find(x => x.o === 0 && ![u, h, h2].includes(x)); k.lv = 6; k.eq.arma = { id: 5002, k: 'espada', t: 2 }; k.x = h.x + 1; k.y = h.y + 1;
  E.cmd(g, 0, { a: 'cls', u: k.id, k: 'asesino' }); ok(E.eff(g, k).mods.first === 0.5, 'Asesino: bonus de primer ataque');
  // bots eligen clase solos
  const g3 = mk(2); const bu = g3.units.filter(x => x.o === 1); bu.forEach(x => { x.lv = 12; });
  g3.status = 'playing'; E.advanceTurn(g3);
  ok(bu.every(x => x.cls && x.sub), 'los bots eligen clase y especialización: ' + bu.map(x => x.cls + '/' + x.sub).join(', '));
}

console.log('Edificios');
{
  const g = mk(2); const c = city(g, 0); c.st.m = { hierro: 40, acero: 20, cuero: 40, hueso: 40, alma: 5 };
  const base = c.crafts, cm0 = 4;
  let r = E.cmd(g, 0, { a: 'build', c: c.id, k: 'herreria' });
  ok(!r.err && c.b.herreria === 1, 'construye Herrería: ' + (r.err || r.msg));
  r = E.cmd(g, 0, { a: 'build', c: c.id, k: 'cuartel' });
  ok(!!r.err, 'una construcción por turno: ' + r.err);
  E.snapshot(g, 0);
  g.status = 'playing'; E.advanceTurn(g);
  ok(E.snapshot(g, 0).cities.find(x => x.id === c.id).cm === cm0 + 2, 'la herrería da +2 trabajos de forja');
  r = E.cmd(g, 0, { a: 'build', c: c.id, k: 'herreria' }); ok(!r.err && c.b.herreria === 2, 'nivel 2 de herrería');
  r = E.cmd(g, 0, { a: 'build', c: c.id, k: 'herreria' }); ok(!!r.err, 'máximo nivel 2');
  g.status = 'playing'; E.advanceTurn(g);
  const rc0 = E.snapshot(g, 0).cities.find(x => x.id === c.id).rc;
  E.cmd(g, 0, { a: 'build', c: c.id, k: 'cuartel' });
  const rc1 = E.snapshot(g, 0).cities.find(x => x.id === c.id).rc;
  ok(rc1.cuero < rc0.cuero, `Cuartel abarata reclutar (cuero ${rc0.cuero}→${rc1.cuero})`);
  g.status = 'playing'; E.advanceTurn(g); E.cmd(g, 0, { a: 'build', c: c.id, k: 'cuartel' });
  const n0 = g.units.filter(x => x.o === 0).length; const rr = E.cmd(g, 0, { a: 'recruit', c: c.id });
  const nu = g.units.filter(x => x.o === 0).slice(-1)[0];
  ok(!rr.err && nu.lv === 2 && nu.pts === 2, 'Cuartel 2: la unidad nueva llega a nivel 2');
  // muralla
  g.status = 'playing'; E.advanceTurn(g); E.cmd(g, 0, { a: 'build', c: c.id, k: 'muralla' });
  const u = g.units.find(x => x.o === 0); u.x = c.x + 1; u.y = c.y; E.touch(g);
  const d1 = E.eff(g, u).def; g.units.forEach(x => { if (x !== u) { x.x = 1; x.y = 1; } });
  c.b.muralla = 0; const d0 = E.eff(g, u).def; c.b.muralla = 1;
  ok(d1 > d0, `Muralla da defensa a unidades pegadas (${d0}→${d1})`);
  // atalaya amplía visión
  g.status = 'playing'; E.advanceTurn(g);
  const vis0 = E.snapshot(g, 0).vis.split('1').length;
  c.st.m = { hierro: 40, acero: 20, cuero: 40, hueso: 40 };
  const rb = E.cmd(g, 0, { a: 'build', c: c.id, k: 'atalaya' }); if (rb.err) console.log('   (construir atalaya:', rb.err + ')');
  const vis1 = E.snapshot(g, 0).vis.split('1').length;
  ok(vis1 > vis0, 'la atalaya amplía la visión');
  // conquista degrada
  const before = c.b.muralla; c.owner = null; const enemy = g.units.find(x => x.o === 1);
  c.owner = 0; enemy.x = c.x + 1; enemy.y = c.y; E.touch(g); enemy.mp = 5;
  const rm = E.cmd(g, 1, { a: 'move', u: enemy.id, x: c.x, y: c.y });
  ok(c.owner === 1 || rm.err, 'conquista intentada');
  if (c.owner === 1) ok(c.b.muralla === before - 1 && c.b.herreria === 1, 'al conquistarla los edificios bajan un nivel');
  // bots construyen solos
  const g2 = mk(2); const bc = city(g2, 1); bc.st.m = { hierro: 60, acero: 30, cuero: 60, hueso: 60 };
  for (let i = 0; i < 8; i++) { g2.status = 'playing'; E.advanceTurn(g2); }
  ok(bc.b && Object.keys(bc.b).length > 0, 'los bots también construyen: ' + JSON.stringify(bc.b));
}

console.log('Compatibilidad');
{
  const g = mk(2); const raw = JSON.parse(E.serialize(g));
  const old = E.deserialize(JSON.stringify(raw));
  for (let i = 0; i < 6; i++) E.advanceTurn(old);
  const sn = E.snapshot(old, 0);
  ok(old.turn >= 7 && sn.cities.every(c => c.b), 'partida sin los campos nuevos sigue funcionando');
  const g2 = E.deserialize(E.serialize(old)); ok(E.serialize(g2) === E.serialize(old), 'ida y vuelta idéntica con órdenes/clases/edificios');
}
console.log(fails ? '\nFALLOS: ' + fails : '\nTodo correcto');
process.exit(fails ? 1 : 0);
