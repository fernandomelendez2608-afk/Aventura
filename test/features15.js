require('./seed.js');
// Modo sin conexión (v1.56): el motor debe cargarse sin Node (require/Buffer falsos) y guardarse/cargarse igual
const fs = require('fs'), path = require('path'), http = require('http');
const S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Sin conexión');
const Buf = { // copia del Buffer de public/local.js
  from(v, enc) {
    if (enc === 'base64') { const s = atob(v), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
    return { toString() { let s = ''; for (let i = 0; i < v.length; i += 8192) s += String.fromCharCode.apply(null, v.subarray(i, i + 8192)); return btoa(s); } };
  },
};
const mods = { './shared.js': S };
const req = n => { if (!mods[n]) throw new Error('módulo ' + n); return mods[n]; };
for (const [name, file] of [['./botchat.js', 'botchat.js'], ['./engine.js', 'engine.js']]) {
  const m = { exports: {} };
  new Function('require', 'module', 'exports', 'Buffer', fs.readFileSync(path.join(__dirname, '..', file), 'utf8'))(req, m, m.exports, Buf);
  mods[name] = m.exports;
}
const E = mods['./engine.js'];
ok(typeof E.createGame === 'function', 'el motor se carga sin require ni Buffer de Node');
const g = E.createGame('L1ABC', 'Yo', 'tok'); g.cfg.local = true; g.cfg.turnHours = 168; g.cfg.idleTurns = 0;
E.addBot(g, 'azar'); E.addBot(g, 'azar'); E.startGame(g);
for (let i = 0; i < 5; i++) E.advanceTurn(g);
const txt = E.serialize(g), g2 = E.deserialize(txt);
ok(g2.turn === g.turn && g2.units.length === g.units.length && g2.map.t === g.map.t, 'una partida guardada y cargada con el Buffer del navegador queda igual');
const n0 = g2.turn; E.advanceTurn(g2);
ok(g2.turn === n0 + 1, 'la partida cargada sigue jugándose');
// el servidor entrega lo que el modo sin conexión necesita
const PORT = 3950 + Math.floor(Math.random() * 40), { spawn } = require('child_process');
const srv = spawn('node', ['server.js'], { cwd: path.join(__dirname, '..'), env: Object.assign({}, process.env, { PORT, DATA_DIR: '/tmp/ada-off-test-' + PORT }), stdio: 'ignore' });
const get = p => new Promise(res => http.get({ port: PORT, path: p }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d })); }).on('error', () => res({ s: 0, d: '' })));
(async () => {
  for (let i = 0; i < 30; i++) { if ((await get('/health')).s === 200) break; await new Promise(r => setTimeout(r, 200)); }
  for (const f of ['/engine.js', '/botchat.js', '/shared.js', '/local.js']) ok((await get(f)).s === 200, 'el servidor sirve ' + f);
  const sw = await get('/sw.js'); ok(sw.s === 200 && /addEventListener\('fetch'/.test(sw.d) && /local\.js/.test(sw.d), 'el service worker guarda la app para usarla sin red');
  srv.kill(); console.log(fails ? 'FALLOS: ' + fails : 'Todo bien'); process.exit(fails ? 1 : 0);
})();
