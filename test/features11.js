// Pruebas de cuentas (v1.53): registro, verificación por correo simulado, sesiones, recuperación, partidas entre dispositivos
process.env.ADA_TEST = '1'; process.env.PORT = '3151'; process.env.DATA_DIR = '/tmp/ada-f11';
delete process.env.UPSTASH_REDIS_REST_URL;
require('fs').rmSync('/tmp/ada-f11', { recursive: true, force: true });
const http = require('http');
const wait = ms => new Promise(r => setTimeout(r, ms * (+process.env.WAIT_X || 2)));
const until = async (f, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (f()) return true; } catch (e) {} await wait(25); } return false; };
let fails = 0;
const check = (name, cond, extra) => { console.log((cond ? '✓ ' : '✗ ') + name + (extra !== undefined ? ' — ' + extra : '')); if (!cond) fails++; };

const mails = [];
const mailSrv = http.createServer((req, res) => {
  const ch = []; req.on('data', d => ch.push(d));
  req.on('end', () => { try { const b = JSON.parse(Buffer.concat(ch)); mails.push({ to: b.to[0].email, text: b.textContent, key: req.headers['api-key'] }); } catch (e) {} res.writeHead(201); res.end('{}'); });
});
const lastCode = () => (mails[mails.length - 1].text.match(/: (\d{6})/) || [])[1];

function client(port) {
  const ws = new WebSocket('ws://127.0.0.1:' + port); const c = { ws, msgs: [] };
  ws.onmessage = e => c.msgs.push(JSON.parse(e.data));
  c.open = new Promise(r => ws.onopen = r);
  c.send = o => ws.send(JSON.stringify(o));
  c.find = f => c.msgs.find(f);
  c.take = async (f, ms) => { const n = c.msgs.length; await until(() => c.msgs.slice(0).some(f), ms); const m = c.msgs.slice(0).reverse().find(f); c.msgs = []; return m; };
  c.acc = async (a, o) => { c.msgs = []; c.send(Object.assign({ t: 'acc', a }, o)); return c.take(m => m.t === 'acc' && m.a === a); };
  return c;
}

