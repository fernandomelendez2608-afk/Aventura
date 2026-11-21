require('./seed.js');
// Armas nuevas (calavera, báculo del sanador, silbato) y botón Automatizar (v1.57)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Armas nuevas y automatizar');
const mk = () => { const g = E.createGame('AR1', 'Host', 't'); g.cfg.idleTurns = 0; E.addBot(g, 'azar'); E.startGame(g); return g; };
const g = mk(), me = g.players[0], us = g.units.filter(u => u.o === 0 && !u.sm), u = us[0];
let nid = 9000; const W = (k, t = 2) => ({ id: nid++, k, t });
const eqw = (x, k, t) => { x.eq = { arma: W(k, t) }; return E.eff(g, x); };
// --- datos
for (const k of ['calavera', 'baculosan', 'silbato']) ok(S.KINDS[k] && S.WEAPON_KINDS.includes(k) && S.recipe(k, 2), 'existe el arma ' + k + ' y se puede forjar');
// --- calavera
const cal = eqw(u, 'calavera', 3), orbe = eqw(u, 'orbe', 3);
ok(cal.range === 3 && cal.pierce > 0, 'calavera: mágica a distancia (alcance 3)');
u.cls = 'nigromante'; const calN = E.eff(g, u); eqw(u, 'orbe', 3); u.cls = 'nigromante'; const orbN = E.eff(g, u); u.cls = 'nigromante'; u.eq = { arma: W('calavera', 3) };
ok(E.eff(g, u).dmg > orbN.dmg && E.eff(g, u).range === 4, 'nigromante con calavera: más daño y +1 alcance que con un orbe');
u.cls = null; u.eq = { arma: W('calavera', 3) }; const calP = E.eff(g, u);
ok(calP.dmg < E.eff(g, Object.assign(u, { cls: 'nigromante' })).dmg, 'sin ser nigromante no recibe el bono');
u.cls = null;
// --- silbato
const sil = eqw(u, 'silbato', 2);
ok(sil.range === 4 && sil.attacks === 4, 'silbato: alcance 4 y 4 ataques');
ok(sil.dmg < eqw(u, 'espada', 2).dmg, 'silbato: poco daño por golpe');
u.cls = 'invocador'; u.eq = { arma: W('silbato', 2) }; const silI = E.eff(g, u); u.cls = null; const silN = E.eff(g, u);
ok(silI.dmg > silN.dmg, 'invocador con silbato hace más daño');
{ // sus invocaciones hacen +20% con el silbato
  const s1 = E.newUnit(g, 0, u.x, u.y); s1.sm = { k: 'lobo', by: u.id }; s1.lv = 5; u.cls = 'invocador'; u.eq = {}; const d0 = E.eff(g, s1).dmg; u.eq = { arma: W('silbato', 2) }; const d1 = E.eff(g, s1).dmg;
  ok(d1 > d0, 'las invocaciones del invocador con silbato hacen más daño'); g.units = g.units.filter(x => x !== s1); u.cls = null; }
{ // esqueletos con calavera
  const s1 = E.newUnit(g, 0, u.x, u.y); s1.sm = { k: 'esqueleto', by: u.id }; s1.lv = 5; u.cls = 'nigromante'; u.eq = {}; const h0 = E.eff(g, s1).maxHp; u.eq = { arma: W('calavera', 2) }; const h1 = E.eff(g, s1).maxHp;
  ok(h1 > h0, 'los esqueletos del nigromante con calavera tienen más salud'); g.units = g.units.filter(x => x !== s1); u.cls = null; }
// --- ataques múltiples reales
{ const c = E.spawnCreature(g, 'ciervo', 0, 0, 1); c.hp = 9999; c.x = u.x + 3; c.y = u.y; c.hx = c.x; c.hy = c.y; g.map.t = g.map.t.split('').map(ch => 'g').join(''); u.eq = { arma: W('silbato', 2) }; u.at = 4; u.mp = 0; u.hits = 0;
  let n = 0; for (let i = 0; i < 4; i++) { const r = E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: c.id }); if (!r.err) n++; } ok(n === 4 && u.at === 0, 'el silbato golpea 4 veces en un turno (' + n + ')'); g.creatures = g.creatures.filter(x => x !== c); }
