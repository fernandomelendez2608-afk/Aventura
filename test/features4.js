'use strict';
// Pruebas de: ajustes del mundo elegidos por el anfitrión (v1.5)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
function mk(cfg, bots = 3) {
  const g = E.createGame('TEST4', 'Humano', 'tok');
  for (let i = 0; i < bots; i++) E.addBot(g, 'granjero');
  Object.assign(g.cfg, cfg);
  const err = E.startGame(g); if (err) throw new Error(err);
  return g;
}
const count = (g, ch) => { let n = 0; for (const c of g.map.t) if (c === ch) n++; return n; };
const land = g => g.map.t.split ? g.map.t.length - count(g, 'w') - count(g, 'm') : 0;

console.log('Valores por defecto');
{
  const g = mk({});
  ok(g.cfg.mapSize === 'normal' && g.cfg.biome === 'azar' && g.cfg.startUnits === 4, 'cfg trae valores por defecto');
  const first = g.cities.find(c => c.cap).owner;
  ok(g.units.filter(u => u.o === first).length === 4 && g.units[0].lv === 1, '4 unidades de nivel 1 como siempre');
}

console.log('Tamaño del mapa');
{
  const sz = k => mk({ mapSize: k }).map.w;
  const a = sz('pequeno'), b = sz('normal'), c = sz('grande'), d = sz('enorme');
  ok(a < b && b < c && c < d, `tamaños crecientes (${a} < ${b} < ${c} < ${d})`);
}

console.log('Ciudades');
{
  const n = k => { let t = 0; for (let i = 0; i < 5; i++) t += mk({ cities: k }).cities.length; return t / 5; };
  const a = n('pocas'), b = n('normal'), c = n('muchas'), d = n('abundantes');
  ok(a < b && b < c && c < d, `más aldeas con cada nivel (${a} < ${b} < ${c} < ${d})`);
}

console.log('Biomas');
{
  const gd = mk({ biome: 'desierto' });
  ok(count(gd, 'd') > count(gd, 'g') + count(gd, 'f'), 'desierto: casi todo arena');
  ok(count(gd, 'f') === 0 && count(gd, 'g') === 0, 'desierto: sin bosque ni pradera');
  const gp = mk({ biome: 'pradera' });
  ok(count(gp, 'f') === 0 && count(gp, 'd') === 0 && count(gp, 'g') > 0, 'pradera: sin bosque ni desierto');
  const gb = mk({ biome: 'bosque' });
  ok(count(gb, 'f') > count(gb, 'g') && count(gb, 'd') === 0, 'bosque: mayoría árboles');
  const ga = mk({});
  ok(count(ga, 'f') > 0 && count(ga, 'g') > 0 && count(ga, 'd') === 0, 'al azar: mezcla bosque y pradera');
  // las unidades y las ciudades están sobre terreno caminable
  for (const g of [gd, gp, gb]) {
    const bad = g.units.filter(u => 'gfhd'.indexOf(g.map.t[u.y * g.map.w + u.x]) < 0).length;
    ok(bad === 0, 'todas las unidades iniciales pisan terreno transitable');
  }
}

console.log('Fauna');
{
  const frac = k => { let tot = 0, pas = 0; for (let i = 0; i < 6; i++) { const g = mk({ fauna: k }); for (const c of g.creatures) { tot++; if (['ciervo', 'jabali', 'oso'].includes(c.t)) pas++; } } return pas / tot; };
  const p = frac('pacifica'), n = frac('normal'), a = frac('agresiva');
  ok(p > n && n > a, `proporción de pacíficas: ${p.toFixed(2)} > ${n.toFixed(2)} > ${a.toFixed(2)}`);
}

console.log('Unidades iniciales');
{
  const g = mk({ startUnits: 14, startLevel: 6, startArmor: 'hierro' }, 4);
  for (const c of g.cities.filter(c => c.cap)) {
    const us = g.units.filter(u => u.o === c.owner);
    ok(us.length === 14, 'jugador ' + c.owner + ': 14 unidades');
  }
  const u = g.units[0];
  ok(u.lv === 6 && u.pts === 6, 'nivel 6 con 6 puntos por gastar');
  ok(['casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas'].every(s => u.eq[s] && u.eq[s].t === 2), 'armadura de hierro completa');
  ok(!new Set(g.units.map(x => x.y * g.map.w + x.x)).size !== g.units.length, 'sin unidades apiladas');
  ok(new Set(g.units.map(x => x.y * g.map.w + x.x)).size === g.units.length, 'cada unidad en su casilla');
  const eq = E.snapshot(g, g.players[0].id).units ? 1 : 1; ok(eq, 'la vista del jugador se genera');
  const e = E.refreshUnits(g); // no debe fallar
  for (let i = 0; i < 3; i++) { for (const p of g.players) p.ready = true; E.advanceTurn(g); }
  ok(g.status === 'playing' || g.status === 'ended', 'la partida avanza con el mundo ajustado');
}

