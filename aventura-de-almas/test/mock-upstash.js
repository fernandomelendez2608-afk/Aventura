// Imita la API REST de Upstash Redis (SET/GET/SADD/SREM/SMEMBERS/DEL) para probar el guardado sin internet.
const http = require('http');
function start(port, token, opts = {}) {
  const kv = new Map(), sets = new Map(); let calls = 0, down = false;
  const run = a => {
    calls++;
    const [c, k, v] = a;
    switch (String(c).toUpperCase()) {
      case 'SET': kv.set(k, v); return 'OK';
      case 'GET': return kv.has(k) ? kv.get(k) : null;
      case 'DEL': return kv.delete(k) ? 1 : 0;
      case 'SADD': { if (!sets.has(k)) sets.set(k, new Set()); sets.get(k).add(v); return 1; }
      case 'SREM': { if (sets.has(k)) sets.get(k).delete(v); return 1; }
      case 'SMEMBERS': return [...(sets.get(k) || [])];
      default: throw new Error('ERR comando desconocido ' + c);
    }
  };
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', d => b += d);
    req.on('end', () => {
      if (down) { res.writeHead(503); return res.end('{"error":"caído"}'); }
      if (req.headers.authorization !== 'Bearer ' + token) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end('{"error":"WRONGPASS"}'); }
      let j; try { j = JSON.parse(b); } catch (e) { res.writeHead(400); return res.end('{"error":"json"}'); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      try {
        if (req.url === '/pipeline') res.end(JSON.stringify(j.map(a => { try { return { result: run(a) }; } catch (e) { return { error: e.message }; } })));
        else res.end(JSON.stringify({ result: run(j) }));
      } catch (e) { res.end(JSON.stringify({ error: e.message })); }
    });
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r({ srv, kv, sets, calls: () => calls, setDown: v => down = v })));
}
module.exports = { start };
