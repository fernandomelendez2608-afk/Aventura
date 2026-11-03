const E = require('../engine.js');
const S = require('../public/shared.js');
const N = +process.argv[2] || 10, T = +process.argv[3] || 120;
const g = E.createGame('TEST', 'Host', 'tok');
for (let i = 1; i < N; i++) E.addBot(g);
const err = E.startGame(g);
if (err) throw new Error(err);
g.players[0].bot = true; g.cfg.sim = true;
console.log('mapa', g.map.w + 'x' + g.map.h, 'ciudades', g.cities.length, 'criaturas', g.creatures.length, 'unidades', g.units.length);
const t0 = Date.now();
for (let t = 0; t < T && g.status === 'playing'; t++) {
  E.advanceTurn(g);
  if (t % 15 === 14 || g.status !== 'playing') {
    const lv = g.units.map(u => u.lv);
    const tiers = g.units.map(u => Object.values(u.eq).reduce((a, i) => a + i.t, 0));
    const sc = g.players.map(p => p.alive ? E.score(g, p) : 'X').join(',');
    console.log(`T${g.turn} unidades=${g.units.length} niv.med=${(lv.reduce((a,b)=>a+b,0)/lv.length).toFixed(1)} max=${Math.max(...lv)} equipo.med=${(tiers.reduce((a,b)=>a+b,0)/tiers.length).toFixed(1)} criaturas=${g.creatures.length} jefes=${g.creatures.filter(c=>S.CREATURES[c.t].boss).length} ciudades(ocup)=${g.cities.filter(c=>c.owner!==null).length}/${g.cities.length} vivos=${g.players.filter(p=>p.alive).length} pts=[${sc}]`);
  }
}
console.log('estado', g.status, 'ganador', g.winner, 'ms', Date.now() - t0);
const s = E.serialize(g); const g2 = E.deserialize(s);
console.log('serial KB', (s.length / 1024).toFixed(0), 'roundtrip ok', g2.units.length === g.units.length);
const snap = E.snapshot(g2, 0);
console.log('snapshot KB', (JSON.stringify(snap).length / 1024).toFixed(1));
