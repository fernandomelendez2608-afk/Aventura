'use strict';
/* Aventura de almas — cuentas de usuario (sin dependencias).
 *  - Registro con correo + contraseña (scrypt), verificación y recuperación con un código de 6 dígitos por correo.
 *  - Sesiones largas por dispositivo (solo se guarda el hash en el servidor).
 *  - Cada cuenta recuerda sus partidas (código + token de jugador), así se ven iguales desde cualquier dispositivo.
 *  - Se guarda en el mismo almacén que las partidas (Upstash si está configurado, o archivos).
 *  - El correo sale por la API de Brevo (variables BREVO_API_KEY y MAIL_FROM). Sin ellas, las cuentas funcionan
 *    sin verificación y sin recuperación por correo. */
const crypto = require('crypto');

const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const SESS_MAX = 12, SESS_DAYS = 90, CODE_MIN = 15, MAX_GAMES = 40;

class Mailer {
  constructor(env) {
    this.key = env.BREVO_API_KEY || ''; this.from = env.MAIL_FROM || ''; this.name = env.MAIL_FROM_NAME || 'Aventura de almas';
    this.url = env.BREVO_URL || 'https://api.brevo.com/v3/smtp/email'; this.enabled = !!(this.key && this.from);
  }
  async send(to, subject, text) {
    if (!this.enabled) throw new Error('Correo no configurado');
    const res = await fetch(this.url, {
      method: 'POST', headers: { 'api-key': this.key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { name: this.name, email: this.from }, to: [{ email: to }], subject, textContent: text }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { let t = ''; try { t = (await res.text()).slice(0, 200); } catch (e) { /* nada */ } throw new Error('Brevo respondió ' + res.status + ' ' + t); }
  }
}

class Limiter { // ventana deslizante en memoria
  constructor() { this.m = new Map(); }
  hit(key, max, ms) {
    const now = Date.now(), a = (this.m.get(key) || []).filter(t => now - t < ms);
    if (a.length >= max) { this.m.set(key, a); return false; }
    a.push(now); this.m.set(key, a); return true;
  }
  clear(key) { this.m.delete(key); }
  sweep() { const now = Date.now(); for (const [k, a] of this.m) if (!a.length || now - a[a.length - 1] > 3600000) this.m.delete(k); }
}

class Accounts {
  // io: { get(key) -> string|null, set(key, str) }  ·  mailer: Mailer  ·  log: console-like
  constructor(io, mailer, log) {
    this.io = io; this.mail = mailer; this.log = log || console; this.cache = new Map(); this.lim = new Limiter();
    setInterval(() => this.lim.sweep(), 600000).unref();
  }
  keyOf(email) { return sha('ada-acc:' + email).slice(0, 40); }
  async load(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    let raw = null; try { raw = await this.io.get('acc-' + key); } catch (e) { throw new Error('No se pudo leer la cuenta (almacenamiento no disponible)'); }
    if (!raw) return null;
    const d = JSON.parse(raw); this.cache.set(key, d);
    if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value);
    return d;
  }
  async save(d) { this.cache.set(d.key, d); await this.io.set('acc-' + d.key, JSON.stringify(d)); }
  hashPw(pw, salt) { return crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 32).toString('hex'); }
  pwOk(d, pw) { const a = Buffer.from(this.hashPw(pw, d.pw.s), 'hex'), b = Buffer.from(d.pw.h, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); }
  setPw(d, pw) { const s = crypto.randomBytes(16).toString('hex'); d.pw = { s, h: this.hashPw(pw, s) }; }
  view(d) { return { email: d.email, name: d.name, verified: !!d.verified }; }
  newSession(d) {
    const raw = crypto.randomBytes(24).toString('hex'), now = Date.now();
    d.sess = (d.sess || []).filter(s => now - s.t < SESS_DAYS * 86400000);
    d.sess.push({ h: sha(raw), t: now }); if (d.sess.length > SESS_MAX) d.sess.shift();
    return d.key + '.' + raw;
  }
  static checkEmail(e) { e = String(e || '').trim().toLowerCase(); return EMAIL_RE.test(e) ? e : null; }
  static checkPw(p) { p = String(p || ''); return p.length >= 8 && p.length <= 100 ? p : null; }
  static checkName(n) { n = String(n || '').trim().replace(/\s+/g, ' '); return n.length >= 2 && n.length <= 14 ? n : null; }

