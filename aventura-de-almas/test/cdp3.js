const { spawn } = require('child_process');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3114', DATA_DIR: '/tmp/ada-cdp3-data' } });
srv.stderr.on('data', d => console.log('[srv-err]', String(d)));
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-proxy-server', '--remote-debugging-port=9335', '--user-data-dir=/tmp/chrome-ada3', 'about:blank'], { stdio: 'ignore' });
(async () => {
  await wait(2500);
  const targets = await (await fetch('http://127.0.0.1:9335/json')).json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); const logs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text)); else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('CONSOLE.ERR ' + m.params.args.map(a => a.value || a.description).join(' ')); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) logs.push('EVAL ' + expr.slice(0, 60) + ' -> ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description)); return r.result.result && r.result.result.value; };
  const shot = async name => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync('/tmp/shots/' + name + '.png', Buffer.from(r.result.data, 'base64')); };
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 2, mobile: true });
  await cdp('Page.navigate', { url: 'http://127.0.0.1:3114/' }); await wait(1200);
  await ev(`document.getElementById('hName').value='Fercho'; document.getElementById('hCreate').click()`); await wait(600);
  await ev(`document.getElementById('lBot').click()`); await wait(200);
  await ev(`document.getElementById('lStart').click()`); await wait(900);
  // avanzar turnos de verdad (anfitrión) viendo la pantalla: el resumen se reconoce solo
  for (let i = 0; i < 3; i++) { await ev(`send({t:'cmd',a:'force'})`); await wait(500); }
  console.log('turno:', await ev(`S.turn`), '| recap tras ver los turnos en vivo:', await ev(`JSON.stringify(S.recap)`), '| hoja:', await ev(`sheet ? sheet.mode : null`));
  // orden real "ir a" por el servidor
  const u0 = await ev(`JSON.stringify({id:S.mine[0].id,x:S.mine[0].x,y:S.mine[0].y})`); const U = JSON.parse(u0);
  await ev(`selectUnit(${U.id}, true); gotoMode=${U.id}; tapTile(${U.x}+3, ${U.y}+2)`); await wait(500);
  console.log('orden en el servidor:', await ev(`JSON.stringify(S.mine.find(u=>u.id===${U.id}).ord)`), '| posición:', await ev(`(()=>{const u=S.mine.find(u=>u.id===${U.id});return u.x+','+u.y})()`), 'antes', U.x + ',' + U.y);
  await ev(`cam.z=48; centerOn(${U.x}+1,${U.y}+1)`); await wait(300);
  await ev(`selectUnit(${U.id}, false)`); await wait(300); await shot('c1-orden-unidad');
  await ev(`gotoMode=${U.id}; renderSheet()`); await wait(200); await shot('c2-modo-ir');
  await ev(`gotoMode=null; send({t:'cmd',a:'ord',u:${U.id},o:'guard'})`); await wait(400);
  console.log('vigilar:', await ev(`JSON.stringify(S.mine.find(u=>u.id===${U.id}).ord)`));
  // clases (inyectado en cliente para ver la pantalla)
  await ev(`(function(){ const u=S.mine.find(u=>u.id===${U.id}); u.lv=7; sheet={mode:'unit',tab:'class'}; renderSheet(); })()`); await wait(200); await shot('c3-clase-elegir');
  await ev(`(function(){ const u=S.mine.find(u=>u.id===${U.id}); u.lv=13; u.cls='cazador'; sheet={mode:'unit',tab:'class'}; renderSheet(); })()`); await wait(200); await shot('c4-especializacion');
  // construir
  await ev(`(function(){ const c=S.cities.find(c=>c.o===S.you); c.st.m={hierro:12,acero:5,cuero:20,hueso:20}; c.b={herreria:1,muralla:2}; c.cm=6; openSheet('city',{cityId:c.id}); sheet.tab='build'; renderSheet(); })()`); await wait(250); await shot('c5-construir');
  await ev(`sheet.tab='state'; renderSheet()`); await wait(200);
  // resumen inyectado
  await ev(`(function(){ S.recap={from:2,to:S.turn,c:{lost:1,hits:5,atk:2,kills:3,lvl:2},lines:[{turn:2,text:'💀 Aria ha caído ante Lobo.',k:'dead'},{turn:3,text:'🏰 Bot Selene conquista Villa Alba.',k:'city'},{turn:3,text:'🐺 ¡Una horda de 4 criaturas avanza hacia Capital de Fercho!',k:'horde'},{turn:3,text:'🤝 Fercho y Bot Selene forman una alianza.',k:'dip'}]}; closeSheet(); recapKey=null; lastTurnClient=null; onState(); })()`); await wait(300);
  console.log('hoja de resumen abierta:', await ev(`sheet && sheet.mode`)); await shot('c6-resumen');
  await ev(`document.querySelector('#sheet [data-ui=close].btn').click()`); await wait(400);
  console.log('tras "Entendido", hoja:', await ev(`sheet ? sheet.mode : null`), '| recap en servidor:', await ev(`JSON.stringify(S.recap)`));
  await ev(`closeSheet(); document.getElementById('bar').querySelector('[data-ui=units]').click()`); await wait(300); await shot('c7-lista');
  console.log('errores JS:', logs.length ? logs : 'ninguno');
  ws.close(); chrome.kill(); srv.kill(); process.exit(0);
})().catch(e => { console.error('FALLO', e); chrome.kill(); srv.kill(); process.exit(1); });
