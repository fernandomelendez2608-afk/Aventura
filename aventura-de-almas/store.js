'use strict';
/* Aventura de almas — almacenamiento de partidas.
 *  - FileStore: archivos en disco (se pierden en Render gratis al reiniciar).
 *  - UpstashStore: Redis en la nube vía REST (plan gratis de Upstash), sin dependencias.
 * Cada partida se guarda por separado y comprimida. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const pack = s => zlib.gzipSync(Buffer.from(s, 'utf8')).toString('base64');
const unpack = b => zlib.gunzipSync(Buffer.from(b, 'base64')).toString('utf8');
const safe = code => String(code).replace(/[^A-Za-z0-9_-]/g, '');

class FileStore {
  constructor(dir) { this.dir = dir; this.type = 'file'; this.status = { ok: true, lastOk: 0, lastError: null }; }
  _f(name) { return path.join(this.dir, name); }
  async loadAll() {
    const out = [];
    let names = [];
    try { names = fs.readdirSync(this.dir); } catch (e) { return out; }
    for (const n of names) {
      if (/^game-[A-Za-z0-9_-]+\.json$/.test(n)) {
        try { out.push({ code: n.slice(5, -5), data: fs.readFileSync(this._f(n), 'utf8') }); } catch (e) { /* archivo dañado */ }
      }
    }
    // formato antiguo (todas las partidas en un solo archivo)
    try {
      const arr = JSON.parse(fs.readFileSync(this._f('games.json'), 'utf8'));
      for (const s of arr) { const code = (JSON.parse(s).code); if (code && !out.some(o => o.code === code)) out.push({ code, data: s }); }
    } catch (e) { /* no existe */ }
    return out;
  }
  async save(code, str) {
    fs.mkdirSync(this.dir, { recursive: true });
    const f = this._f('game-' + safe(code) + '.json'), tmp = f + '.tmp';
    fs.writeFileSync(tmp, str); fs.renameSync(tmp, f);
    this.status.ok = true; this.status.lastOk = Date.now();
  }
  async remove(code) { try { fs.unlinkSync(this._f('game-' + safe(code) + '.json')); } catch (e) { /* ya no estaba */ } }
  async getMeta(key) { try { return fs.readFileSync(this._f('meta-' + safe(key) + '.json'), 'utf8'); } catch (e) { return null; } }
  async setMeta(key, str) { fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(this._f('meta-' + safe(key) + '.json'), str); }
}

class UpstashStore {
  constructor(url, token) {
    this.url = String(url).replace(/\/+$/, ''); this.token = token; this.type = 'upstash';
    this.status = { ok: false, lastOk: 0, lastError: null };
    this.known = new Set(); // códigos ya registrados en el índice (para no repetir SADD)
  }
  async _post(p, body) {
    let res;
    try {
      res = await fetch(this.url + p, { method: 'POST', headers: { Authorization: 'Bearer ' + this.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    } catch (e) { this.status.ok = false; this.status.lastError = 'Sin conexión con Upstash: ' + (e.cause && e.cause.code || e.message); throw new Error(this.status.lastError); }
    let j = null; try { j = await res.json(); } catch (e) { /* respuesta vacía */ }
    if (!res.ok || (j && !Array.isArray(j) && j.error)) {
      this.status.ok = false; this.status.lastError = 'Upstash respondió ' + res.status + (j && j.error ? ': ' + j.error : '');
      throw new Error(this.status.lastError);
    }
    this.status.ok = true; this.status.lastOk = Date.now(); this.status.lastError = null;
    return j;
  }
  async cmd(args) { const j = await this._post('', args); return j.result; }
  async pipeline(cmds) {
    const j = await this._post('/pipeline', cmds);
    for (const r of j) if (r && r.error) { this.status.ok = false; this.status.lastError = r.error; throw new Error(r.error); }
    return j.map(r => r.result);
  }
  async loadAll() {
    const codes = await this.cmd(['SMEMBERS', 'ada:games']);
    for (const c of codes) this.known.add(c);
    if (!codes.length) return [];
    const vals = await this.pipeline(codes.map(c => ['GET', 'ada:game:' + c]));
    const out = [];
    vals.forEach((v, i) => { if (v) { try { out.push({ code: codes[i], data: unpack(v) }); } catch (e) { console.error('Partida dañada en Upstash:', codes[i]); } } });
    return out;
  }
  async save(code, str) {
    const cmds = [['SET', 'ada:game:' + code, pack(str)]];
    if (!this.known.has(code)) cmds.push(['SADD', 'ada:games', code]);
    await this.pipeline(cmds);
    this.known.add(code);
  }
  async remove(code) { await this.pipeline([['DEL', 'ada:game:' + code], ['SREM', 'ada:games', code]]); this.known.delete(code); }
  async getMeta(key) { return await this.cmd(['GET', 'ada:meta:' + key]); }
  async setMeta(key, str) { await this.cmd(['SET', 'ada:meta:' + key, str]); }
}

function makeStores(env, dataDir) {
  const local = new FileStore(dataDir);
  const url = env.UPSTASH_REDIS_REST_URL, token = env.UPSTASH_REDIS_REST_TOKEN;
  const remote = url && token ? new UpstashStore(url, token) : null;
  return { local, remote };
}

module.exports = { FileStore, UpstashStore, makeStores, pack, unpack };