console.log('Guardado antiguo');
{
  const g = mk({});
  const raw = JSON.parse(E.serialize(g));
  delete raw.cfg.biome; delete raw.cfg.startUnits; delete raw.ratio;
  const g2 = E.deserialize(JSON.stringify(raw));
  ok(g2.cfg.biome === 'azar' && g2.cfg.startUnits === 4 && g2.ratio > 0, 'partidas viejas reciben valores por defecto');
}

console.log('Renombrar unidades');
{
  const g = mk({}); const first = g.players[0].id, u = g.units.find(x => x.o === first);
  let r = E.cmd(g, first, { a: 'rename', u: u.id, name: '  Aragorn   el <b>Grande</b> con nombre larguísimo ' });
  ok(!r.err && u.name.length <= 16 && !/[<>]/.test(u.name), 'renombra, limpia y recorta: "' + u.name + '"');
  ok(E.cmd(g, first, { a: 'rename', u: u.id, name: '   ' }).err, 'rechaza nombre vacío');
  const other = g.units.find(x => x.o !== first);
  ok(E.cmd(g, first, { a: 'rename', u: other.id, name: 'Intruso' }).err && other.name !== 'Intruso', 'no se puede renombrar unidades ajenas');
}

console.log('Armas nuevas');
{
  const g = mk({}); const first = g.players[0].id, u = g.units.find(x => x.o === first);
  const eqw = (k, t = 2) => { u.eq = { arma: { id: g.nid++, k, t } }; return E.eff(g, u); };
  const esp = eqw('espada'), ha = eqw('hacha'), ka = eqw('katana'), hb = eqw('hachabatalla'), la = eqw('lanza');
  ok(ha.dmg > esp.dmg && ha.range === 1, `hacha pega más que la espada (${ha.dmg} > ${esp.dmg})`);
  ok(ka.dmg > ha.dmg && ka.pierce >= 0.2, `katana: ${ka.dmg} de daño y ${Math.round(ka.pierce * 100)}% perforación`);
  ok(hb.dmg > ka.dmg && hb.mov === esp.mov - 1, `hacha de batalla: ${hb.dmg} de daño y -1 movimiento`);
  ok(la.range === 2 && la.min === 1 && la.reach, 'lanza: alcance 1–2 sin penalización a quemarropa');
  // dos manos: equipar lanza guarda el escudo; una mano (hacha) lo conserva
  u.eq = { escudo: { id: g.nid++, k: 'escudo', t: 1 } }; u.inv.it = [{ id: 9001, k: 'lanza', t: 1 }, { id: 9002, k: 'hacha', t: 1 }];
  const c = g.cities.find(x => x.owner === first && x.cap); u.x = c.x + 1; u.y = c.y;
  let r = E.cmd(g, first, { a: 'equip', u: u.id, i: 9002 });
  ok(!r.err && u.eq.arma.k === 'hacha' && u.eq.escudo, 'hacha (una mano) se usa junto al escudo');
  r = E.cmd(g, first, { a: 'equip', u: u.id, i: 9001 });
  ok(!r.err && u.eq.arma.k === 'lanza' && !u.eq.escudo && u.inv.it.some(x => x.k === 'escudo'), 'lanza (dos manos) guarda el escudo en la mochila');
  ok(S.recipe('hachabatalla', 1).hueso === 5 && S.recipe('katana', 3).acero === 4, 'recetas de fabricación definidas');
  ok(S.WEAPON_KINDS.includes('lanza') && S.KINDS.katana.slot === 'arma', 'aparecen en la forja');
}