(async () => {
  await new Promise(r => mailSrv.listen(0, '127.0.0.1', r));
  process.env.BREVO_API_KEY = 'k-test'; process.env.MAIL_FROM = 'juego@example.com'; process.env.BREVO_URL = 'http://127.0.0.1:' + mailSrv.address().port + '/mail';
  require('../server.js');
  await wait(300);

  const A = client(3151); await A.open;
  // validaciones
  let r = await A.acc('reg', { email: 'malo', name: 'Ana', pw: '12345678' }); check('correo inválido se rechaza', !!r.err);
  r = await A.acc('reg', { email: 'ana@x.com', name: 'Ana', pw: '123' }); check('contraseña corta se rechaza', !!r.err);
  // partida de invitado previa
  A.send({ t: 'create', name: 'Ana' }); const j = await A.take(m => m.t === 'joined');
  check('crea partida como invitado', !!j && !!j.code);
  r = await A.acc('reg', { email: 'Ana@X.com', name: 'Ana', pw: 'secreto123', games: [{ code: j.code, token: j.token, name: 'Ana' }] });
  check('registro pide verificar', r.need === 'verify', JSON.stringify(r));
  check('se envió un correo con código', mails.length === 1 && mails[0].to === 'ana@x.com' && /^\d{6}$/.test(lastCode()) && mails[0].key === 'k-test');
  r = await A.acc('login', { email: 'ana@x.com', pw: 'secreto123' }); check('sin verificar no entra', r.need === 'verify');
  r = await A.acc('verify', { email: 'ana@x.com', code: '000000' }); check('código malo se rechaza', !!r.err && /incorrecto/i.test(r.err));
  const code1 = lastCode();
  r = await A.acc('verify', { email: 'ana@x.com', code: code1, games: [{ code: j.code, token: j.token, name: 'Ana' }] });
  check('con el código entra', r.ok && r.user.verified && r.sess && r.user.email === 'ana@x.com');
  check('la partida de invitado se importó a la cuenta', r.games.length === 1 && r.games[0].code === j.code && r.games[0].token === j.token);
  const sess = r.sess;
  check('la contraseña no queda en claro en disco', !require('fs').readdirSync('/tmp/ada-f11').some(f => /^meta-acc/.test(f) && /secreto123/.test(require('fs').readFileSync('/tmp/ada-f11/' + f, 'utf8'))));

  // otro dispositivo: login con contraseña y ver la misma partida
  const B = client(3151); await B.open;
  r = await B.acc('login', { email: 'ana@x.com', pw: 'mala' }); check('contraseña mala se rechaza', !!r.err);
  r = await B.acc('login', { email: 'ana@x.com', pw: 'secreto123' });
  check('otro dispositivo ve la misma partida', r.ok && r.games.some(g => g.code === j.code && g.token === j.token));
  B.send({ t: 'auth', code: j.code, token: r.games[0].token }); const jb = await B.take(m => m.t === 'joined');
  check('y puede entrar a ella', !!jb && jb.code === j.code);

  // una partida nueva creada desde B aparece en A
  B.send({ t: 'leave' }); B.send({ t: 'create', name: 'Ana' }); const j2 = await B.take(m => m.t === 'joined');
  await wait(200);
  const C = client(3151); await C.open;
  r = await C.acc('resume', { sess });
  check('sesión guardada reanuda sin contraseña', r.ok && r.user.name === 'Ana');
  check('la partida nueva creada en otro dispositivo aparece', r.games.some(g => g.code === j2.code));
  r = await client(3151).acc && (async () => { const D = client(3151); await D.open; return D.acc('resume', { sess: 'x'.repeat(40) + '.zz' }); })();
  r = await r; check('sesión falsa no sirve', r.fail === true);

  // desvincular
  C.send({ t: 'acc', a: 'unlink', code: j2.code }); await wait(200);
  r = await C.acc('sync', {}); check('desvincular quita la partida de la cuenta', r.ok && !r.games.some(g => g.code === j2.code) && r.games.some(g => g.code === j.code));

  // recuperación
  const n0 = mails.length, E1 = client(3151); await E1.open;
  r = await E1.acc('forgot', { email: 'noexiste@x.com' }); check('olvidé con correo desconocido responde igual (sin pistas)', r.ok && mails.length === n0);
  await wait(50);
  r = await E1.acc('forgot', { email: 'ana@x.com' }); check('olvidé envía código', r.ok && mails.length === n0 + 1);
  r = await E1.acc('reset', { email: 'ana@x.com', code: lastCode(), pw: 'nuevaclave9' });
  check('con el código se cambia la contraseña', r.ok && r.sess);
  const F = client(3151); await F.open;
  r = await F.acc('resume', { sess }); check('al cambiar la contraseña se cierran las otras sesiones', r.fail === true);
  r = await F.acc('login', { email: 'ana@x.com', pw: 'secreto123' }); check('la clave vieja ya no sirve', !!r.err);
  r = await F.acc('login', { email: 'ana@x.com', pw: 'nuevaclave9' }); check('la nueva sí', r.ok);

  // límite de intentos
  const G = client(3151); await G.open; let blocked = false;
  for (let i = 0; i < 12 && !blocked; i++) { const x = await G.acc('login', { email: 'ana@x.com', pw: 'zzzzzzzz' + i }); if (/Demasiados/.test(x.err || '')) blocked = true; }
  check('demasiados intentos fallidos bloquean', blocked);

  // registro duplicado y borrar
  const H = client(3151); await H.open;
  r = await H.acc('reg', { email: 'ana@x.com', name: 'Otra', pw: 'otraclave99' }); check('correo ya registrado se rechaza', !!r.err && /ya tiene/.test(r.err));
  r = await F.acc('del', { pw: 'mala' }); check('borrar cuenta pide la contraseña correcta', !!r.err);
  console.log(fails ? `\n${fails} fallos` : '\nTodo bien');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
