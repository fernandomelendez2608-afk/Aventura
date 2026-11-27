// v1.81.1: modo sin conexión — el motor corre en el navegador (sin `global`), mochila en la Ciudadela, guardado periódico
const fs = require('fs'), path = require('path');
require('./seed.js');
let bad = 0; const ok = (c, m) => { if (!c) { console.log('FALLA', m); bad++; } };
// 1) el motor ejecutado como en local.js (sin `global`, sin `process`) juega 120 turnos de Ciudadela con muertes
const SH = require('../shared.js');
const mods = { './shared.js': SH };
const req = n => { if (!mods[n]) throw new Error('módulo ' + n); return mods[n]; };
for (const [name, f] of [['./botchat.js', 'botchat.js'], ['./engine.js', 'engine.js']]) {
  const m = { exports: {} };
  new Function('require', 'module', 'exports', 'Buffer', 'global', 'process', fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\bglobal\b/g, 'global'))(req, m, m.exports, Buffer, undefined, undefined);
  mods[name] = m.exports;
}
const E = mods['./engine.js'];
const g = E.createGame('L1', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.waveGap = 5; g.cfg.local = true;
E.addBot(g, 'azar'); E.addBot(g, 'azar');
ok(!E.startGame(g), 'startGame');
let deaths = 0;
for (let i = 0; i < 120 && g.status === 'playing'; i++) { try { E.cmd(g, 0, { a: 'ready', v: true }); E.advanceTurn(g); } catch (e) { ok(false, 'turno ' + g.turn + ': ' + e.message); break; } }
ok(g.turn >= 100, 'avanzó los turnos: ' + g.turn);
// 2) la pestaña Mochila no falla si la unidad está «junto a la ciudad» pero a más de 1 casilla (Ciudadela)
const h = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
ok(h.includes("if (!c && u.nearCity) c = S.cities.find(q => q.cit)"), 'respaldo de ciudad en la mochila');
ok(!/c = \{ name: ct\.name, st: ct\.inv, isCart: true \}; \}\s*\n\s*h \+= `<button class="btn gold block"/.test(h), 'sin acceso a ct nulo');
// 3) guardado: no se aplaza indefinidamente
const l = fs.readFileSync(path.join(__dirname, '..', 'public', 'local.js'), 'utf8');
ok(l.includes('saveFirst'), 'guardado con tope de 3 s');
if (bad) process.exit(1); console.log('features52 OK');