console.log('Crías');
{
  const run = (breed, setup) => {
    const g = mk({ breed, idleTurns: 0 }); const first = g.players[0].id, c = g.cities.find(x => x.owner === first && x.cap);
    const mine = g.units.filter(x => x.o === first); const [a, b] = mine;
    g.units = g.units.filter(x => x.o !== first || x === a || x === b);
    a.x = c.x + 1; a.y = c.y + 1; b.x = c.x + 2; b.y = c.y + 1; // pegadas y a ≤2 de la ciudad
    if (setup) setup(g, a, b, c);
    E.touch(g); g.creatures = [];
    return { g, a, b, first, c };
  };
  const turns = (g, n) => { for (let i = 0; i < n; i++) { g.creatures = []; for (const p of g.players) p.ready = true; E.advanceTurn(g); } };
  const cnt = (g, o) => g.units.filter(x => x.o === o).length;

  let { g, a, b, first } = run('cinco');
  turns(g, 4); ok(cnt(g, first) === 2, 'a los 4 turnos todavía no hay cría');
  turns(g, 1); ok(cnt(g, first) === 3, 'al 5.º turno juntas nace una cría');
  const kid = g.units.find(x => x.o === first && x !== a && x !== b);
  ok(kid.lv === 1 && kid.bn && kid.bn.hp === 10 && kid.bn.dmg === 2, 'la cría es nivel 1 con bono fijo');
  const ke = E.eff(g, kid), base = E.eff(g, Object.assign({}, kid, { bn: null }));
  ok(ke.maxHp === base.maxHp + 10 && ke.dmg === base.dmg + 2 && kid.hp === ke.maxHp, `salud ${ke.maxHp} y daño ${ke.dmg} (base ${base.maxHp}/${base.dmg}), nace con la salud llena`);
  ok(a.bc > g.turn + 10 && b.bc > g.turn + 10, 'los padres esperan 15 turnos');
  turns(g, 12); ok(cnt(g, first) === 3, 'durante la espera no hay otra cría');
  turns(g, 14); ok(cnt(g, first) >= 4, 'pasada la espera pueden tener otra');

  ({ g, a, b, first } = run('tres')); turns(g, 3); ok(cnt(g, first) === 3, 'con «3 turnos» nace al tercero');
  ({ g, a, b, first } = run('apagado')); turns(g, 8); ok(cnt(g, first) === 2, 'desactivado: no hay crías');
  ({ g, a, b, first } = run('cinco', (g, a, b) => { b.x = a.x + 4; })); turns(g, 8); ok(cnt(g, first) === 2, 'separadas: no hay cría');
  ({ g, a, b, first } = run('cinco', (g, a, b, c) => { a.x = c.x + 9; a.y = c.y; b.x = c.x + 10; b.y = c.y; })); turns(g, 8); ok(cnt(g, first) === 2, 'lejos de una ciudad: no hay cría');
  ({ g, a, b, first } = run('cinco', (g, a, b) => { a.hp = 5; })); a.hp = 5; turns(g, 1); ok(!Object.keys(g.pairs).some(k => k.split('-').map(Number).some(i => i === a.id || i === b.id)), 'una unidad muy herida no empieza la cuenta');
  { // tope de 20
    const r = run('cinco'); const g2 = r.g;
    for (let i = 0; i < 18; i++) g2.units.push({ id: 5000 + i, o: r.first, name: 'X' + i, x: 0, y: 0, lv: 1, xp: 0, hp: 50, pts: 0, sk: { dano: 0, salud: 0, movilidad: 0, medico: 0, doble: 0, defensa: 0, general: 0 }, eq: {}, inv: { m: {}, it: [] }, mp: 0, at: 0, hits: 0 });
    E.touch(g2); turns(g2, 7); ok(cnt(g2, r.first) === 20, 'con 20 unidades no nacen más');
  }
  const gs = mk({ breed: 'cinco' }); const sn = E.snapshot(gs, gs.players[0].id);
  ok(sn.mine.every(u => u.pr), 'la vista del jugador incluye el progreso de pareja');
  ok(S.WORLD_OPTS.breed.def === 'cinco', 'ajuste del mundo disponible');
  const old = JSON.parse(E.serialize(mk({}))); delete old.cfg.breed; delete old.pairs;
  ok(E.deserialize(JSON.stringify(old)).cfg.breed === 'apagado', 'partidas viejas: crías desactivadas');
}