  async sendCode(d, kind) { // kind: 'verify' | 'reset'
    d.codes = d.codes || {};
    const c = d.codes[kind]; if (c && Date.now() - c.t < 60000) throw new Error('Espera un minuto antes de pedir otro código');
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    d.codes[kind] = { h: sha(d.key + kind + code), t: Date.now(), exp: Date.now() + CODE_MIN * 60000, tries: 0 };
    await this.save(d);
    const what = kind === 'verify' ? 'confirmar tu cuenta' : 'cambiar tu contraseña';
    await this.mail.send(d.email, `Tu código de Aventura de almas: ${code}`,
      `Hola ${d.name},\n\nTu código para ${what} es: ${code}\n\nCaduca en ${CODE_MIN} minutos. Si no lo pediste tú, ignora este mensaje.\n\n— Aventura de almas`);
  }
  async checkCode(d, kind, code) {
    const c = d.codes && d.codes[kind];
    if (!c || Date.now() > c.exp) throw new Error('El código caducó. Pide uno nuevo');
    if (c.tries >= 5) { delete d.codes[kind]; await this.save(d); throw new Error('Demasiados intentos. Pide un código nuevo'); }
    c.tries++;
    const ok = sha(d.key + kind + String(code || '').trim()) === c.h;
    if (!ok) { await this.save(d); throw new Error('Código incorrecto'); }
    delete d.codes[kind];
  }

