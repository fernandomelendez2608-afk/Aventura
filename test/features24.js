require('./seed.js');
// v1.64: escuadras — retirada y regreso, formación, avisos y comparativa
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Escuadras: reglas, formación y avisos');
const h = E.createGame('SQ24', 'Host', 't'); h.cfg.mode = 'ciudadela'; h.cfg.idleTurns = 0; h.cfg.sim = true; E.addBot(h, 'azar'); E.startGame(h);
const mine = () => h.units.filter(u => u.o === 0 && !u.sm), p0 = h.players[0], us = mine();
E.cmd(h, 0, { a: 'sq', d: 'new', n: 'Muro', ids: us.map(u => u.id) });
E.cmd(h, 0, { a: 'sq', d: 'ord', id: 1, k: 'guard', g: 'S' });
let st = E.snapshot(h, 0).ct.sq[0];
ok(st.rt === 50 && st.rb === 80, 'por defecto: se retiran al 50% y vuelven al 80%');
ok(st.pw > 0 && st.fr + st.bk === st.c, 'la comparativa trae fuerza y formación (' + st.pw + ' de fuerza, ' + st.fr + ' al frente, ' + st.bk + ' atrás)');
E.cmd(h, 0, { a: 'sq', d: 'rule', id: 1, rt: 65, rb: 100 }); ok(p0.sq[0].rt === 65 && p0.sq[0].rb === 100, 'se pueden cambiar las reglas');
E.cmd(h, 0, { a: 'sq', d: 'rule', id: 1, rt: 77 }); ok(p0.sq[0].rt === 65, 'valores no permitidos se ignoran');
// retirada: baja del 50% → se retira y NO vuelve al puesto hasta recuperarse al 100%
const u = us[0], mhp = E.eff(h, u).maxHp; h.creatures = [];
u.hp = Math.round(mhp * 0.4); E.cmd(h, 0, { a: 'sq', d: 'rule', id: 1, rt: 50 }); E.cmd(h, 0, { a: 'sqrun' });
ok(u.rtr === 1, 'por debajo del umbral la unidad se marca como «retirándose»');
ok(E.snapshot(h, 0).ct.sq[0].rtr === 1 && E.snapshot(h, 0).mine.find(x => x.id === u.id).rtr === 1, 'el panel y el perfil lo muestran');
u.hp = Math.round(mhp * 0.8); E.cmd(h, 0, { a: 'sqrun' }); ok(u.rtr === 1, 'al 80% aún no vuelve (su regreso está en 100%)');
u.hp = mhp; E.cmd(h, 0, { a: 'sqrun' }); ok(!u.rtr, 'curada del todo, vuelve a su orden');
E.cmd(h, 0, { a: 'sq', d: 'rule', id: 1, rt: 0 }); u.hp = Math.round(mhp * 0.1); E.cmd(h, 0, { a: 'sqrun' }); ok(!u.rtr, 'con «nunca» no se retira');
// formación: por defecto los de distancia atrás; el jugador puede forzar
const sq = p0.sq[0]; u.hp = mhp;
const melee = us.find(x => E.eff(h, x).range < 2); ok(melee && E.snapshot(h, 0).mine.find(x => x.id === melee.id).e.range < 2, 'hay un cuerpo a cuerpo para comprobar');
E.cmd(h, 0, { a: 'sq', d: 'fm', u: melee.id, v: 'b' }); ok(melee.fm === 'b' && E.snapshot(h, 0).mine.find(x => x.id === melee.id).fm === 'b', 'se puede mandar a retaguardia');
E.cmd(h, 0, { a: 'sq', d: 'fm', u: melee.id, v: 'a' }); ok(!melee.fm, '«Auto» quita la elección');
E.cmd(h, 0, { a: 'sq', d: 'fm', u: melee.id, v: 'x' }); ok(!melee.fm, 'formación no válida = auto');
// la retaguardia se coloca detrás del puesto (hacia la plaza), el frente en el puesto
{ const P = S.CIT.plaza, post = { x: sq.x, y: sq.y }, d0 = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)), at = role => { melee.fm = role; melee.x = post.x; melee.y = post.y; melee.hp = mhp; melee.mp = 6; melee.at = 1; h.creatures = []; E.cmd(h, 0, { a: 'sqrun' }); return { x: melee.x, y: melee.y }; };
  const f = at('f'), b = at('b');
  ok(d0(f, post) <= 1, 'en formación de frente se queda en el puesto');
  ok(d0(b, P) < d0(post, P) && d0(b, post) >= 1, 'en retaguardia se coloca detrás del puesto, hacia la plaza'); }
// avisos
h.events.length = 0; sq.low = 0; for (const x of mine()) x.hp = Math.round(E.eff(h, x).maxHp * 0.3); E.cmd(h, 0, { a: 'sq', d: 'rule', id: 1, rt: 35 }); h.creatures = [];
for (const p of h.players) p.ready = true; E.advanceTurn(h);
const evs = h.events.filter(e => e.to && e.to.includes(0)).map(e => e.text);
ok(evs.some(t => /por debajo de la mitad/.test(t)), 'avisa cuando la escuadra baja de la mitad de salud');
ok(evs.some(t => /se retira/.test(t)), 'avisa cuando unidades se retiran a curarse');
if (fails) { console.log(fails + ' fallos'); process.exit(1); } console.log('OK');
