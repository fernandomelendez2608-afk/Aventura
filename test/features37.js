// v1.70.0: tutorial actualizado + misiones guiadas (comprobación estática del cliente)
const fs = require('fs'), path = require('path');
const h = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
let n = 0; const ok = (c, m) => { if (!c) { console.error('FALLA:', m); process.exit(1); } n++; };
ok(/id="quest"/.test(h), 'banner #quest');
ok(/function qSteps\(/.test(h) && /function qTick\(/.test(h) && /function drawQuest\(/.test(h), 'módulo de misiones');
ok(/drawQuest\(ox, oy, z\)/.test(h), 'flecha dibujada en el mapa');
ok(/m === 'ciudadela'\) st\.push/.test(h), 'tarjeta de la Ciudadela');
ok(/hasta el 99/.test(h) && /árbol de habilidades/.test(h), 'texto de nivel 99 y árbol');
ok(/♂ \+ ♀/.test(h), 'texto de crías con pareja');
ok(/Misiones guiadas/.test(h) && /tutClose\(true\)/.test(h), 'el tutorial arranca las misiones');
ok(/ada_q/.test(h), 'persistencia de misiones');
const m = h.match(/<script>([\s\S]*?)<\/script>/g).map(s => s.replace(/<\/?script>/g, '')).sort((a, b) => b.length - a.length)[0];
try { new Function(m); } catch (e) { ok(false, 'sintaxis del cliente: ' + e.message); }
console.log('features37 OK (' + n + ' comprobaciones)');
{ const h2 = require('fs').readFileSync(require('path').join(__dirname, '../public/index.html'), 'utf8'); if (!/function tipsCheck\(/.test(h2) || !/ada_tips/.test(h2)) { console.error('FALLA: consejos'); process.exit(1); } console.log('consejos OK'); }
