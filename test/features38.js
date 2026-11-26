require('./seed.js');
// v1.71.0: eventos entre oleadas de la Ciudadela
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Eventos entre oleadas');
const mk = seed => { const g = E.createGame(seed, 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g); return g; };
const g = mk('EV1'); g.cw.next = 999999; let evs = [], seen = {};
for (let t = 0; t < 260; t++) { const l0 = g.eid; E.advanceTurn(g); for (const e of g.events.filter(x => x.id >= l0)) if (/Caravana|caravana|bendic|viajeros nuevos|entrenamiento|reliquia|Noche de sombras/.test(e.text)) evs.push(e.text); if (g.status !== 'playing') break; }
ok(evs.length >= 5, 'en 260 turnos de calma ocurren varios eventos (' + evs.length + ')');
const kinds = new Set(evs.map(x => (x.match(/caravana|bendicen|viajeros nuevos|entrenamiento|reliquia|Noche de sombras/i) || [''])[0].toLowerCase())); ok(kinds.size >= 3, 'hay variedad de eventos (' + [...kinds].join(', ') + ')');
// no ocurren con una oleada en curso
const h = mk('EV2'); h.cw.n = 1; h.cw.cleared = 0; h.cw.ids = [999]; h.cw.next = 0; h.cw.evt = 0; const l1 = h.eid; E.citEvent(h); ok(h.eid === l1, 'no hay eventos durante una oleada');
// no justo antes de la oleada
const j = mk('EV3'); j.cw.next = j.turn + 5; j.cw.evt = 0; const l2 = j.eid; E.citEvent(j); ok(j.eid === l2, 'no hay eventos justo antes de la oleada');
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
