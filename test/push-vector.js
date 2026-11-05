// Vector de prueba oficial del RFC 8291, apéndice A
const P = require('../push.js');
const d = s => Buffer.from(s, 'base64url');
const out = P.encryptPayload(Buffer.from('When I grow up, I want to be a watermelon'),
  'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  'BTBZMqHH6r4Tts7J_aSIgg',
  { asPrivate: d('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'), salt: d('DGv6ra1nlYgDCS1FRnbzlw') });
const expected = 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
console.log(out.toString('base64url') === expected ? 'VECTOR RFC 8291: COINCIDE' : 'VECTOR RFC 8291: NO coincide\n' + out.toString('base64url'));
// firma VAPID: verificar con la clave pública
const crypto = require('crypto');
const v = P.generateVapid();
const h = P.vapidHeader('https://fcm.googleapis.com/fcm/send/abc', v, 'https://ejemplo.onrender.com');
const jwt = h.match(/t=([^,]+),/)[1].split('.');
const pubKey = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: v.x, y: v.y }, format: 'jwk' });
console.log('firma VAPID válida:', crypto.verify('sha256', Buffer.from(jwt[0] + '.' + jwt[1]), { key: pubKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(jwt[2], 'base64url')),
  '| aud:', JSON.parse(Buffer.from(jwt[1], 'base64url')).aud, '| k longitud:', Buffer.from(h.split('k=')[1], 'base64url').length);