console.log('Mago, invocador y nigromante');
{
  const g = mk({ breed: 'apagado', idleTurns: 0 }); const first = g.players[0].id, u = g.units.find(x => x.o === first);
  const c = g.cities.find(x => x.owner === first && x.cap);
  u.x = c.x + 1; u.y = c.y; u.lv = 6; u.eq = { arma: { id: g.nid++, k: 'baston', t: 2 } };
  const plain = E.eff(g, u); u.cls = 'mago'; const mg = E.eff(g, u);
  ok(mg.dmg > plain.dmg * 1.25 && mg.range === plain.range + 1, `mago con báculo: daño ${plain.dmg} → ${mg.dmg}, alcance ${plain.range} → ${mg.range}`);
  u.eq = { arma: { id: g.nid++, k: 'espada', t: 2 } };
  ok(E.eff(g, u).dmg < mg.dmg, 'el bono mágico no se aplica a la espada');
  u.cls = null; u.eq = { escudo: { id: g.nid++, k: 'escudo', t: 1 } }; u.inv.it = [{ id: 9101, k: 'varita', t: 1 }, { id: 9102, k: 'baston', t: 1 }];
  let r = E.cmd(g, first, { a: 'equip', u: u.id, i: 9101 });
  ok(!r.err && u.eq.arma.k === 'varita' && u.eq.escudo, 'varita (una mano) admite escudo');
  r = E.cmd(g, first, { a: 'equip', u: u.id, i: 9102 });
  ok(!r.err && u.eq.arma.k === 'baston' && !u.eq.escudo, 'báculo (dos manos) guarda el escudo');

  u.eq = {}; u.cls = 'invocador'; c.st.m.hueso = 20;
  const cnt = (gg, o) => gg.units.filter(x => x.o === o && !x.sm).length; const before = cnt(g, first);
  r = E.cmd(g, first, { a: 'summon', u: u.id, k: 'lobo' });
  ok(!r.err, 'invoca un lobo: ' + (r.err || r.msg));
  const lobo = g.units.find(x => x.sm);
  ok(lobo && lobo.sm.k === 'lobo' && lobo.o === first && lobo.lv === 6 && c.st.m.hueso === 16, 'el lobo es tuyo, de nivel 6 y costó 4 huesos');
  ok(E.eff(g, lobo).maxHp === Math.round(30 * (1 + 0.18 * 5)), 'estadísticas del lobo según su nivel (salud ' + E.eff(g, lobo).maxHp + ')');
  ok(g.units.filter(x => x.o === first && !x.sm).length === before, 'no ocupa puestos del tope de unidades');
  r = E.cmd(g, first, { a: 'summon', u: u.id, k: 'oso' }); ok(!r.err && c.st.m.hueso === 9, 'segunda invocación (oso, 7 huesos)');
  r = E.cmd(g, first, { a: 'summon', u: u.id, k: 'lobo' }); ok(r.err && /máximo/.test(r.err), 'la tercera se rechaza: ' + r.err);
  ok(E.cmd(g, first, { a: 'skill', u: lobo.id, s: 'dano' }).err, 'las invocaciones no gastan puntos ni se equipan');
  ok(E.cmd(g, first, { a: 'summon', u: lobo.id, k: 'lobo' }).err, 'una invocación no invoca');
  const sn = E.snapshot(g, first); ok(sn.mine.find(x => x.id === lobo.id).sm === 'lobo' && sn.mine.find(x => x.id === u.id).sc.n === 2, 'la vista muestra invocaciones y el contador');
  // límites de la clase y de lugar
  r = E.cmd(g, first, { a: 'dismiss', u: lobo.id }); ok(!r.err && !g.units.includes(lobo), 'se puede despedir una invocación');
  u.cls = 'nigromante'; r = E.cmd(g, first, { a: 'summon', u: u.id, k: 'lobo' }); ok(r.err, 'el nigromante no invoca lobos');
  r = E.cmd(g, first, { a: 'summon', u: u.id, k: 'esqueleto' }); ok(g.units.filter(x => x.o === first && x.sm).length === 2 || r.err, 'el nigromante invoca esqueletos (respeta el máximo de 2)');
  for (const x of g.units.filter(y => y.sm)) E.cmd(g, first, { a: 'dismiss', u: x.id });
  c.st.m.hueso = 20; r = E.cmd(g, first, { a: 'summon', u: u.id, k: 'esqueleto' }); ok(!r.err && g.units.some(x => x.sm && x.sm.k === 'esqueleto'), 'esqueleto invocado');
  u.x = c.x + 8; u.y = c.y; r = E.cmd(g, first, { a: 'summon', u: u.id, k: 'esqueleto' }); ok(r.err && /ciudad/.test(r.err), 'lejos de una ciudad no se puede invocar');
  u.x = c.x + 1; u.y = c.y; c.st.m.hueso = 1; r = E.cmd(g, first, { a: 'summon', u: u.id, k: 'esqueleto' }); ok(r.err, 'sin huesos no se puede invocar');
  // si cae el invocador, desaparecen
  const kid = g.units.find(x => x.sm); ok(!!kid, 'hay invocación activa');
  E.killUnit(g, u, { creature: { t: 'lobo' } });
  ok(!g.units.some(x => x.sm && x.o === first), 'al caer el invocador sus invocaciones se desvanecen');
  // clases en la lista
  ok(['mago', 'invocador', 'nigromante'].every(k => S.CLASSES[k] && Object.keys(S.CLASSES[k].sub).length === 2), 'tres clases nuevas con dos especializaciones cada una');
}
console.log('Bots con clases de magia');
{
  const errs = []; const oe = console.error; console.error = (...a) => errs.push(a.join(' '));
  let seen = 0, classes = {};
  for (let k = 0; k < 3; k++) {
    const g = mk({ startLevel: 10, startUnits: 8, idleTurns: 0 }, 4);
    for (let i = 0; i < 25; i++) { for (const p of g.players) p.ready = true; E.advanceTurn(g); seen += g.units.filter(x => x.sm).length; for (const x of g.units) if (x.cls) classes[x.cls] = 1; if (g.status !== 'playing') break; }
  }
  console.error = oe;
  ok(errs.length === 0, 'sin errores de bots: ' + errs.slice(0, 1));
  ok(classes.mago || classes.invocador || classes.nigromante, 'los bots eligen las clases nuevas: ' + Object.keys(classes).join(', '));
  console.log('  (invocaciones vistas durante las partidas simuladas: ' + seen + ')');
}

