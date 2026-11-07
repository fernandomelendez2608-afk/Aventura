'use strict';
// Menú de partidas: varias partidas a la vez, estado en la lista, salir al menú (sin recibir más datos) y reentrar
const { spawn } = require('child_process');
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3115', DATA_DIR: '/tmp/ada-menu-data' } });
srv.stderr.on('data', d => process.stdout.write('[srv-err] ' + d));
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
function client() {
  const ws = new WebSocket('ws://localhost:3115'); const c = { ws, states: 0, msgs: [], last: null };
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 's') { c.states++; c.last = m.s; } else c.msgs.push(m); };
  c.send = o => ws.send(JSON.stringify(o)); c.open = new Promise(r => ws.onopen = r);
  c.take = t => { const i = c.msgs.map(m => m.t).lastIndexOf(t); return i < 0 ? null : c.msgs[i]; };
  return c;
}
(async () => {
  await wait(900);
  const a = client(); await a.open;
  a.send({ t: 'create', name: 'Ana' }); await wait(250); const j1 = a.take('joined');
  a.send({ t: 'create', name: 'Ana' }); await wait(250); const j2 = a.take('joined');
  ok(j1 && j2 && j1.code !== j2.code, `dos partidas distintas con el mismo jugador (${j1.code}, ${j2.code})`);
  // iniciar la primera: entrar, añadir bot, empezar
  a.send({ t: 'auth', code: j1.code, token: j1.token }); await wait(200);
  a.send({ t: 'lobby', a: 'addbot' }); a.send({ t: 'lobby', a: 'start' }); await wait(300);
  ok(a.last && a.last.status === 'playing', 'la partida 1 está en juego');
  // consultar estado de la lista
  a.send({ t: 'mygames', games: [{ code: j1.code, token: j1.token }, { code: j2.code, token: j2.token }, { code: 'ZZZZZ', token: 'x' }, { code: j2.code, token: 'mal' }] }); await wait(200);
  const mg = a.take('mygames');
  ok(mg && mg.games.length === 4, 'responde por cada partida pedida');
  ok(mg.games[0].ok && mg.games[0].status === 'playing' && mg.games[0].turn === 1 && mg.games[0].host, 'partida 1: en juego, turno 1, anfitrión');
  ok(mg.games[1].ok && mg.games[1].status === 'lobby', 'partida 2: en sala de espera');
  ok(!mg.games[2].ok && !mg.games[3].ok, 'código inexistente o clave incorrecta → no ok (sin filtrar datos)');
  ok(Object.keys(mg.games[3]).length === 2, 'la respuesta de error no revela nada de la partida');
  // salir al menú: deja de recibir estados
  a.send({ t: 'leave' }); await wait(200);
  ok(a.take('left'), 'el servidor confirma la salida');
  const b = client(); await b.open;
  b.send({ t: 'join', code: j2.code, name: 'Beto' }); await wait(250);
  const n0 = a.states; a.send({ t: 'ping' }); 
  b.send({ t: 'lobby', a: 'addbot' }); await wait(250); // anfitrión es Ana; Beto no puede, pero el join ya difundió
  const c2 = client(); await c2.open; c2.send({ t: 'join', code: j2.code, name: 'Cami' }); await wait(250);
  ok(a.states === n0, 'tras salir al menú ya no le llegan estados de la partida');
  // volver a entrar a otra y a la misma
  a.send({ t: 'auth', code: j2.code, token: j2.token }); await wait(250);
  ok(a.last && a.last.players.length >= 3 && a.last.status === 'lobby', 'reentra a la partida 2 y la ve actualizada (' + a.last.players.map(p => p.name).join(',') + ')');
  a.send({ t: 'leave' }); await wait(150);
  a.send({ t: 'auth', code: j1.code, token: j1.token }); await wait(250);
  ok(a.last && a.last.status === 'playing' && a.last.mine.length === 4, 'reentra a la partida 1 con sus 4 unidades');
  console.log(fails ? '\nFALLOS: ' + fails : '\nTodo correcto');
  srv.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
