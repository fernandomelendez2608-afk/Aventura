const { spawn } = require('child_process');
const fs = require('fs');
const M = require('./mock-upstash.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
let okAll = true;
const check = (name, cond, extra) => { console.log((cond ? '✓ ' : '✗ ') + name + (extra ? ' — ' + extra : '')); if (!cond) okAll = false; };
function startServer(dir, port, env = {}) {
  const s = spawn('node', ['server.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, UPSTASH_REDIS_REST_URL: 'http://127.0.0.1:4555', UPSTASH_REDIS_REST_TOKEN: 'tok', SAVE_EVERY_MS: '1000', RETRY_MS: '2000', ...env } });
  let log = ''; s.stdout.on('data', d => log += d); s.stderr.on('data', d => log += d);
  s.getLog = () => log; return s;
}
function client(port) {
  const ws = new WebSocket('ws://127.0.0.1:' + port); const c = { ws, last: null, msgs: [] };
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 's') c.last = m.s; else c.msgs.push(m); };
  c.send = o => ws.send(JSON.stringify(o)); c.open = new Promise(r => ws.onopen = r); return c;
}
const health = async port => (await fetch('http://127.0.0.1:' + port + '/health')).json();
(async () => {
  fs.rmSync('/tmp/ada-p1', { recursive: true, force: true }); fs.rmSync('/tmp/ada-p2', { recursive: true, force: true }); fs.rmSync('/tmp/ada-p3', { recursive: true, force: true });
  const mock = await M.start(4555, 'tok');
  let s1 = startServer('/tmp/ada-p1', 3130); await wait(1200);
  let h = await health(3130); check('arranca con la nube', h.store.type === 'nube', JSON.stringify(h.store));
  const a = client(3130); await a.open; a.send({ t: 'create', name: 'Ana' }); await wait(300);
  const j = a.msgs.find(m => m.t === 'joined'); check('clave de avisos entregada', !!j.vapid && j.vapid.length > 80);
  a.send({ t: 'lobby', a: 'addbot' }); a.send({ t: 'lobby', a: 'start' }); await wait(2800);
  check('partida guardada en la nube', mock.kv.has('ada:game:' + j.code) && mock.sets.get('ada:games').has(j.code));
  const stored = require('zlib').gunzipSync(Buffer.from(mock.kv.get('ada:game:' + j.code), 'base64')).toString();
  check('se guarda comprimida y legible', JSON.parse(stored).code === j.code, (mock.kv.get('ada:game:' + j.code).length / 1024).toFixed(1) + ' KB');
  const callsBefore = mock.calls(); await wait(3000);
  check('sin cambios no hay escrituras', mock.calls() === callsBefore, 'comandos nuevos: ' + (mock.calls() - callsBefore));
  // mover algo y cerrar con SIGTERM → debe guardar al cerrar
  const u = a.last.mine[0]; a.send({ t: 'cmd', a: 'skill', u: u.id, s: 'dano' }); await wait(200);
  const rev1 = JSON.parse(stored).rev;
  s1.kill('SIGTERM'); await wait(1500);
  const rev2 = JSON.parse(require('zlib').gunzipSync(Buffer.from(mock.kv.get('ada:game:' + j.code), 'base64')).toString()).rev;
  check('guarda al recibir SIGTERM', rev2 > rev1, 'rev ' + rev1 + ' → ' + rev2);
  // servidor nuevo con disco vacío: debe restaurar desde la nube
  let s2 = startServer('/tmp/ada-p2', 3131); await wait(1500);
  h = await health(3131); check('restaura partida desde la nube con disco vacío', h.games.some(g => g.code === j.code && g.status === 'playing'), JSON.stringify(h.games));
  check('conserva las claves de avisos', h.push === true);
  const b = client(3131); await b.open; b.send({ t: 'auth', code: j.code, token: j.token }); await wait(300);
  check('el jugador vuelve a entrar con su sesión y ve su ejército', b.last && b.last.mine.length === 4 && b.last.mine.find(x => x.id === u.id).sk.dano === 1);
  const j2 = b.msgs.find(m => m.t === 'joined'); check('mismas claves VAPID tras reiniciar', j2.vapid === j.vapid);
  // nube caída: sigue funcionando y reintenta
  mock.setDown(true); b.send({ t: 'cmd', a: 'skill', u: b.last.mine[1].id, s: 'salud' }); await wait(2500);
  h = await health(3131); check('con la nube caída el juego sigue y avisa', h.ok && h.store.ok === false && h.store.pending >= 1, JSON.stringify(h.store));
  mock.setDown(false); await wait(2500);
  h = await health(3131); check('al volver la nube se guarda lo pendiente', h.store.ok === true && h.store.pending === 0, JSON.stringify(h.store));
  // arranque con la nube caída y recuperación posterior
  s2.kill('SIGTERM'); await wait(1200); mock.setDown(true);
  let s3 = startServer('/tmp/ada-p3', 3132); await wait(7500);
  h = await health(3132); check('arranca aunque la nube esté caída', h.ok && h.games.length === 0, 'juegos: ' + h.games.length);
  mock.setDown(false); await wait(4500);
  h = await health(3132); check('cuando la nube vuelve, carga las partidas', h.games.some(g => g.code === j.code), JSON.stringify(h.games));
  s3.kill('SIGTERM'); await wait(500); mock.srv.close();
  console.log(okAll ? '\nTODO OK' : '\nHAY FALLOS'); process.exit(okAll ? 0 : 1);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
