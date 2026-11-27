// v1.81.0: menús de clase, equipo y mochila rediseñados (comprobación estática del cliente)
const fs = require('fs');
const h = fs.readFileSync(__dirname + '/../public/index.html', 'utf8');
let bad = 0;
for (const k of ['function itemCard', 'function slotCard', 'const matTiles', 'class="slotg"', 'capw', 'clcard', 'gsum', "data-c='${jattr({ a: 'equip'", 'unequip'])
  if (!h.includes(k)) { console.log('FALTA', k); bad++; }
for (const k of ['.rb0', '.rb5', '.ic.hi', '.sl.empty', '.capw', '.mt{', '.clcard', '.cltag'])
  if (!h.includes(k)) { console.log('FALTA css', k); bad++; }
if (bad) process.exit(1);
console.log('features51 OK');
