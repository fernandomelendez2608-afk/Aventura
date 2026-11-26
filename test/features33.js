require('./seed.js');
// v1.67: cada criatura de la Ciudadela tiene su sprite propio (16x16, distinto de los demás)
const S = require('../shared.js'), fs = require('fs'), path = require('path');
const h = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
console.log('Sprites únicos de la Ciudadela');
const ids = Object.keys(S.CREATURES).filter(k => S.CREATURES[k].cit);
const rows = {}, bad = [], dup = [];
for (const id of ids) {
  const m = h.match(new RegExp('SPR\\.c_' + id + ' = (\\[[^\\]]*\\]);'));
  if (!m) { bad.push(id); continue; }
  const r = JSON.parse(m[1]); if (r.length !== 16 || r.some(x => x.length !== 16)) bad.push(id);
  const k = r.join('|'); if (rows[k]) dup.push(id + '=' + rows[k]); else rows[k] = id;
  if (!new RegExp('CRE_LOOK\\.' + id + ' = \\{ b: \'c_' + id + '\'').test(h)) bad.push(id + ':look');
}
ok(ids.length === 101 && !bad.length, 'las ' + ids.length + ' criaturas tienen sprite propio de 16×16' + (bad.length ? ' (fallan: ' + bad.join(',') + ')' : ''));
ok(!dup.length, 'no hay dos sprites idénticos' + (dup.length ? ' (' + dup.join(',') + ')' : ''));
console.log(fails ? fails + ' FALLOS' : 'OK');
process.exit(fails ? 1 : 0);
