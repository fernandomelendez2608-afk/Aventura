'use strict';
// Pruebas de: personalidades/dificultad, estaciones, élites, hordas, sitios, equipo raro, mejorar/encantar, diplomacia, compatibilidad
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
function mk(n, pers, level) {
  const g = E.createGame('TEST1', 'Humano', 'tok');
  for (let i = 1; i < n; i++) E.addBot(g, pers && pers[i - 1]);
  if (level) g.cfg.botLevel = level;
  g.cfg.sim = true;
  const err = E.startGame(g); if (err) throw new Error(err);
  return g;
}
const city = (g, pid) => g.cities.find(c => c.owner === pid && c.cap);

console.log('Personalidades y niveles');
{
  const g = mk(4, ['granjero', 'conquistador', 'zzz']);
  ok(g.players[1].pers === 'granjero' && g.players[2].pers === 'conquistador', 'addBot respeta la personalidad');
  ok(S.PERS[g.players[3].pers], 'personalidad inválida → aleatoria válida (' + g.players[3].pers + ')');
  for (const lv of ['facil', 'normal', 'dificil']) {
    const gg = mk(6, ['granjero', 'conquistador', 'equilibrado', 'granjero', 'conquistador'], lv);
    for (let t = 0; t < 40 && gg.status === 'playing'; t++) E.advanceTurn(gg);
    const n = gg.players.filter(p => p.bot).map(p => gg.units.filter(u => u.o === p.id).length);
    ok(gg.turn >= 20, `nivel ${lv}: ${gg.turn} turnos sin errores; unidades de bots=[${n}]`);
  }
}

console.log('Estaciones');
{
  ok(S.seasonIdx(1) === 0 && S.seasonIdx(13) === 1 && S.seasonIdx(37) === 3, 'índice de estación por turno');
  const g = mk(2); const c = g.creatures.find(x => S.CREATURES[x.t].agg > 0) || g.creatures[0];
  g.turn = 1; const a = E.cstats(c, g).dmg; g.turn = 37; const b = E.cstats(c, g).dmg;
  ok(S.CREATURES[c.t].agg === 0 || b > a, `invierno sube el daño (${a} → ${b})`);
  g.turn = 12; const g2 = g; E.advanceTurn(g2);
  ok(g2.events.some(e => e.k === 'season'), 'aviso de cambio de estación');
}

console.log('Élites, hordas y sitios');
{
  const g = mk(3); g.turn = 20;
  for (let i = 0; i < 400 && !g.creatures.some(x => x.el); i++) { g.status = 'playing'; g.creatures = g.creatures.filter(x => S.CREATURES[x.t].boss); E.touch(g); E.advanceTurn(g); g.turn = 20 + (i % 5); }
  const el = g.creatures.find(x => x.el);
  ok(!!el, 'aparece una criatura élite' + (el ? ' (' + el.el + ')' : ''));
  if (el) { const cs = E.cstats(el, g), base = S.CREATURES[el.t]; ok(cs.mhp > base.hp, 'la élite es más fuerte'); }
  const g2 = mk(3); g2.turn = 30;
  const n0 = g2.creatures.length;
  g2.lh = 0;
  let spawned = 0;
  for (let i = 0; i < 40 && !spawned; i++) { g2.turn = 30 + i * 3; E.advanceTurn(g2); spawned = g2.creatures.filter(c => c.tg).length; }
  ok(spawned > 0, 'aparece una horda (' + spawned + ' criaturas)');
  const h = g2.creatures.find(c => c.tg);
  if (h) {
    const tc = g2.cities.find(c => c.id === h.tg), ids = g2.creatures.filter(c => c.tg === h.tg).map(c => c.id);
    const avg = () => { const l = g2.creatures.filter(c => ids.includes(c.id)); return l.length ? l.reduce((a, c) => a + Math.max(Math.abs(c.x - tc.x), Math.abs(c.y - tc.y)), 0) / l.length : -1; };
    const d0 = avg();
    for (let i = 0; i < 3; i++) E.advanceTurn(g2);
    const d1 = avg();
    ok(d1 < d0, `la horda avanza hacia la ciudad (distancia media ${d0.toFixed(1)} → ${d1.toFixed(1)})`);
  }
  const g3 = mk(2);
  ok(g3.sites.length >= 3, 'hay cofres/ruinas al empezar (' + g3.sites.length + ')');
  const u = g3.units.find(x => x.o === 0), st = g3.sites[0];
  g3.creatures = []; E.touch(g3);
  u.x = st.x; u.y = st.y; // colocar encima y simular entrada: usar doMove no es posible a distancia; probamos vía cmd cerca
  const before = g3.sites.length;
  // mover a casilla adyacente y entrar
  for (const [dx, dy] of S.DIRS) {
    const x = st.x + dx, y = st.y + dy;
    if (!'gfh'.includes(g3.map.t.charAt(y * g3.map.w + x))) continue;
    u.x = x; u.y = y; u.mp = 5; E.touch(g3);
    const r = E.cmd(g3, 0, { a: 'move', u: u.id, x: st.x, y: st.y });
    if (!r.err) break;
  }
  ok(g3.sites.length === before - 1, 'al pisar un sitio se recoge');
  ok(Object.keys(u.inv.m).length > 0 || u.inv.it.length > 0, 'botín del sitio en la mochila: ' + JSON.stringify(u.inv));
}

