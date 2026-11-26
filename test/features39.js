require('./seed.js');
// v1.72.0: día y noche + antorcha
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Día y noche y antorcha');
ok(!S.isNight(1) && !S.isNight(80) && S.isNight(81) && S.isNight(100) && !S.isNight(101) && S.isNight(181), 'turnos 1–80 día, 81–100 noche, y se repite');
ok(S.nightLeft(81) === 20 && S.nightLeft(100) === 1 && S.dayLeft(1) === 80 && S.dayLeft(80) === 1, 'cuenta atrás de día y noche');
ok(S.KINDS.antorcha && S.SLOTS.includes('antorcha') && S.GEAR_KINDS.includes('antorcha'), 'la antorcha existe como equipo');
ok(S.torchR({ t: 1 }) === 1 && S.torchR({ t: 3 }) === 2 && S.torchR({ t: 5 }) === 3, 'radio de luz por material');
const mk = (seed, dn) => { const g = E.createGame(seed, 'H', 't'); g.cfg.mode = 'normal'; g.cfg.sim = true; g.cfg.events = 'calma'; if (dn) g.cfg.dn = dn; E.addBot(g, 'azar'); E.startGame(g); return g; };
const g = mk('DN1'); const lobo = E.spawnCreature(g, 'lobo', 10, 10, 3); const gn = mk('DN1', 'no'); const lobo2 = E.spawnCreature(gn, 'lobo', 10, 10, 3);
g.turn = 90; gn.turn = 90; const dDay = E.cstats(lobo2, gn), dNight = E.cstats(lobo, g);
ok(dNight.dmg > dDay.dmg * 1.2 && dNight.def > dDay.def && dNight.mov === dDay.mov + 1 && dNight.agg === dDay.agg + 1, 'de noche las criaturas agresivas son más fuertes (daño ' + dDay.dmg + '→' + dNight.dmg + ')');
g.turn = 50; gn.turn = 50; ok(E.cstats(lobo, g).dmg === E.cstats(lobo2, gn).dmg, 'de día no hay diferencia, y con el ajuste desactivado tampoco hay noche');
// avisos de amanecer / anochecer
const k = mk('DN3'); const e0 = k.eid; for (let t = 79; t <= 102; t++) { k.turn = t; E.dayNightTick(k); }
const txt = k.events.filter(e => e.id >= e0).map(e => e.text).join('\n'); ok(/Cae la noche/.test(txt) && /Amanece/.test(txt), 'se avisa al caer la noche y al amanecer');
// visión
const k2 = mk('DN5'); const me = k2.players.find(p => !p.bot).id; const u = k2.units.find(q => q.o === me); k2.units = [u]; k2.cities = []; u.x = 20; u.y = 20; k2.turn = 50; const vd = E.visFor(k2, me); k2.turn = 90; const vn = E.visFor(k2, me);
const cnt = v => v.reduce((a, b) => a + b, 0); ok(cnt(vn) < cnt(vd), 'de noche se ve menos (' + cnt(vd) + '→' + cnt(vn) + ')');
u.eq.antorcha = { k: 'antorcha', t: 3, r: 0, fx: [] }; const vt = E.visFor(k2, me); ok(cnt(vt) > cnt(vn), 'con antorcha se ve más');
// la antorcha anula el bono nocturno en el golpe de la criatura
const run = torch => { const g2 = mk('DN4'); const pid = g2.players.find(p => !p.bot).id; const v = g2.units.find(q => q.o === pid); g2.creatures = []; v.x = 12; v.y = 12; v.hp = 9999; if (torch) v.eq.antorcha = { k: 'antorcha', t: 3, r: 0, fx: [] };
  const c = E.spawnCreature(g2, 'lobo', 13, 12, 4); c.hx = c.x; c.hy = c.y; g2.turn = 90; const h0 = v.hp; E.creaturesTurn(g2); return h0 - v.hp; };
const dn0 = run(false), dn1 = run(true); ok(dn0 > 0 && dn1 > 0 && dn1 < dn0, 'la antorcha reduce el daño nocturno (' + dn0 + ' sin antorcha vs ' + dn1 + ' con ella)');
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
