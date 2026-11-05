// Pruebas de ausencia/piloto automático, entrada a partida en curso, liberar plaza y avisos push (con un servicio push simulado)
process.env.ADA_TEST = '1'; process.env.PORT = '3150'; process.env.DATA_DIR = '/tmp/ada-f'; process.env.PUSH_ALLOW_ANY = '1';
delete process.env.UPSTASH_REDIS_REST_URL;
require('fs').rmSync('/tmp/ada-f', { recursive: true, force: true });
const crypto = require('crypto'), http = require('http');
const E = require('../engine.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (name, cond, extra) => { console.log((cond ? '✓ ' : '✗ ') + name + (extra !== undefined ? ' — ' + extra : '')); if (!cond) fails++; };

/* ---- servicio push simulado: descifra como lo haría el navegador y verifica la firma VAPID ---- */
const keys = {}, inbox = {}; let vapidPub = null, vapidBad = 0, vapidGood = 0;
const hk = (ikm, salt, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));
function decrypt(name, body) {
  const { ecdh, auth } = keys[name];
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const secret = ecdh.computeSecret(asPub), uaPub = ecdh.getPublicKey();
  const ikm = hk(secret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const cek = hk(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16), nonce = hk(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  let plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = plain.length - 1; while (end > 0 && plain[end] === 0) end--; // quitar relleno
  return JSON.parse(plain.subarray(0, end).toString());
}
function verifyVapid(h) {
  try {
    const m = h.match(/^vapid t=([^,]+), k=(.+)$/); const [a, b, c] = m[1].split('.');
    const k = Buffer.from(m[2], 'base64url'); if (m[2] !== vapidPub) return false;
    const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: k.subarray(1, 33).toString('base64url'), y: k.subarray(33).toString('base64url') }, format: 'jwk' });
    const claims = JSON.parse(Buffer.from(b, 'base64url'));
    return crypto.verify('sha256', Buffer.from(a + '.' + b), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(c, 'base64url')) && claims.exp > Date.now() / 1000 && !!claims.sub && claims.aud.startsWith('http://127.0.0.1');
  } catch (e) { return false; }
}
const pushSrv = http.createServer((req, res) => {
  const chunks = []; req.on('data', d => chunks.push(d));
  req.on('end', () => {
    const name = req.url.split('/').pop(); const body = Buffer.concat(chunks);
    if (verifyVapid(req.headers.authorization || '') && req.headers['content-encoding'] === 'aes128gcm' && req.headers.ttl) vapidGood++; else vapidBad++;
    if (name === 'gone') { res.writeHead(410); return res.end(); }
    try { (inbox[name] = inbox[name] || []).push(decrypt(name, body)); } catch (e) { console.log('  (no se pudo descifrar)', e.message); }
    res.writeHead(201); res.end();
  });
});

function client(port) {
  const ws = new WebSocket('ws://127.0.0.1:' + port); const c = { ws, last: null, msgs: [] };
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 's') c.last = m.s; else c.msgs.push(m); };
  c.send = o => ws.send(JSON.stringify(o)); c.open = new Promise(r => ws.onopen = r);
  c.find = t => c.msgs.filter(m => m.t === t); return c;
}
function subscribe(c, name, endpoint) {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); const auth = crypto.randomBytes(16);
  keys[name] = { ecdh, auth };
  c.send({ t: 'push', a: 'sub', sub: { endpoint: endpoint || 'http://127.0.0.1:4600/push/' + name, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } });
}
const last = n => (inbox[n] || []).slice(-1)[0];

