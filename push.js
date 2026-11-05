'use strict';
/* Aventura de almas — Web Push sin dependencias.
 * VAPID (RFC 8292) + cifrado de mensajes aes128gcm (RFC 8291). */
const crypto = require('crypto');

const b64u = b => Buffer.from(b).toString('base64url');

/* ---------- claves VAPID ---------- */
function generateVapid() {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const j = privateKey.export({ format: 'jwk' });
  const pub = Buffer.concat([Buffer.from([4]), Buffer.from(j.x, 'base64url'), Buffer.from(j.y, 'base64url')]);
  return { pub: pub.toString('base64url'), x: j.x, y: j.y, d: j.d };
}
function vapidFromJSON(s) {
  try { const v = JSON.parse(s); if (v && v.pub && v.x && v.y && v.d) return v; } catch (e) { /* inválido */ }
  return null;
}
function privKeyObject(v) { return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: v.x, y: v.y, d: v.d }, format: 'jwk' }); }

function vapidHeader(endpoint, vapid, subject, now) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor((now || Date.now()) / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: privKeyObject(vapid), dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + vapid.pub;
}

/* ---------- cifrado del mensaje (RFC 8291) ---------- */
function encryptPayload(plain, p256dh, auth, test) {
  const ua = Buffer.from(p256dh, 'base64url');
  const authSecret = Buffer.from(auth, 'base64url');
  if (ua.length !== 65 || ua[0] !== 4) throw new Error('Clave p256dh inválida');
  const ecdh = crypto.createECDH('prime256v1');
  if (test && test.asPrivate) ecdh.setPrivateKey(test.asPrivate); else ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(ua);
  const salt = (test && test.salt) || crypto.randomBytes(16);
  const hk = (ikm, s, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, s, info, len));
  const ikm = hk(secret, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub]), 32);
  const cek = hk(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hk(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.concat([plain, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0); header.writeUInt32BE(4096, 16); header[20] = 65;
  return Buffer.concat([header, asPub, ct]);
}

/* ---------- validación de destinos (evita que el servidor sea usado para pedir URLs internas) ---------- */
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
function allowedEndpoint(endpoint) {
  let u; try { u = new URL(endpoint); } catch (e) { return false; }
  if (process.env.PUSH_ALLOW_ANY === '1') return u.protocol === 'https:' || u.protocol === 'http:';
  if (u.protocol !== 'https:' || u.port) return false;
  return PUSH_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
}
function validSubscription(s) {
  return !!(s && typeof s.endpoint === 'string' && s.endpoint.length < 1000 && allowedEndpoint(s.endpoint) && s.keys
    && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string' && s.keys.p256dh.length < 200 && s.keys.auth.length < 100
    && Buffer.from(s.keys.p256dh, 'base64url').length === 65);
}

/* ---------- envío ---------- */
async function sendPush(sub, payload, vapid, subject, opts) {
  const o = opts || {};
  const body = encryptPayload(Buffer.from(JSON.stringify(payload)), sub.keys.p256dh, sub.keys.auth);
  const headers = {
    Authorization: vapidHeader(sub.endpoint, vapid, subject),
    'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
    TTL: String(o.ttl || 3600), Urgency: o.urgency || 'normal',
  };
  if (o.topic) headers.Topic = String(o.topic).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers,
    body, signal: AbortSignal.timeout(10000),
  });
  try { await res.arrayBuffer(); } catch (e) { /* nada */ }
  return res.status;
}

module.exports = { generateVapid, vapidFromJSON, vapidHeader, encryptPayload, sendPush, validSubscription, allowedEndpoint };