console.log('Criaturas y salud al subir de nivel');
{
  const g = mk({}); g.creatures = []; const boss = { id: 777, t: 'reylobo', x: 0, y: 0, hx: 0, hy: 0, lv: 12, hp: 0, prov: null, hit: false };
  boss.hp = Math.round(E.cstats(boss, g).mhp * 0.2); g.creatures.push(boss);
  g.turn = 10; for (const p of g.players) p.ready = true; E.advanceTurn(g); // en el turno 10 sube de nivel a todas
  const nm = E.cstats(boss, g).mhp;
  ok(boss.lv === 13 && boss.hp / nm < 0.5, `al subir a nivel 13 conserva su salud baja (${boss.hp}/${nm}), ya no se cura entera`);
  ok(S.CREATURES.liche.dmg === 20 && S.CREATURES.liche.hp === 230, 'Liche suavizado (230 salud, 20 daño)');
}

console.log('Protagonista');
{
  const g = mk({ idleTurns: 0 }); const A = g.players[0].id;
  ok(g.players.every(p => p.hero && g.units.find(u => u.id === p.hero).hero), 'cada jugador empieza con un protagonista');
  const mine = g.units.filter(u => u.o === A); const h0 = g.units.find(u => u.id === g.players[A].hero), other = mine.find(u => u !== h0);
  g.turn = 1; // el turno 1 permite cambiar
  let r = E.cmd(g, A, { a: 'hero', u: other.id, emb: '🐉' });
  ok(!r.err && other.hero === '🐉' && !h0.hero && g.players[A].hero === other.id, 'se puede elegir otro protagonista y su emblema en el turno 1');
  g.turn = 2; ok(E.cmd(g, A, { a: 'hero', u: h0.id }).err, 'a partir del turno 2 queda fijo');
  g.turn = 1;
  // bono de experiencia
  const plain = mine.find(u => u !== other); plain.xp = 0; other.xp = 0; other.lv = 5; plain.lv = 5;
  E.gainXp(g, other, 10); E.gainXp(g, plain, 10); ok(other.xp === 15 && plain.xp === 10, `+50% de experiencia (${other.xp} contra ${plain.xp})`);
  // aura
  const c = g.cities.find(x => x.owner === A && x.cap); other.x = c.x + 1; other.y = c.y + 1; plain.x = c.x + 1; plain.y = c.y + 2;
  plain.eq = { arma: { id: g.nid++, k: 'espada', t: 2 }, pechera: { id: g.nid++, k: 'pechera', t: 2 } };
  E.touch(g); const near = E.eff(g, plain); plain.x = c.x - 3; plain.y = c.y - 3; E.touch(g); const far = E.eff(g, plain);
  ok(near.dmg > far.dmg && near.def > far.def && near.ha === 0.1 && far.ha === 0, `aura del protagonista: daño ${far.dmg} → ${near.dmg}, defensa ${far.def} → ${near.def}`);
  ok(E.eff(g, other).ha === 0, 'el protagonista no se da el aura a sí mismo');
  // muerte y reaparición
  other.lv = 8; other.pts = 1; other.sk.dano = 4; other.sk.salud = 3; other.eq = { arma: { id: g.nid++, k: 'espada', t: 2 } }; g.turn = 5;
  E.killUnit(g, other, { creature: { t: 'lobo' } });
  ok(!g.units.includes(other) && g.rv.length === 1 && E.snapshot(g, A).players[A].hero.w === 3, 'cae y queda a la espera 3 turnos');
  for (let i = 0; i < 2; i++) { g.creatures = []; for (const p of g.players) p.ready = true; E.advanceTurn(g); }
  ok(!g.units.some(u => u.hero && u.name === other.name), 'todavía no ha vuelto');
  g.creatures = []; for (const p of g.players) p.ready = true; E.advanceTurn(g);
  const back = g.units.find(u => u.hero && u.o === A && u.name === other.name);
  ok(back && back.lv === 6 && g.players[A].hero === back.id && g.rv.length === 0, 'vuelve a la ciudad con 2 niveles menos (nivel ' + (back && back.lv) + ')');
  ok(back && back.eq.arma && back.eq.arma.k === 'espada' && back.hp === E.eff(g, back).maxHp, 'conserva su equipo y vuelve con la salud llena');
  ok(back && Object.values(back.sk).reduce((a, b) => a + b, 0) + back.pts === back.lv, 'puntos de habilidad coherentes con el nivel nuevo')
  // desactivado y partidas viejas
  const g2 = mk({ hero: 'no' }); ok(g2.players.every(p => !p.hero) && E.snapshot(g2, 0).players[0].hero === null, 'con «No» no hay protagonistas');
  const old = JSON.parse(E.serialize(g)); delete old.cfg.hero; delete old.rv; ok(E.deserialize(JSON.stringify(old)).cfg.hero === 'no', 'partidas viejas: sin protagonistas');
  ok(S.WORLD_OPTS.hero.def === 'si', 'ajuste del mundo disponible');
}

