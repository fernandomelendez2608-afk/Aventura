require('./seed.js');
// v1.78.0: dificultad Infierno de la Ciudadela
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const mk = d => { const g = E.createGame('HEL' + d, 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; if (d) g.cfg.citDiff = d; E.addBot(g, 'azar'); E.startGame(g); return g; };
const n = mk(''), h = mk('infierno');
ok(n.cw.total === 20, 'normal: 20 oleadas');
ok(h.cw.total === 100, 'infierno: 100 oleadas');
ok(h.cw.next === 100, 'infierno: primera oleada y separación de 100 turnos');
n.cfg.waveGap = 25; h.cfg.waveGap = 25;
ok(S.WORLD_OPTS && S.WORLD_OPTS.citDiff && S.WORLD_OPTS.citDiff.o.infierno, 'ajuste citDiff en el lobby');
const pn = E.citPlan(n, 10), ph = E.citPlan(h, 10);
ok(ph.lv > pn.lv, 'criaturas de más nivel en infierno (' + ph.lv + ' vs ' + pn.lv + ')');
ok(E.citPlan(h, 100).lv > E.citPlan(h, 50).lv && E.citPlan(h, 100).cnt <= S.CIT.maxEnemies, 'la oleada 100 existe y respeta el máximo de enemigos');
// avanzar hasta superar la oleada 1 y comprobar que la siguiente tarda 100 turnos
h.creatures = []; h.cw.next = h.turn + 1; h.cit.hp = h.cit.max = 99999;
let sp = false; for (let i = 0; i < 6 && !sp; i++) { E.advanceTurn(h); sp = h.cw.n >= 1; }
ok(sp, 'la oleada se genera');
for (const c of h.creatures.filter(c => c.tg)) { c.hp = 0; }
h.creatures = h.creatures.filter(c => !c.tg); for (let i = 0; i < 3; i++) E.advanceTurn(h);
ok(h.cw.next - h.turn > 80 && h.cw.next - h.turn <= 100, 'tras superar una oleada la siguiente llega en ~100 turnos (' + (h.cw.next - h.turn) + ')');
const h2 = mk('infierno'); h2.cw.n = 79; h2.cw.cleared = 1; h2.cw.next = h2.turn + 1; h2.cit.hp = h2.cit.max = 99999; for (let i = 0; i < 4; i++) E.advanceTurn(h2);
ok(h2.creatures.filter(c => c.tg).length > 40, 'oleada 80: muchas criaturas (' + h2.creatures.filter(c => c.tg).length + ')');
console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
