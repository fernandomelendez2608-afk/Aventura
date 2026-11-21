require('./seed.js');
// Sin islas aisladas (v1.55.3): todo el terreno, entradas de mazmorra, ciudades y sitios son alcanzables a pie
const E = require('../engine.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Sin islas');
let bad = 0, n = 0, dgs = 0;
for (const mode of ['normal', 'historia', 'mundo', 'oleadas']) for (const size of ['pequeno', 'normal', 'grande', 'enorme']) for (let i = 0; i < 3; i++) {
  const g = E.createGame('IS' + i, 'Host', 't'); g.cfg.mode = mode; g.cfg.mapSize = size; g.cfg.idleTurns = 0; if (mode === 'mundo') g.cfg.worldSize = 'grande';
  for (let b = 0; b < 3; b++) E.addBot(g, 'azar'); E.startGame(g); n++;
  const w = g.map.w, h = g.map.h, seen = new Uint8Array(w * h), q = [], c0 = g.cities.find(c => c.owner !== null); seen[c0.y * w + c0.x] = 1; q.push(c0.y * w + c0.x);
  for (let k = 0; k < q.length; k++) { const x = q[k] % w, y = (q[k] / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const kk = Y * w + X; if (!seen[kk] && 'gfhd'.includes(g.map.t[kk])) { seen[kk] = 1; q.push(kk); } } }
  const land = [...g.map.t].filter(ch => 'gfhd'.includes(ch)).length;
  if (q.length !== land) bad++;
  for (const d of g.dungeons) { dgs++; if (!seen[d.y * w + d.x]) bad++; }
  for (const c of g.cities) if (!seen[c.y * w + c.x]) bad++;
  for (const s of g.sites.filter(s => s.dg === undefined)) if (!seen[s.y * w + s.x]) bad++;
}
ok(bad === 0, `${n} mundos y ${dgs} entradas: nada aislado (${bad} problemas)`);
console.log(fails ? 'FALLOS: ' + fails : 'Todo bien'); process.exit(fails ? 1 : 0);