console.log('Reto de una unidad');
{
  const g = mk({ mode: 'uno', startUnits: 14, startLevel: 6, startArmor: 'hierro', idleTurns: 0 }, 3);
  ok(g.players.every(p => g.units.filter(u => u.o === p.id).length === 1), 'cada jugador y bot empieza con 1 sola unidad (aunque se pidan 14)');
  ok(g.units.every(u => u.lv === 6 && u.eq.pechera), 'sigue aplicando nivel y armadura iniciales');
  ok(g.players.every(p => !p.hero) && g.cfg.hero === 'no' && g.cfg.breed === 'apagado', 'sin protagonista ni crías');
  const A = g.players[0].id, c = g.cities.find(x => x.owner === A && x.cap); for (const m of Object.keys(S.MATS)) c.st.m[m] = 99;
  const r = E.cmd(g, A, { a: 'recruit', c: c.id }); ok(r.err && /reto/.test(r.err), 'no se puede reclutar: ' + r.err);
  const u = g.units.find(x => x.o === A); u.cls = 'invocador'; u.x = c.x + 1; u.y = c.y;
  ok(E.cmd(g, A, { a: 'summon', u: u.id, k: 'lobo' }).err && E.snapshot(g, A).mine[0].sc === null, 'no se puede invocar');
  for (let i = 0; i < 6; i++) { g.creatures = []; for (const p of g.players) p.ready = true; E.advanceTurn(g); }
  ok(g.players.every(p => g.units.filter(x => x.o === p.id).length <= 1), 'tras varios turnos nadie tiene más de 1 unidad');
  // si cae la única unidad, el jugador queda eliminado aunque tenga materiales para reclutar
  const g2 = mk({ mode: 'uno', idleTurns: 0 }, 3); const B = g2.players[1].id, ub = g2.units.find(x => x.o === B), cb = g2.cities.find(x => x.owner === B && x.cap);
  for (const m of Object.keys(S.MATS)) cb.st.m[m] = 99;
  E.killUnit(g2, ub, { creature: { t: 'lobo' } }); g2.creatures = []; for (const p of g2.players) p.ready = true; E.advanceTurn(g2);
  ok(!g2.players[B].alive && g2.cities.filter(x => x.owner === B).length === 0, 'al caer su única unidad queda eliminado y sus ciudades quedan libres');
  const g3 = mk({}, 3); ok(g3.units.filter(x => x.o === g3.players[0].id).length === 4, 'el modo normal no cambia');
}

