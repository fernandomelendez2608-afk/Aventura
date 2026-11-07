const { spawn } = require('child_process');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3116', DATA_DIR: '/tmp/ada-cdp4-data' } });
srv.stderr.on('data', d => console.log('[srv-err]', String(d)));
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-proxy-server', '--remote-debugging-port=9336', '--user-data-dir=/tmp/chrome-ada4', 'about:blank'], { stdio: 'ignore' });
(async () => {
  await wait(2500);
  const targets = await (await fetch('http://127.0.0.1:9336/json')).json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); const logs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text)); else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('CONSOLE.ERR ' + m.params.args.map(a => a.value || a.description).join(' ')); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) logs.push('EVAL ' + expr.slice(0, 60) + ' -> ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description)); return r.result.result && r.result.result.value; };
  const shot = async name => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync('/tmp/shots/' + name + '.png', Buffer.from(r.result.data, 'base64')); };
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 2, mobile: true });
  const nav = async () => { await cdp('Page.navigate', { url: 'http://127.0.0.1:3116/' }); await wait(1300); };
  const val = e => ev(e);
  await nav();
  await ev(`document.getElementById('hName').value='Fercho'; document.getElementById('hCreate').click()`); await wait(600);
  const c1 = await val(`cur.code`);
  await ev(`document.getElementById('lBot').click()`); await wait(200);
  await ev(`document.getElementById('lStart').click()`); await wait(900);
  console.log('partida 1:', c1, 'estado', await val(`S.status`));
  await shot('d1-juego-con-menu');
  await ev(`document.getElementById('gMenu').click()`); await wait(600);
  console.log('tras ☰: pantalla home visible =', await val(`!document.getElementById('home').classList.contains('hidden')`), '| cur =', await val(`cur`), '| lista:', await val(`document.querySelectorAll('#hList .line').length`));
  // crear segunda partida (queda en sala) y volver al menú
  await ev(`document.getElementById('hCreate').click()`); await wait(600);
  const c2 = await val(`cur.code`);
  await ev(`document.getElementById('lLeave').click()`); await wait(700);
  console.log('partida 2:', c2, '| lista ahora:', await val(`document.querySelectorAll('#hList .line').length`));
  await shot('d2-menu-lista');
  console.log('textos de estado:', JSON.stringify(await val(`[...document.querySelectorAll('#hList .hint')].map(h=>h.textContent)`)));
  // partida inexistente: se marca
  await ev(`saved.push({code:'ZZZZZ',token:'x',name:'Fercho'}); renderSaved(); askGames()`); await wait(500);
  console.log('estado de la inexistente:', JSON.stringify(await val(`[...document.querySelectorAll('#hList .hint')].pop().textContent`)));
  await shot('d3-menu-con-error');
  await ev(`document.querySelector('#hList [data-ui="forget:ZZZZZ"]').click()`); await wait(300);
  console.log('quitada sin confirmar, quedan:', await val(`saved.length`));
  // reentrar a la partida 1 desde la lista
  await ev(`document.querySelector('#hList [data-ui="resume:${c1}"]').click()`); await wait(700);
  console.log('reentrada a', c1, '→ estado', await val(`S && S.status`), '| código', await val(`S && S.code`), '| ¿vuelve sola al juego al llegar estados? pantalla juego visible =', await val(`!document.getElementById('game').classList.contains('hidden')`));
  // recargar: vuelve a la última partida
  await nav(); await wait(500);
  console.log('tras recargar: código actual =', await val(`cur && cur.code`), '| pantalla juego =', await val(`!document.getElementById('game').classList.contains('hidden')`));
  // salir al menú y recargar: se queda en el menú
  await ev(`document.getElementById('gMenu').click()`); await wait(400);
  console.log('ada_last tras ☰:', await val(`localStorage.getItem('ada_last')`), '| cur:', await val(`cur === null`));
  await nav(); await wait(400);
  console.log('ada_last tras recargar:', await val(`localStorage.getItem('ada_last')`));
  console.log('tras menú + recargar: cur =', await val(`cur`), '| home visible =', await val(`!document.getElementById('home').classList.contains('hidden')`));
  console.log('errores JS:', logs.length ? logs : 'ninguno');
  ws.close(); chrome.kill(); srv.kill(); process.exit(0);
})().catch(e => { console.error('FALLO', e); chrome.kill(); srv.kill(); process.exit(1); });
