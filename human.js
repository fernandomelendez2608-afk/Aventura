const E = require('../engine.js'), S = require('../public/shared.js');
const g = E.createGame('H', 'Ana', 't'); E.addBot(g); E.startGame(g);
const ok = (name, r) => console.log((r.err ? '✗ ' : '✓ ') + name, r.err || r.msg || '');
const u = g.units.find(x => x.o === 0), city = g.cities.find(c => c.owner === 0);
// forjar espada + pechera, tomar y equipar
ok('forjar espada', E.cmd(g, 0, { a: 'craft', c: city.id, k: 'espada', tr: 1 }));
ok('forjar pechera', E.cmd(g, 0, { a: 'craft', c: city.id, k: 'pechera', tr: 1 }));
for (const it of city.st.it.slice()) { ok('tomar ' + S.itemName(it), E.cmd(g, 0, { a: 'wdi', u: u.id, i: it.id })); ok('equipar', E.cmd(g, 0, { a: 'equip', u: u.id, i: it.id })); }
console.log('equipo', Object.keys(u.eq), 'stats', JSON.stringify(E.eff(g, u)));
// crear un ciervo pegado a la unidad y atacarlo hasta matarlo
const free = [[1,0],[0,1],[-1,0],[0,-1]].map(d => ({ x: u.x + d[0], y: u.y + d[1] })).find(p => !E.idx(g).U.has(p.y * g.map.w + p.x) && !E.idx(g).T.has(p.y * g.map.w + p.x) && 'gfh'.includes(g.map.t[p.y * g.map.w + p.x]));
g.creatures.push({ id: 9999, t: 'ciervo', x: free.x, y: free.y, hx: free.x, hy: free.y, lv: 1, hp: 22, prov: null, hit: false }); E.touch(g);
for (let i = 0; i < 6; i++) { const r = E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: 9999 }); ok('atacar', r); if (r.err || /Derrotado/.test(r.msg)) break; u.at = 1; u.mp = 3; }
console.log('mochila', JSON.stringify(u.inv), 'xp', u.xp, 'lv', u.lv);
ok('depositar', E.cmd(g, 0, { a: 'dep', u: u.id, all: true })); console.log('almacén', JSON.stringify(city.st.m));
ok('reclutar', E.cmd(g, 0, { a: 'recruit', c: city.id }));
ok('habilidad doble', E.cmd(g, 0, { a: 'skill', u: u.id, s: 'doble' }));
ok('habilidad doble otra vez (debe fallar)', E.cmd(g, 0, { a: 'skill', u: u.id, s: 'doble' }));
ok('mover lejos (debe fallar)', E.cmd(g, 0, { a: 'move', u: u.id, x: u.x + 15, y: u.y }));
ok('listo', E.cmd(g, 0, { a: 'ready', v: true }));
E.advanceTurn(g); console.log('turno', g.turn, 'unidades', g.units.filter(x => x.o === 0).length);