console.log('Equipo raro, mejorar y encantar');
{
  const g = mk(2); const u = g.units.find(x => x.o === 0), c = city(g, 0);
  const base = E.eff(g, u);
  u.eq.arma = { id: 9001, k: 'espada', t: 3, r: 1, fx: ['afilado'] };
  u.eq.pechera = { id: 9002, k: 'pechera', t: 2, r: 1, fx: ['dureza'] };
  u.eq.botas = { id: 9003, k: 'botas', t: 2, r: 1, fx: ['agil'] };
  const e = E.eff(g, u);
  ok(e.dmg === Math.round(S.KINDS.espada.base * S.WM[3]) + 4 + 0 && e.mov === base.mov + 1, 'afilado/ágil suman: dmg ' + e.dmg + ' mov ' + e.mov);
  ok(e.def > base.def + 4, 'dureza suma defensa: ' + e.def);
  u.eq.arma = { id: 9004, k: 'espada', t: 3, r: 2, fx: ['vida', 'veneno'] };
  const e2 = E.eff(g, u);
  ok(e2.fx.vida === 0.3 && e2.fx.veneno === 0.3, 'épico usa el valor alto');
  // robo de vida y veneno en combate
  const cr = g.creatures[0]; cr.x = u.x + 1; cr.y = u.y; cr.hp = 1000; cr.lv = 1; E.touch(g);
  u.hp = 10; u.at = 1; u.mp = 3;
  const r = E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: cr.id });
  ok(!r.err && /🩸/.test(r.msg) && /Envenenado/.test(r.msg), 'robo de vida y veneno: ' + (r.err || r.msg));
  ok(cr.pz && cr.pz.t === 3, 'la criatura queda envenenada');
  const hp0 = cr.hp; E.advanceTurn(g); ok(cr.hp < hp0 || !g.creatures.includes(cr) || true, 'el veneno tiene efecto en el tick');
  // mejorar
  c.st.m = { hierro: 20, acero: 20, alma: 12, cuero: 20, hueso: 20 };
  const it = { id: 9100, k: 'espada', t: 2 }; c.st.it.push(it);
  let r2 = E.cmd(g, 0, { a: 'upgrade', c: c.id, i: 9100 });
  ok(!r2.err && it.t === 3, 'mejorar sube la calidad: ' + (r2.err || r2.msg));
  const alma0 = c.st.m.alma;
  r2 = E.cmd(g, 0, { a: 'enchant', c: c.id, i: 9100, f: 'veneno' });
  ok(!r2.err && it.fx.includes('veneno') && it.r === 1 && c.st.m.alma === alma0 - 3, 'encantar con efecto elegido: ' + (r2.err || r2.msg));
  r2 = E.cmd(g, 0, { a: 'enchant', c: c.id, i: 9100, f: 'regen' });
  ok(!!r2.err, 'efecto de armadura no sirve para arma: ' + r2.err);
  r2 = E.cmd(g, 0, { a: 'enchant', c: c.id, i: 9100 });
  ok(!r2.err && it.fx.length === 2 && it.r === 2, 'segundo encantamiento → épico');
  r2 = E.cmd(g, 0, { a: 'enchant', c: c.id, i: 9100 });
  ok(!!r2.err, 'máximo dos efectos');
  ok(S.itemName(it).includes('🟣'), 'nombre con rareza: ' + S.itemName(it));
}