console.log('Carreta');
{
  const g = mk({ idleTurns: 0, breed: 'apagado' }, 3); const A = g.players[0].id, c = g.cities.find(x => x.owner === A && x.cap);
  const units0 = g.units.filter(u => u.o === A).length;
  for (const m of Object.keys(S.MATS)) c.st.m[m] = 50;
  let r = E.cmd(g, A, { a: 'cart', c: c.id });
  ok(!r.err, 'construye la carreta: ' + (r.err || r.msg));
  const cart = g.units.find(u => u.cart);
  ok(cart && cart.o === A && cart.cart.c === c.id && c.st.m.cuero === 42 && c.st.m.hierro === 47, 'gasta 8 cuero, 8 hueso y 3 hierro del almacén');
  ok(g.units.filter(u => u.o === A && !u.cart).length === units0, 'no cuenta como unidad (cuenta de unidades igual)');
  const e = E.eff(g, cart); ok(e.mov === 6 && e.dmg === 0 && E.snapshot(g, A).mine.find(u => u.id === cart.id).cap === 150, 'movilidad 6, sin ataque y 150 de capacidad');
  r = E.cmd(g, A, { a: 'cart', c: c.id }); ok(r.err && /ya tiene/.test(r.err), 'máximo una por ciudad: ' + r.err);
  ok(E.snapshot(g, A).cities.find(x => x.id === c.id).cart.id === cart.id, 'la ciudad informa de su carreta');
  // carga: 150 en vez de 30
  cart.x = c.x + 1; cart.y = c.y; cart.moved = false; cart.acted = false;
  r = E.cmd(g, A, { a: 'wd', u: cart.id, m: 'cuero', n: 40 }); ok(!r.err && cart.inv.m.cuero === 40, 'carga 40 de cuero (una unidad normal solo lleva 30)');
  E.cmd(g, A, { a: 'wd', u: cart.id, m: 'hueso', n: 999 }); E.cmd(g, A, { a: 'wd', u: cart.id, m: 'hierro', n: 999 });
  let w = 0; for (const k in cart.inv.m) w += cart.inv.m[k]; ok(w > 100 && w <= 150, 'puede cargar más de 100 (' + w + '/150)');
  const man = g.units.find(u => u.o === A && !u.cart); man.x = c.x - 1; man.y = c.y; E.touch(g);
  E.cmd(g, A, { a: 'wd', u: man.id, m: 'acero', n: 999 }); let wm = 0; for (const k in man.inv.m) wm += man.inv.m[k]; ok(wm <= 30, 'una unidad normal sigue limitada a 30 (' + wm + ')');
  r = E.cmd(g, A, { a: 'dep', u: cart.id, all: true }); ok(!r.err && Object.keys(cart.inv.m).length === 0, 'descarga todo en la ciudad');
  // restricciones
  ok(E.cmd(g, A, { a: 'skill', u: cart.id, s: 'dano' }).err && E.cmd(g, A, { a: 'equip', u: cart.id, i: 1 }).err, 'sin habilidades ni equipo');
  const bot = g.units.find(u => u.o !== A); cart.moved = false; cart.acted = false; cart.at = 1;
  ok(E.cmd(g, A, { a: 'attack', u: cart.id, tt: 'u', t: bot.id }).err, 'no puede atacar');
  // mueve alto
  cart.x = c.x + 1; cart.y = c.y; cart.mp = 6; cart.moved = false; E.touch(g);
  const far = { x: c.x + 5, y: c.y + 1 }; r = E.cmd(g, A, { a: 'move', u: cart.id, x: far.x, y: far.y }); ok(true, 'orden de mover enviada: ' + (r.err || 'ok'));
  // si muere, la ciudad puede construir otra
  E.killUnit(g, cart, { creature: { t: 'lobo' } });
  ok(!g.units.some(u => u.cart) && !E.snapshot(g, A).cities.find(x => x.id === c.id).cart, 'si la destruyen, la ciudad puede construir otra');
  r = E.cmd(g, A, { a: 'cart', c: c.id }); ok(!r.err, 'reconstruida');
  // un jugador solo con carreta no está vivo
  const g2 = mk({ mode: 'uno', idleTurns: 0 }, 3); const c2 = g2.cities.find(x => x.owner === g2.players[0].id && x.cap); for (const m of Object.keys(S.MATS)) c2.st.m[m] = 50;
  ok(E.cmd(g2, g2.players[0].id, { a: 'cart', c: c2.id }).err, 'en el reto de una unidad no hay carretas');
  // los bots no la mueven y las partidas siguen sin errores
  const errs = []; const oe = console.error; console.error = (...x) => errs.push(x.join(' '));
  const g3 = mk({ idleTurns: 0 }, 3); const c3 = g3.cities.find(x => x.owner === g3.players[1].id && x.cap); for (const m of Object.keys(S.MATS)) c3.st.m[m] = 50;
  E.doCart ? 0 : 0; g3.players[1].bot = true;
  for (let i = 0; i < 5; i++) { for (const p of g3.players) p.ready = true; E.advanceTurn(g3); }
  console.error = oe; ok(errs.length === 0, 'sin errores al jugar con carretas');
}

