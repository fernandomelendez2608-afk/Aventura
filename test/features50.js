// v1.81.0: «Dejar ir» a los caídos llega al motor a través del servidor real (antes la orden «release» la interceptaba el servidor: liberar plaza)
process.env.ADA_TEST = '1'; process.env.PORT = '3151'; process.env.DATA_DIR = '/tmp/ada-f50'; delete process.env.UPSTASH_REDIS_REST_URL;
require('fs').rmSync('/tmp/ada-f50', { recursive: true, force: true });
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms * (+process.env.WAIT_X || 2)));
const until = async (f, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (f()) return true; } catch (e) {} await wait(25); } return false; };
let fails = 0; const check = (n, c, x) => { console.log((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' — ' + x : '')); if (!c) fails++; };
function client(port) { const ws = new WebSocket('ws://127.0.0.1:' + port); const c = { ws, last: null, msgs: [] }; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 's') c.last = m.s; else c.msgs.push(m); }; c.send = o => ws.send(JSON.stringify(o)); c.open = new Promise(r => ws.onopen = r); c.find = t => c.msgs.filter(m => m.t === t); return c; }
const h = fs.readFileSync(__dirname + '/../public/index.html', 'utf8');
check('el cliente usa una orden propia para los caídos', /a: 'letgrave', g: \+rel\.dataset\.rel/.test(h) && !/a: 'release', g:/.test(h));
(async () => {
  const S = require('../server.js'); await S.ready;
  const ana = client(3151); await ana.open; ana.send({ t: 'create', name: 'Ana' }); await wait(200);
  const aj = ana.find('joined')[0]; ana.send({ t: 'lobby', a: 'addbot' }); await wait(100);
  ana.send({ t: 'lobby', a: 'start' }); await until(() => ana.last && ana.last.status === 'playing'); await wait(100);
  const g = S.games.get(aj.code); check('partida iniciada', g && g.status === 'playing');
  g.graves = g.graves || []; g.graves.push({ id: 9901, o: 0, name: 'Caído', lv: 5, cost: {}, sk: {}, pts: 0 }, { id: 9902, o: 1, name: 'Ajeno', lv: 5, cost: {}, sk: {}, pts: 0 });
  const e0 = ana.find('err').length; ana.send({ t: 'cmd', a: 'letgrave', g: 9901 }); await wait(300);
  check('el caído propio desaparece de la lista', !g.graves.some(x => x.id === 9901));
  check('sin errores del servidor', ana.find('err').length === e0, JSON.stringify(ana.find('err').slice(e0)));
  check('el anfitrión sigue ocupando su plaza', g.players[0] && !g.players[0].bot && !g.players[0].released);
  ana.send({ t: 'cmd', a: 'letgrave', g: 9902 }); await wait(300);
  check('no se puede dejar ir el caído de otro jugador', g.graves.some(x => x.id === 9902));
  console.log(fails ? fails + ' FALLOS' : 'OK'); process.exit(fails ? 1 : 0);
})();
