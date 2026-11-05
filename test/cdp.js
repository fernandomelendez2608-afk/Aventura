const { spawn } = require('child_process');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3112', DATA_DIR: '/tmp/ada-cdp-data' } });
srv.stderr.on('data', d => console.log('[srv-err]', String(d)));
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-proxy-server', '--remote-debugging-port=9333', '--user-data-dir=/tmp/chrome-ada', 'about:blank'], { stdio: 'ignore' });
(async () => {
  await wait(2500);
  const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); const logs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text)); else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('CONSOLE.ERR ' + m.params.args.map(a => a.value || a.description).join(' ')); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) logs.push('EVAL ' + expr.slice(0, 60) + ' -> ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description)); return r.result.result && r.result.result.value; };
  const shot = async name => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync('/tmp/shots/' + name + '.png', Buffer.from(r.result.data, 'base64')); };
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 2, mobile: true });
  await cdp('Page.navigate', { url: 'http://127.0.0.1:3112/' }); await wait(1200);
  await shot('1-home');
  await ev(`document.getElementById('hName').value='Fercho'; document.getElementById('hCreate').click()`); await wait(600);
  for (let i = 0; i < 3; i++) await ev(`document.getElementById('lBot').click()`);
  await wait(400); await shot('2-lobby');
  await ev(`document.getElementById('lStart').click()`); await wait(900);
  await shot('3-game');
  // seleccionar la primera unidad propia
  await ev(`selectUnit(S.mine[0].id, true)`); await wait(300); await shot('4-unit');
  await ev(`sheet.tab='skills'; renderSheet()`); await wait(200); await shot('5-skills');
  await ev(`act({a:'skill',u:selId,s:'dano'})`); await wait(300);
  // abrir ciudad y forjar
  await ev(`openSheet('city',{cityId:S.cities.find(c=>c.o===S.you).id}); sheet.tab='forge'; renderSheet()`); await wait(200); await shot('6-forge');
  await ev(`act({a:'craft',c:sheet.cityId,k:'espada',tr:1})`); await wait(300);
  await ev(`openSheet('players')`); await wait(200); await shot('7-players');
  // zoom out para ver el mapa
  await ev(`closeSheet(); cam.z=22; cam.x=S.w/2; cam.y=S.h/2; dirty=true`); await wait(400); await shot('8-map');
  await ev(`openSheet('players')`); await wait(300); await shot('9-players-avisos');
  await ev(`closeSheet(); show('home'); showSlots([{id:2,name:'Bot Selene',color:'#2fbf71',units:5,cities:2,score:140},{id:3,name:'Bot Ragnar',color:'#f5b82e',units:4,cities:1,score:90}],'ABCDE')`); await wait(300); await shot('10-home-slots');
  console.log('barra de avisos visible:', await ev(`!document.getElementById('pushBar').classList.contains('hidden')`), '| estado avisos:', await ev(`pushStatus()`), '| clave:', await ev(`!!vapidKey`));
  console.log('estado', await ev(`JSON.stringify({status:S.status, turn:S.turn, mine:S.mine.length, sk:S.mine[0].sk, st:S.cities.find(c=>c.o===S.you).st})`));
  console.log('errores JS:', logs.length ? logs : 'ninguno');
  ws.close(); chrome.kill(); srv.kill(); process.exit(0);
})().catch(e => { console.error('FALLO', e); chrome.kill(); srv.kill(); process.exit(1); });