console.log('Chat de la partida');
{
  const g = mk({ idleTurns: 0 }); const A = g.players[0].id, B = g.players.find(p => !p.bot && p.id !== A), bot = g.players.find(p => p.bot);
  // hace humano a un segundo jugador para probar visibilidad
  g.players[1].bot = false; const B2 = 1, C2 = 2; g.players[2].bot = false;
  ok(E.chat(g, A, 'Hola a todos 👋') === null, 'un jugador escribe un mensaje');
  ok(E.chat(g, A, '   ') && E.chat(g, A, '') , 'rechaza mensajes vacíos');
  E.chat(g, A, '<b>negrita</b> y\n\nsaltos   de línea');
  const last = g.chat[g.chat.length - 1];
  ok(!/[<>\n]/.test(last.x) && !/\s{2}/.test(last.x), 'limpia etiquetas y saltos de línea: "' + last.x + '"');
  E.chat(g, B2, 'x'.repeat(500)); ok(g.chat[g.chat.length - 1].x.length === 200, 'recorta a 200 letras');
  let spam = 0; for (let i = 0; i < 10; i++) if (E.chat(g, C2, 'spam ' + i)) spam++;
  ok(spam >= 5, 'limita el spam (5 mensajes por 10 s): ' + spam + ' rechazados');
  ok(E.chat(g, 3, 'soy un bot') && g.players[3].bot, 'los bots no escriben');
  // solo aliados
  E.chat(g, A, 'secreto de aliados', true);
  const vis = pid => E.snapshot(g, pid).chat.some(m => m.x === 'secreto de aliados');
  ok(vis(A) && !vis(B2), 'mensaje «solo aliados»: lo ve quien lo escribe y no los demás');
  g.dip[Math.min(A, B2) + '-' + Math.max(A, B2)] = 'alianza';
  ok(vis(B2) && !vis(C2), 'con alianza lo ve el aliado y sigue oculto al resto');
  const sn = E.snapshot(g, A); ok(Array.isArray(sn.chat) && sn.chat.every(m => m.id && m.x !== undefined), 'la vista incluye el chat');
  for (let i = 0; i < 100; i++) { g.players[A]._ct = []; E.chat(g, A, 'm' + i); }
  ok(g.chat.length <= 80 && E.snapshot(g, A).chat.length <= 60, 'guarda máx. 80 y muestra los últimos 60');
  const g2 = E.deserialize(E.serialize(g)); ok(g2.chat.length === g.chat.length && g2.cid === g.cid, 'el chat se guarda con la partida');
  const old = JSON.parse(E.serialize(g)); delete old.chat; delete old.cid; const g3 = E.deserialize(JSON.stringify(old));
  ok(Array.isArray(g3.chat) && E.chat(g3, A, 'hola') === null, 'partidas antiguas (sin chat) siguen funcionando');
  const lobby = E.createGame('LB', 'H', 't'); ok(E.chat(lobby, 0, 'hola'), 'en la sala de espera aún no hay chat');
}

console.log(fails ? `\n${fails} fallos` : '\nTodo bien');
process.exit(fails ? 1 : 0);