(async () => {
  await new Promise(r => pushSrv.listen(4600, '127.0.0.1', r));
  const S = require('../server.js'); await S.ready;

  // --- seguridad del destino de los avisos ---
  const P = require('../push.js'); process.env.PUSH_ALLOW_ANY = '';
  check('destinos push: permite servicios reales', P.allowedEndpoint('https://fcm.googleapis.com/fcm/send/x') && P.allowedEndpoint('https://web.push.apple.com/x') && P.allowedEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'));
  check('destinos push: rechaza direcciones internas y falsas', !P.allowedEndpoint('http://127.0.0.1:4600/x') && !P.allowedEndpoint('https://localhost/x') && !P.allowedEndpoint('https://fcm.googleapis.com.evil.com/x') && !P.allowedEndpoint('https://169.254.169.254/latest') && !P.allowedEndpoint('https://evil.example.com/'));
  process.env.PUSH_ALLOW_ANY = '1';

  const ana = client(3150), beto = client(3150); await ana.open; await beto.open;
  ana.send({ t: 'create', name: 'Ana' }); await wait(200);
  const aj = ana.find('joined')[0]; vapidPub = aj.vapid;
  beto.send({ t: 'join', code: aj.code, name: 'Beto' }); await wait(200);
  ana.send({ t: 'lobby', a: 'addbot' }); ana.send({ t: 'lobby', a: 'addbot' });
  ana.send({ t: 'lobby', a: 'cfg', turnHours: 4, maxTurns: 0, idleTurns: 2 }); await wait(200);
  check('la sala muestra la opción de ausencia', ana.last.cfg.idleTurns === 2);
  ana.send({ t: 'lobby', a: 'start' }); await wait(300);
  const g = S.games.get(aj.code), bj = beto.find('joined')[0];
  check('partida iniciada con 4 jugadores', ana.last.status === 'playing' && ana.last.players.length === 4);

  // --- 2. avisos ---
  subscribe(ana, 'ana'); await wait(500);
  check('aviso de bienvenida llega cifrado y se descifra', last('ana') && /Avisos activados/.test(last('ana').title), last('ana') && last('ana').title);
  check('firma VAPID válida en todos los envíos', vapidGood >= 1 && vapidBad === 0, 'buenos ' + vapidGood + ', malos ' + vapidBad);
  ana.send({ t: 'push', a: 'sub', sub: { endpoint: 'http://127.0.0.1:4600/push/ana', keys: { p256dh: 'x', auth: 'y' } } }); await wait(150);
  check('suscripción inválida rechazada', ana.find('err').some(m => /suscripción/i.test(m.m)));

  ana.send({ t: 'seen' }); ana.send({ t: 'cmd', a: 'force' }); await wait(500);
  check('aviso de turno nuevo', last('ana') && /Turno 2/.test(last('ana').title) && /Termina en/.test(last('ana').body), last('ana') && last('ana').title + ' | ' + last('ana').body);

  // --- 3. ausencia y piloto automático ---
  check('el primer turno cuenta como presente para todos', g.players[1].idle === 0 && !g.players[1].auto);
  subscribe(beto, 'beto'); await wait(400);
  const betoN0 = (inbox.beto || []).length;
  ana.send({ t: 'seen' }); ana.send({ t: 'cmd', a: 'force' }); await wait(500);
  check('Beto lleva 1 turno sin aparecer', g.players[1].idle === 1 && !g.players[1].auto);
  ana.send({ t: 'seen' }); ana.send({ t: 'cmd', a: 'force' }); await wait(600);
  check('tras 2 turnos ausente, un bot toma su ejército', g.players[1].auto === true && ana.last.players[1].auto === true);
  check('Ana (presente) sigue al mando', !g.players[0].auto);
  check('Beto recibe aviso de piloto automático', last('beto') && /piloto automático/.test(last('beto').title), last('beto') && last('beto').title);
  const betoN1 = (inbox.beto || []).length;
  ana.send({ t: 'seen' }); ana.send({ t: 'cmd', a: 'force' }); await wait(500);
  check('el aviso de piloto automático no se repite cada turno', (inbox.beto || []).length === betoN1, 'avisos ' + betoN0 + ' → ' + betoN1 + ' → ' + (inbox.beto || []).length);
  const unitsBefore = g.units.filter(u => u.o === 1).length;
  check('el bot dirige las unidades de Beto (siguen vivas)', unitsBefore >= 1, unitsBefore + ' unidades');
  beto.send({ t: 'seen' }); await wait(300);
  check('al volver, Beto recupera el mando y todos lo ven', !g.players[1].auto && ana.last.players[1].auto === false);
  check('queda anotado en el registro', ana.last.log.some(l => /vuelve y retoma el mando/.test(l.text)));
  // piloto automático no bloquea el fin de turno
  for (let i = 0; i < 3; i++) { ana.send({ t: 'seen' }); ana.send({ t: 'cmd', a: 'force' }); await wait(300); }
  check('Beto vuelve a quedar ausente', g.players[1].auto === true);
  const t0 = ana.last.turn; ana.send({ t: 'cmd', a: 'ready', v: true }); await wait(500);
  check('si solo quedan ausentes, Ana pulsando «Listo» basta para avanzar', ana.last.turn === t0 + 1, 'turno ' + t0 + ' → ' + ana.last.turn);

  // --- 4. entrar a partida en curso ---
  const carla = client(3150); await carla.open;
  carla.send({ t: 'join', code: aj.code, name: 'Carla' }); await wait(250);
  const sl = carla.find('slots')[0];
  check('quien entra a una partida en curso ve los bots disponibles', sl && sl.slots.length === 2 && sl.slots.every(x => x.units > 0), sl && sl.slots.map(x => x.name).join(', '));
  check('los ausentes (humanos) no aparecen como plazas', !sl.slots.some(x => x.id === 1));
  carla.send({ t: 'join', code: aj.code, name: 'Carla', slot: sl.slots[0].id }); await wait(300);
  const cj = carla.find('joined')[0], cid = sl.slots[0].id;
  check('Carla ocupa el lugar del bot y conserva ejército y ciudad', cj && carla.last.you === cid && carla.last.players[cid].name === 'Carla' && !carla.last.players[cid].bot && carla.last.mine.length >= 1 && carla.last.cities.some(c => c.o === cid), carla.last.mine.length + ' unidades');
  check('la capital se renombra', g.cities.some(c => c.owner === cid && c.name === 'Capital de Carla'));
  const dani = client(3150); await dani.open;
  dani.send({ t: 'join', code: aj.code, name: 'Dani', slot: cid }); await wait(250);
  check('no se puede ocupar una plaza ya tomada', dani.find('err').some(m => /ya no está disponible/.test(m.m)) && dani.find('slots').length >= 1);
  // --- liberar plaza de un ausente ---
  beto.send({ t: 'cmd', a: 'release', id: 1 }); await wait(200);
  check('solo el anfitrión puede liberar plazas', beto.find('err').some(m => /anfitri/i.test(m.m)) && g.players[1].bot === false);
  ana.send({ t: 'cmd', a: 'release', id: 1 }); await wait(300);
  check('el anfitrión libera la plaza del ausente', g.players[1].bot === true && ana.last.players[1].bot === true);
  check('el ausente liberado es expulsado de la partida', beto.find('kicked').length === 1);
  const beto2 = client(3150); await beto2.open; beto2.send({ t: 'auth', code: aj.code, token: bj.token }); await wait(200);
  check('su sesión vieja ya no sirve', beto2.find('authfail').length === 1);
  dani.send({ t: 'join', code: aj.code, name: 'Dani' }); await wait(250);
  const sl2 = dani.find('slots').slice(-1)[0];
  check('la plaza liberada queda disponible', sl2 && sl2.slots.some(x => x.id === 1), sl2 && sl2.slots.map(x => x.id).join(','));
  dani.send({ t: 'join', code: aj.code, name: 'Dani', slot: 1 }); await wait(300);
  check('Dani ocupa la plaza liberada', dani.last && dani.last.you === 1 && dani.last.players[1].name === 'Dani' && !dani.last.players[1].bot);

  // --- recordatorio de fin de turno ---
  g.endsAt = Date.now() + 10 * 60000; const n0 = (inbox.ana || []).length;
  S.remindAll(); await wait(400);
  check('recordatorio cuando queda poco del turno', (inbox.ana || []).length === n0 + 1 && /Se acaba el turno/.test(last('ana').title), last('ana').body);
  S.remindAll(); await wait(300);
  check('el recordatorio no se repite', (inbox.ana || []).length === n0 + 1);

  // --- ataque entre jugadores en tiempo real ---
  const A = g.units.find(u => u.o === 0), C = g.units.find(u => u.o === cid);
  const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(d => ({ x: A.x + d[0], y: A.y + d[1] })).find(p => 'gfh'.includes(g.map.t[p.y * g.map.w + p.x]) && !g.units.some(u => u.x === p.x && u.y === p.y) && !g.cities.some(c => c.x === p.x && c.y === p.y) && !g.creatures.some(c => c.x === p.x && c.y === p.y));
  C.x = adj.x; C.y = adj.y; C.at = 1; E.touch(g);
  const n1 = (inbox.ana || []).length;
  carla.send({ t: 'cmd', a: 'attack', u: C.id, tt: 'u', id: A.id }); await wait(500);
  check('Ana recibe aviso inmediato de que la atacan', (inbox.ana || []).length === n1 + 1 && /atacando/.test(last('ana').title), last('ana') && last('ana').body);
  check('el ataque aparece en el registro de Ana', ana.last.log.some(l => l.k === 'phit'));
  C.at = 1; carla.send({ t: 'cmd', a: 'attack', u: C.id, tt: 'u', id: A.id }); await wait(400);
  check('máximo un aviso de ataque cada 5 minutos', (inbox.ana || []).length === n1 + 1);

  // --- suscripción caducada se elimina ---
  subscribe(dani, 'x', 'http://127.0.0.1:4600/push/gone'); await wait(500);
  check('suscripción caducada (410) se elimina sola', g.players[1].push.length === 0, 'quedan ' + g.players[1].push.length);

  const h = await (await fetch('http://127.0.0.1:3150/health')).json();
  check('/health informa de avisos y guardado', h.push === true && h.store.type === 'disco', JSON.stringify(h.store));
  check('firma VAPID válida en todos los avisos del test', vapidBad === 0 && vapidGood >= 8, 'buenos ' + vapidGood);
  console.log(fails ? '\nHAY ' + fails + ' FALLOS' : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
