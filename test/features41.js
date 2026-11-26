// v1.73.1: las unidades del mapa usan el retrato del panel
const fs = require('fs'), path = require('path');
const h = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
require('./seed.js'); const E = require('../engine.js');
let ok = (c, m) => { if (!c) { console.error('FALLA:', m); process.exit(1); } };
ok(/function unitPortrait\(/.test(h) && /unitPortrait\(m, own\)/.test(h), 'el mapa dibuja el retrato');
const g = E.createGame('P1', 'H', 't'); g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g);
const o = E.snapshot(g, 0).others || [];
const bot = g.units.find(u => u.o !== 0); bot && (E.snapshot(g, 0), 0);
// un jugador ve a otro: el snapshot incluye lo necesario para dibujarlo igual
const u = g.units.find(x => x.o === 1); const v = g.units.find(x => x.o === 0); u.x = v.x + 1; u.y = v.y; const s = E.snapshot(g, 0), m = (s.others || []).find(x => x.id === u.id);
ok(m && 'pt' in m && 'sx' in m && 'wk' in m, 'los demás jugadores se ven con su diseño (semilla, sexo, arma)');
console.log('features41 OK');