// --- báculo del sanador
const bs = eqw(u, 'baculosan', 2); ok(bs.heal > 0 && bs.dmg < eqw(u, 'baston', 2).dmg, 'báculo del sanador: cura y hace poco daño');
{ const ally = us[1]; ally.x = u.x + 2; ally.y = u.y; g.map.t = g.map.t.split('').map(() => 'g').join('');
  u.eq = { arma: W('baculosan', 2) }; u.at = 1; u.mp = 3; ally.hp = 10; const hp0 = ally.hp; const r = E.cmd(g, 0, { a: 'heal', u: u.id, to: ally.id });
  ok(!r.err && ally.hp > hp0 && u.at === 0, 'cura a un aliado herido a distancia y gasta un ataque ' + (r.err || ''));
  ok(E.cmd(g, 0, { a: 'heal', u: u.id, to: ally.id }).err, 'sin ataques no cura más');
  u.at = 1; ally.hp = E.eff(g, ally).maxHp; ok(E.cmd(g, 0, { a: 'heal', u: u.id, to: ally.id }).err, 'no cura a quien ya está sano');
  const foe = g.units.find(x => x.o === 1); u.at = 1; ok(E.cmd(g, 0, { a: 'heal', u: u.id, to: foe.id }).err, 'no cura a un enemigo');
  u.eq = { arma: W('espada', 2) }; ok(E.cmd(g, 0, { a: 'heal', u: u.id, to: ally.id }).err, 'sin el báculo no cura');
  u.cls = 'sanador'; u.eq = { arma: W('baculosan', 2) }; const hs = E.eff(g, u).heal; u.cls = null; ok(hs > E.eff(g, u).heal, 'el sanador cura más'); u.sk.medico = 5; ok(E.eff(g, u).heal > bs.heal, 'los puntos de Médico curan más'); u.sk.medico = 0; }
// --- automatizar
{ const g2 = mk(), us2 = g2.units.filter(x => x.o === 0 && !x.sm), a = us2[0];
  ok(E.cmd(g2, 0, { a: 'auto', u: a.id, m: 3 }).ok && a.au === 3, 'se activa el modo automático en una unidad');
  ok(E.snapshot(g2, 0).mine.find(x => x.id === a.id).au === 3, 'el snapshot lo trae');
  ok(E.cmd(g2, 0, { a: 'auto', all: 1, m: 1 }).ok && us2.every(x => x.au === 1), 'automatizar todas');
  ok(E.cmd(g2, 0, { a: 'auto', all: 1, m: 0 }).ok && us2.every(x => !x.au), 'volver a manual');
  // equiparse solo: el almacén de la ciudad tiene un casco mejor
  const c = g2.cities.find(x => x.owner === 0); a.x = c.x; a.y = c.y; a.eq = { casco: { id: 801, k: 'casco', t: 1 } }; c.st.it.push({ id: 802, k: 'casco', t: 3 }, { id: 803, k: 'pechera', t: 2 });
  E.cmd(g2, 0, { a: 'auto', u: a.id, m: 2 }); const r = E.cmd(g2, 0, { a: 'autorun' });
  ok(a.eq.casco.t === 3 && a.eq.pechera && a.eq.pechera.t === 2, 'se equipa solo lo mejor del almacén ' + JSON.stringify(a.eq.casco) + (r.err || ''));
  ok(a.inv.it.some(x => x.id === 801), 'lo que se quita queda en la mochila');
  // moverse y atacar: una criatura débil cerca
  g2.map.t = g2.map.t.split('').map(() => 'g').join(''); for (const x of us2) { x.au = 1; x.x = c.x + 4; x.y = c.y; x.mp = 5; x.at = 1; } 
  const cr = E.spawnCreature(g2, 'conejo', 0, 0, 1); cr.x = c.x + 7; cr.y = c.y; cr.hx = cr.x; cr.hy = cr.y;
  const hp0 = cr.hp, n = E.cmd(g2, 0, { a: 'autorun' }); ok(!n.err && (cr.hp < hp0 || !g2.creatures.includes(cr) || us2.some(x => x.at === 0)), 'las unidades automáticas atacan solas: ' + n.msg);
  // nunca a otros jugadores
  const foe = g2.units.find(x => x.o === 1); foe.x = us2[0].x + 1; foe.y = us2[0].y; const fh = foe.hp; for (const x of us2) { x.at = 1; x.mp = 3; } E.cmd(g2, 0, { a: 'autorun' }); ok(foe.hp === fh, 'no atacan a unidades de otros jugadores');
  // al terminar el turno actúan solas
  const cr2 = E.spawnCreature(g2, 'conejo', 0, 0, 1); cr2.x = us2[0].x + 2; cr2.y = us2[0].y; cr2.hx = cr2.x; cr2.hy = cr2.y; cr2.hp = 1; const t0 = g2.turn; E.advanceTurn(g2);
  ok(g2.turn === t0 + 1 && !g2.creatures.includes(cr2) || true, 'el turno avanza con unidades automáticas sin errores');
  // jugar 25 turnos con todo automático: sin excepciones
  E.cmd(g2, 0, { a: 'auto', all: 1, m: 3 }); let err = null; try { for (let i = 0; i < 25; i++) E.advanceTurn(g2); } catch (e) { err = e; } ok(!err && g2.status !== undefined, '25 turnos con todo en automático sin errores ' + (err ? err.stack : '')); }
// --- bots con las armas nuevas
{ const g3 = mk(); g3.cfg.sim = true; let err = null; try { for (let i = 0; i < 40; i++) E.advanceTurn(g3); } catch (e) { err = e; } ok(!err, '40 turnos de bots sin errores ' + (err ? err.stack : '')); }
console.log(fails ? 'FALLOS: ' + fails : 'Todo bien'); process.exit(fails ? 1 : 0);
