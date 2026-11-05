const { spawn } = require('child_process');
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3111', DATA_DIR: '/tmp/ada-test-data' } });
srv.stdout.on('data', d => process.stdout.write('[srv] ' + d));
srv.stderr.on('data', d => process.stdout.write('[srv-err] ' + d));
const wait = ms => new Promise(r => setTimeout(r, ms));
function client(name) {
  const ws = new WebSocket('ws://localhost:3111'); const c = { ws, last: null, msgs: [], name };
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 's') c.last = m.s; else c.msgs.push(m); };
  c.send = o => ws.send(JSON.stringify(o));
  c.open = new Promise(r => ws.onopen = r);
  return c;
}
(async () => {
  await wait(800);
  const h = await (await fetch('http://localhost:3111/health')).json(); console.log('health', h.ok);
  const a = client('Ana'); await a.open; a.send({ t: 'create', name: 'Ana' }); await wait(200);
  const joined = a.msgs.find(m => m.t === 'joined'); console.log('creada', joined.code);
  const b = client('Beto'); await b.open; b.send({ t: 'join', code: joined.code, name: 'Beto' }); await wait(200);
  a.send({ t: 'lobby', a: 'addbot' }); a.send({ t: 'lobby', a: 'cfg', turnHours: 0.01, maxTurns: 0 }); await wait(200);
  console.log('jugadores lobby', a.last.players.map(p => p.name).join(','));
  a.send({ t: 'lobby', a: 'start' }); await wait(300);
  console.log('estado', a.last.status, 'turno', a.last.turn, 'mapa', a.last.w, 'mis unidades', a.last.mine.length, 'terr len', a.last.terr.length);
  const u = a.last.mine[0];
  // mover a una casilla alcanzable
  const S = require('../shared.js');
  const L = a.last, env = { w: L.w, h: L.h, terr: (x, y) => L.terr[y * L.w + x], occ: (x, y) => L.mine.some(m => m.x === x && m.y === y) ? 1 : (L.cre.some(m => m.x === x && m.y === y) || L.others.some(m => m.x === x && m.y === y)) ? 2 : 0 };
  const r = S.reach(env, u.x, u.y, u.mp);
  const dest = [...r].find(([k, v]) => v.end);
  a.send({ t: 'cmd', a: 'move', u: u.id, x: dest[0] % L.w, y: Math.floor(dest[0] / L.w) }); await wait(200);
  console.log('tras mover', a.last.mine[0].x, a.last.mine[0].y, 'errs', a.msgs.filter(m => m.t === 'err').map(m => m.m));
  // forjar y equipar
  const city = a.last.cities.find(c => c.o === 0);
  a.send({ t: 'cmd', a: 'craft', c: city.id, k: 'espada', tr: 1 }); await wait(150);
  console.log('mensajes', a.msgs.filter(m => m.t === 'msg' || m.t === 'err').map(m => m.m));
  // listos -> avanza turno
  a.send({ t: 'cmd', a: 'ready', v: true }); b.send({ t: 'cmd', a: 'ready', v: true }); await wait(400);
  console.log('turno ahora', a.last.turn, 'log', a.last.log.slice(0, 2).map(l => l.text));
  // reconexión por token
  const b2 = client('Beto2'); await b2.open; const bj = b.msgs.find(m => m.t === 'joined'); b2.send({ t: 'auth', code: bj.code, token: bj.token }); await wait(200);
  console.log('reauth ok', b2.last && b2.last.you);
  // temporizador: turnHours 0.01 = 36 s, no esperamos
  a.ws.close(); b.ws.close(); b2.ws.close(); await wait(100); srv.kill('SIGTERM'); await wait(300);
  console.log('guardado existe', require('fs').readdirSync('/tmp/ada-test-data').some(n => /^game-.*\.json$/.test(n)));
  process.exit(0);
})().catch(e => { console.error('FALLO', e); srv.kill(); process.exit(1); });
