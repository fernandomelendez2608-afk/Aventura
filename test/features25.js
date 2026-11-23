require('./seed.js');
// v1.64.2: la escuadra explora la mazmorra EN GRUPO (entra junta, avanza junta, sale junta)
const E = require('../engine.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Mazmorra en grupo');
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
let deaths = 0, bigEntry = 0, entries = 0, kills = 0, spreadMax = 0, lone = 0, turnsIn = 0, retire = null;
for (const seed of [1, 2, 3, 4, 5, 6]) {
  const g = E.createGame('GR' + seed, 'H', 't'); Object.assign(g.cfg, { mode: 'ciudadela', idleTurns: 0, sim: true, waveGap: 200 }); E.addBot(g, 'azar'); E.startGame(g);
  const city = g.cities.find(c => c.cit); city.st.m = { cuero: 900, hueso: 300, hierro: 300, acero: 200, alma: 60 }; city.st.m.cuero += 50; E.cmd(g, 0, { a: 'recruit', c: city.id });
  const mine = () => g.units.filter(u => u.o === 0 && !u.sm && !u.bs), us = mine().slice(0, 5);
  for (const u of us) { u.lv = 6; for (let k = 0; k < 12; k++) { u.pts = 1; E.cmd(g, 0, { a: 'skill', u: u.id, s: ['dano', 'salud', 'defensa'][k % 3] }); } u.hp = E.eff(g, u).maxHp; }
  E.cmd(g, 0, { a: 'sq', d: 'new', n: 'Raid', ids: us.map(u => u.id) }); E.cmd(g, 0, { a: 'sq', d: 'ord', id: 1, k: 'raid' });
  if (seed === 1) retire = E.snapshot(g, 0).ct.sq[0].rt;
  let was = false;
  for (let t = 0; t < 70 && g.status === 'playing'; t++) {
    const before = new Set(mine().map(u => u.id)), inBefore = new Map(mine().map(u => [u.id, !!u.dg]));
    for (const q of g.players) q.ready = true; E.advanceTurn(g);
    const inD = mine().filter(u => u.dg), newly = inD.filter(u => !inBefore.get(u.id)).length;
    if (newly && ![...inBefore.values()].some(Boolean)) { entries++; if (newly >= Math.min(3, us.length - 1)) bigEntry++; } // entrada desde cero: nadie del grupo estaba dentro
    if (inD.length) { turnsIn++; if (inD.length === 1 && mine().filter(u => u.sq).length > 1) lone++; }
    for (const id of before) if (!mine().some(u => u.id === id) && inBefore.get(id)) deaths++;
  }
  kills += g.players[0].stats.kills;
}
ok(retire === 65, 'la orden de mazmorra se retira por defecto al 65 %');
ok(entries > 0 && bigEntry / entries >= 0.6, `el grupo entra junto: en ${bigEntry} de ${entries} entradas desde cero entraron 3 o más a la vez`);
ok(lone <= turnsIn * 0.2, `casi nunca hay una sola unidad dentro (${lone} de ${turnsIn} turnos)`);
ok(deaths <= 10, `pocas muertes con ventaja de nivel: ${deaths} de 30 unidades`);
ok(kills >= 40, `y aun así avanzan: ${kills} enemigos eliminados`);
if (fails) { console.log(fails + ' fallos'); process.exit(1); } console.log('OK');