  async register(ip, emailIn, nameIn, pwIn) {
    if (!this.lim.hit('reg:' + ip, 6, 3600000)) throw new Error('Demasiados registros desde aquí. Prueba más tarde');
    const email = Accounts.checkEmail(emailIn); if (!email) throw new Error('Escribe un correo válido');
    const name = Accounts.checkName(nameIn); if (!name) throw new Error('El nombre debe tener entre 2 y 14 letras');
    const pw = Accounts.checkPw(pwIn); if (!pw) throw new Error('La contraseña debe tener al menos 8 caracteres');
    const key = this.keyOf(email), old = await this.load(key);
    if (old && old.verified) throw new Error('Ese correo ya tiene una cuenta. Inicia sesión');
    const d = old || { key, email, created: Date.now(), games: [], sess: [] };
    d.name = name; this.setPw(d, pw); d.verified = !this.mail.enabled; // sin correo configurado no se puede verificar
    await this.save(d);
    if (this.mail.enabled) { await this.sendCode(d, 'verify'); return { need: 'verify', email }; }
    return { sess: this.newSessSave(d), user: this.view(d), d };
  }
  newSessSave(d) { const s = this.newSession(d); this.save(d).catch(() => {}); return s; }
  async resend(ip, emailIn, kind) {
    if (!this.lim.hit('mail:' + ip, 10, 3600000)) throw new Error('Demasiados correos pedidos. Prueba más tarde');
    const email = Accounts.checkEmail(emailIn), d = email && await this.load(this.keyOf(email));
    if (!d || (kind === 'verify' && d.verified)) return; // sin pistas sobre si existe
    await this.sendCode(d, kind);
  }
  async verify(ip, emailIn, code) {
    const email = Accounts.checkEmail(emailIn); if (!email) throw new Error('Correo no válido');
    if (!this.lim.hit('vf:' + email, 10, 900000)) throw new Error('Demasiados intentos. Espera unos minutos');
    const d = await this.load(this.keyOf(email)); if (!d) throw new Error('Cuenta no encontrada');
    await this.checkCode(d, 'verify', code);
    d.verified = true; const sess = this.newSession(d); await this.save(d);
    return { sess, user: this.view(d), d };
  }
  async login(ip, emailIn, pwIn) {
    const email = Accounts.checkEmail(emailIn);
    if (!this.lim.hit('lg-ip:' + ip, 30, 900000) || (email && !this.lim.hit('lg:' + email, 8, 900000))) throw new Error('Demasiados intentos. Espera 15 minutos');
    const bad = new Error('Correo o contraseña incorrectos');
    if (!email) throw bad;
    const d = await this.load(this.keyOf(email));
    if (!d) { this.hashPw(String(pwIn || ''), crypto.randomBytes(16).toString('hex')); throw bad; } // tiempo parecido exista o no
    if (!this.pwOk(d, String(pwIn || ''))) throw bad;
    if (!d.verified) { await this.sendCode(d, 'verify').catch(() => {}); return { need: 'verify', email }; }
    this.lim.clear('lg:' + email);
    const sess = this.newSession(d); await this.save(d);
    return { sess, user: this.view(d), d };
  }
  async resume(sess) {
    const [key, raw] = String(sess || '').split('.'); if (!key || !raw || key.length !== 40) return null;
    const d = await this.load(key); if (!d) return null;
    const h = sha(raw), now = Date.now(), s = (d.sess || []).find(x => x.h === h && now - x.t < SESS_DAYS * 86400000);
    if (!s) return null;
    if (now - s.t > 86400000) { s.t = now; this.save(d).catch(() => {}); } // sesión deslizante
    return d;
  }
  async logout(d, sess) { const raw = String(sess || '').split('.')[1]; if (raw) d.sess = (d.sess || []).filter(s => s.h !== sha(raw)); await this.save(d); }
  async forgot(ip, emailIn) {
    if (!this.mail.enabled) throw new Error('Este servidor no tiene el correo configurado, no se puede recuperar la contraseña');
    await this.resend(ip, emailIn, 'reset');
  }
  async reset(ip, emailIn, code, pwIn) {
    const email = Accounts.checkEmail(emailIn); if (!email) throw new Error('Correo no válido');
    const pw = Accounts.checkPw(pwIn); if (!pw) throw new Error('La contraseña debe tener al menos 8 caracteres');
    if (!this.lim.hit('rs:' + email, 10, 900000)) throw new Error('Demasiados intentos. Espera unos minutos');
    const d = await this.load(this.keyOf(email)); if (!d) throw new Error('Código incorrecto');
    await this.checkCode(d, 'reset', code);
    this.setPw(d, pw); d.verified = true; d.sess = []; // al cambiar la contraseña se cierran las demás sesiones
    const sess = this.newSession(d); await this.save(d);
    return { sess, user: this.view(d), d };
  }
  async remove(d, pwIn) {
    if (!this.pwOk(d, String(pwIn || ''))) throw new Error('Contraseña incorrecta');
    this.cache.delete(d.key); await this.io.set('acc-' + d.key, ''); // se vacía (el almacén no tiene borrado de meta)
  }
  /* partidas ligadas a la cuenta */
  async link(d, code, token, name) {
    d.games = d.games || [];
    const i = d.games.findIndex(g => g.c === code);
    if (i >= 0) { if (d.games[i].k === token && d.games[i].n === name) return; d.games.splice(i, 1); }
    d.games.unshift({ c: code, k: token, n: name, t: Date.now() }); d.games = d.games.slice(0, MAX_GAMES);
    await this.save(d);
  }
  async unlink(d, code) { const n = (d.games || []).length; d.games = (d.games || []).filter(g => g.c !== String(code).toUpperCase()); if (d.games.length !== n) await this.save(d); }
  // valida con `ok(code, token) -> nombre|null` y devuelve la lista vigente [{code, token, name}]
  async syncGames(d, extra, ok) {
    const out = [], seen = new Set(); let changed = false;
    for (const g of [...(Array.isArray(extra) ? extra.slice(0, 40) : []).map(x => ({ c: String(x && x.code || '').toUpperCase(), k: x && x.token, n: x && x.name })), ...(d.games || [])]) {
      if (!g.c || seen.has(g.c)) continue;
      const nm = ok(g.c, g.k); if (!nm) { if ((d.games || []).some(x => x.c === g.c)) changed = true; continue; }
      seen.add(g.c); out.push({ c: g.c, k: g.k, n: nm, t: g.t || Date.now() });
    }
    if (changed || out.length !== (d.games || []).length || out.some((g, i) => !d.games[i] || d.games[i].c !== g.c)) { d.games = out.slice(0, MAX_GAMES); await this.save(d); }
    return d.games.map(g => ({ code: g.c, token: g.k, name: g.n }));
  }
}

module.exports = { Accounts, Mailer, Limiter, EMAIL_RE };