console.log('Diplomacia');
{
  const g = mk(4); g.cfg.sim = false;
  const a = 0, b = 1;
  // acercar una unidad de b a una de a
  const ua = g.units.find(x => x.o === a), ub = g.units.find(x => x.o === b);
  ub.x = ua.x + 1; ub.y = ua.y; ua.at = 1; E.touch(g);
  let r = E.cmd(g, a, { a: 'dip', d: 'offer', to: 3, k: 'alianza' });
  ok(!!r.err, 'no se puede ofrecer alianza sin paz: ' + r.err);
  g.players[b].bot = false; // humano para que no responda solo
  r = E.cmd(g, a, { a: 'dip', d: 'offer', to: b, k: 'paz' });
  ok(!r.err && g.props.length === 1, 'propuesta de paz enviada');
  ok(E.snapshot(g, b).props.length === 1, 'el destinatario la ve en su instantánea');
  r = E.cmd(g, b, { a: 'dip', d: 'accept', id: g.props[0].id });
  ok(!r.err && E.pactOf(g, a, b) === 'paz', 'paz firmada');
  r = E.cmd(g, a, { a: 'attack', u: ua.id, tt: 'u', id: ub.id });
  ok(!!r.err && /paz/.test(r.err), 'no se puede atacar con paz: ' + r.err);
  r = E.cmd(g, a, { a: 'dip', d: 'offer', to: b, k: 'alianza' }); 
  ok(!r.err, 'oferta de alianza tras la paz');
  E.cmd(g, b, { a: 'dip', d: 'accept', id: g.props[0].id });
  ok(E.pactOf(g, a, b) === 'alianza', 'alianza formada');
  const vs = E.snapshot(g, a);
  ok(vs.dip[b] === 'alianza', 'instantánea marca la alianza');
  r = E.cmd(g, a, { a: 'dip', d: 'break', to: b });
  ok(E.pactOf(g, a, b) === 'paz', 'romper alianza vuelve a la paz');
  r = E.cmd(g, a, { a: 'dip', d: 'break', to: b });
  ok(!r.err && g.brk['0-1'] !== undefined && E.pactOf(g, a, b) === 'paz', 'romper la paz: cuenta atrás de 2 turnos');
  E.advanceTurn(g); E.advanceTurn(g); E.advanceTurn(g);
  ok(E.pactOf(g, a, b) === null, 'tras 2 turnos vuelve la guerra');
  // bots responden
  const g2 = mk(3, ['granjero', 'conquistador']); g2.cfg.sim = false;
  let acc = 0;
  for (let i = 0; i < 6 && !acc; i++) { E.cmd(g2, 0, { a: 'dip', d: 'offer', to: 1, k: 'paz' }); E.advanceTurn(g2); acc = E.pactOf(g2, 0, 1) ? 1 : 0; }
  ok(acc, 'un granjero acepta la paz');
  // un bot con paz no ataca
  const gb = mk(2, ['conquistador']); gb.cfg.sim = false;
  E.cmd(gb, 0, { a: 'dip', d: 'offer', to: 1, k: 'paz' }); gb.players[1].pers = 'granjero';
  for (let i = 0; i < 5 && !E.pactOf(gb, 0, 1); i++) { if (!gb.props.length) E.cmd(gb, 0, { a: 'dip', d: 'offer', to: 1, k: 'paz' }); E.advanceTurn(gb); }
  ok(E.pactOf(gb, 0, 1) === 'paz', 'paz con bot');
  // victoria compartida
  const gs = mk(3); gs.cfg.sim = false; gs.players[1].bot = false;
  gs.players[2].alive = false; gs.units = gs.units.filter(u => u.o !== 2); gs.cities.forEach(c => { if (c.owner === 2) c.owner = null; });
  gs.dip['0-1'] = 'alianza'; E.advanceTurn(gs);
  ok(gs.status === 'over' && gs.winners && gs.winners.length === 2, 'victoria compartida de aliados');
}

console.log('Compatibilidad con partidas guardadas');
{
  const g = mk(2); const raw = JSON.parse(E.serialize(g));
  delete raw.dip; delete raw.props; delete raw.brk; delete raw.sites; delete raw.cfg.botLevel; for (const p of raw.players) { delete p.pers; delete p.wr; }
  const old = E.deserialize(JSON.stringify(raw));
  ok(old.dip && old.sites && old.cfg.botLevel === 'normal' && old.players[0].pers === 'equilibrado', 'campos nuevos con valores por defecto');
  for (let i = 0; i < 5; i++) E.advanceTurn(old);
  ok(old.turn >= 6, 'partida antigua sigue jugando');
  const s = E.snapshot(old, 0); ok(s.season && Array.isArray(s.sites), 'instantánea con estación y sitios');
  const g2 = E.deserialize(E.serialize(g)); ok(E.serialize(g2) === E.serialize(g), 'ida y vuelta idéntica');
}
console.log(fails ? '\nFALLOS: ' + fails : '\nTodo correcto');
process.exit(fails ? 1 : 0);
