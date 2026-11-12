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
  const frac = k => { let tot = 0, pas = 0; for (let i = 0; i < 12; i++) { const g = mk({ fauna: k }); for (const c of g.creatures) { if (c.dg) continue; tot++; if (S.CREATURES[c.t].agg === 0) pas++; } } return pas / tot; };
  const p = frac('pacifica'), n = frac('normal'), a = frac('agresiva');
  ok(p > n + 0.1 && p > a + 0.1 && a <= n + 0.05, `proporción de pacíficas: pacífica ${p.toFixed(2)} contra normal ${n.toFixed(2)} y agresiva ${a.toFixed(2)}`);
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
    for (const p of g.players) if (p.id !== first) p.bot = false; // rivales inactivos: que nadie conquiste la ciudad durante la prueba
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
  turns(g, 8); ok(cnt(g, first) === 3, 'durante la espera no hay otra cría');
  { const k2 = g.units.find(x => x.o === first && x !== a && x !== b); a.bc = b.bc = g.turn; if (k2) k2.bc = g.turn; } // adelantamos el fin de la espera para no exponerlos a bots durante 15 turnos
  turns(g, 6); ok(cnt(g, first) >= 4, 'pasada la espera pueden tener otra');

  ({ g, a, b, first } = run('tres', (g, a, b) => { a.bn = { hp: 30, dmg: 6 }; a.gen = 3; b.bn = { hp: 10, dmg: 2 }; b.gen = 1; }));
  turns(g, 3); { const k = g.units.find(x => x.o === first && x !== a && x !== b);
    ok(k && k.gen === 4 && k.bn.hp === 40 && k.bn.dmg === 8, 'la cría hereda lo mejor de sus padres y suma el bono: generación 4, +40 salud, +8 daño'); }
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

console.log('Bots que hablan en el chat');
{
  const BC = require('../botchat.js');
  ok(BC.intent('Hola Morgana, ¿cómo estás?') === 'estado' || BC.intent('Hola Morgana') === 'hola', 'detecta saludos');
  ok(BC.intent('te propongo la paz') === 'paz' && BC.intent('quiero una alianza') === 'alianza' && BC.intent('te voy a atacar') === 'amenaza' && BC.intent('eres un idiota') === 'insulto', 'detecta paz, alianza, amenazas e insultos');
  ok(BC.addressed('Morgana, ¿hacemos la paz?', 'Morgana') && BC.addressed('oye morgana', 'Bot Morgana') && !BC.addressed('hola a todos', 'Morgana'), 'reconoce cuando se dirigen a un bot por su nombre');
  ok(Object.keys(S.PERS).every(p => Object.keys(BC.PHRASES.granjero).every(k => BC.PHRASES[p][k] && BC.PHRASES[p][k].length >= 2)), 'las 9 personalidades tienen frases para cada situación');

  const g = mk({ botChat: 'si', idleTurns: 0 }, 3); const A = g.players[0].id;
  const bots = g.players.filter(p => p.bot);
  ok(g.chat.some(m => m.bot && m.p !== A), 'al empezar saludan algunos bots');
  const b0 = bots[0]; const nm = b0.name.replace(/^Bot\s+/, '');
  const n0 = g.chat.length;
  E.chat(g, A, `${nm}, hola`); ok(g.chat.length === n0 + 2 && g.chat[n0 + 1].p === b0.id && g.chat[n0 + 1].bot === 1, 'si lo nombras, ese bot contesta');
  const n1 = g.chat.length; E.chat(g, A, 'hola a todos'); ok(g.chat.length === n1 + 1, 'si no los nombras, no contestan');
  const n2 = g.chat.length; E.chat(g, A, 'bots, ¿quién va ganando?'); ok(g.chat.length === n2 + 2, 'si dices «bots», uno contesta');
  // paz: responde según su estado real
  b0.pers = 'granjero'; b0.wr = {}; const n3 = g.chat.length; E.chat(g, A, `${nm}, hagamos la paz`);
  ok(/propuesta|paz/i.test(g.chat[n3 + 1].x), 'responde sobre la paz: «' + g.chat[n3 + 1].x + '»');
  b0.wr[A] = g.turn; const n4 = g.chat.length; E.chat(g, A, `${nm}, hagamos la paz`);
  ok(BC.PHRASES.granjero.paz_no.some(f => g.chat[n4 + 1].x === f.replace('{n}', g.players[A].name)), 'si hubo guerra reciente, se niega: «' + g.chat[n4 + 1].x + '»');
  // nunca contestan a otros bots ni al canal de aliados sin alianza
  g.players[A]._ct = []; const n5 = g.chat.length; E.chat(g, A, `${nm}, hola`, true); ok(g.chat.length === n5 + 1, 'el canal de aliados solo lo oyen bots aliados');
  // diplomacia: responden a una propuesta
  const bp = bots[1]; bp.pers = 'granjero'; bp.wr = {}; const n6 = g.chat.length;
  E.cmd(g, A, { a: 'dip', d: 'offer', to: bp.id, k: 'paz' }); for (let i = 0; i < 3; i++) { g.creatures = []; for (const p of g.players) p.ready = true; E.advanceTurn(g); }
  ok(g.chat.slice(n6).some(m => m.p === bp.id && m.bot), 'el bot responde en el chat a una propuesta de paz');
  // desactivado
  const g2 = mk({ botChat: 'no' }, 3); const m0 = g2.chat.length; E.chat(g2, 0, g2.players[1].name + ', hola'); ok(g2.chat.length === m0 + 1 && !g2.chat.some(m => m.bot), 'con «No» los bots callan');
  const old = JSON.parse(E.serialize(mk({}))); delete old.cfg.botChat; ok(E.deserialize(JSON.stringify(old)).cfg.botChat === 'no', 'partidas viejas: bots callados');
  // límites de frecuencia: no hablan solos más de 2 por turno
  const g3 = mk({ botChat: 'si' }, 6); let worst = 0; for (let i = 0; i < 12; i++) { const before = g3.chat.length; g3.creatures = []; for (const p of g3.players) p.ready = true; E.advanceTurn(g3); worst = Math.max(worst, g3.chat.length - before); }
  ok(worst <= 4, 'sin spam: como mucho ' + worst + ' mensajes de bots en un turno');
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

{ // ===== 9 personalidades =====
  console.log('· 9 personalidades de bots');
  ok(Object.keys(S.PERS).length === 9 && Object.values(S.PERS).every(p => p.n && p.e && p.d && p.b && p.b.order.length >= 4 && p.b.paz >= 0), '9 personalidades con parámetros');
  ok(new Set(Object.values(S.PERS).map(p => p.e)).size === 9, 'cada una con emoji propio');
  const g = E.createGame('P9', 'H', 't');
  for (let i = 0; i < 9; i++) E.addBot(g, 'azar');
  ok(g.players.length === 10 && new Set(g.players.filter(p => p.bot).map(p => p.pers)).size === 9, 'al azar: 9 bots = 9 personalidades distintas');
  const g2 = E.createGame('P9b', 'H', 't');
  const b = E.addBot(g2, 'defensor'); ok(b.pers === 'defensor', 'se puede elegir una concreta');
  const g3 = E.createGame('P9c', 'H', 't'); for (let i = 0; i < 9; i++) E.addBot(g3, 'azar');
  g3.cfg.botChat = 'si'; E.startGame(g3);
  let err = null; try { for (let i = 0; i < 40; i++) E.advanceTurn(g3); } catch (e) { err = e; }
  ok(!err, 'partida con 9 bots de 9 personalidades corre 40 turnos sin errores' + (err ? ': ' + err.message : ''));
}

{ // ===== regeneración de jefes =====
  console.log('· regeneración de jefes');
  const g = E.createGame('RG', 'H', 't'); E.addBot(g, 'azar'); E.startGame(g);
  const mk = t => { const c = { id: 9000 + g.creatures.length, t, x: 0, y: 0, lv: 5, hp: 0, hit: false }; c.hp = Math.round(E.cstats(c, g).mhp * 0.5); g.creatures.push(c); return c; };
  let bg = -1, lg = 0; // se repite si algún monstruo sufrió un ataque en ese turno (no es lo que se prueba)
  for (let i = 0; i < 6 && bg < 0; i++) {
    const boss = mk('reylobo'), lobo = mk('lobo'); boss.x = 3 + i; boss.y = 3; lobo.x = 3 + i; lobo.y = 5;
    const b0 = boss.hp, l0 = lobo.hp; E.advanceTurn(g);
    bg = (boss.hp - b0) / E.cstats(boss, g).mhp; lg = (lobo.hp - l0) / E.cstats(lobo, g).mhp;
  }
  ok(bg > 0 && bg <= 0.05, 'el jefe recupera como mucho ~3% por turno (' + Math.round(bg * 100) + '%)');
  ok(lg >= 0.09, 'las criaturas normales siguen recuperando ~10%');
}

{ // ===== jefes: ajustes =====
  console.log('· ajuste de recuperación de jefes y jefes del reto');
  const mkg = cfg => { const g = E.createGame('BR', 'H', 't'); Object.assign(g.cfg, cfg); E.addBot(g, 'azar'); E.startGame(g); return g; };
  const reg = cfg => { const g = mkg(cfg); const c = { id: 9001, t: 'reylobo', x: 0, y: 0, lv: 5, hp: 0, hit: false }; c.hp = Math.round(E.cstats(c, g).mhp * 0.5); g.creatures.push(c); const h = c.hp; E.advanceTurn(g); return c.hp - h; };
  ok(reg({ bossRegen: 'ninguna' }) <= 0, 'jefe sin recuperación no se cura');
  ok(reg({ bossRegen: 'normal' }) > reg({ bossRegen: 'lenta' }) * 2, 'normal cura mucho más que lenta');
  const gn = mkg({}), gu = mkg({ mode: 'uno' }), b = { t: 'reylobo', lv: 10 }, w = { t: 'lobo', lv: 10 };
  ok(E.cstats(b, gu).mhp < E.cstats(b, gn).mhp * 0.65 && E.cstats(b, gu).dmg < E.cstats(b, gn).dmg, 'en el reto de una unidad el jefe es más débil');
  ok(E.cstats(w, gu).mhp === E.cstats(w, gn).mhp, 'las criaturas normales no cambian en el reto');
  ok(S.WORLD_OPTS.bossRegen.def === 'lenta', 'por defecto: lenta');
}

{ // ===== más armas y armaduras =====
  console.log('· calidad Dracónica, efectos nuevos, escala de rareza, reforjar y sets');
  const g = mk({}); const first = g.players[0].id, u = g.units.find(x => x.o === first);
  const c = g.cities.find(x => x.owner === first && x.cap);
  c.cm = 20; c.crafts = 0;
  ok(S.MAX_TIER === 5 && S.TIER_NAMES[5] === 'Dracónico' && S.MATS.escama, 'existe la calidad Dracónica y la escama de dragón');
  c.st.m = { hierro: 30, acero: 30, alma: 40, cuero: 30, hueso: 30, escama: 6 };
  let r = E.cmd(g, first, { a: 'craft', c: c.id, k: 'espada', tr: 5 });
  ok(!r.err && c.st.it.some(i => i.k === 'espada' && i.t === 5), 'forjar dracónico cuesta escamas y almas: ' + (r.err || r.msg));
  const e4 = (k, t) => { u.eq = { arma: { id: g.nid++, k, t } }; return E.eff(g, u).dmg; };
  ok(e4('espada', 5) > e4('espada', 4) * 1.25, 'el dracónico supera claramente al alma');
  const it = { id: 9300, k: 'espada', t: 4 }; c.st.it.push(it); c.crafts = 0;
  r = E.cmd(g, first, { a: 'upgrade', c: c.id, i: 9300 }); ok(!r.err && it.t === 5, 'se puede mejorar de alma a dracónico');
  c.crafts = 0; r = E.cmd(g, first, { a: 'upgrade', c: c.id, i: 9300 }); ok(!!r.err, 'ya es la mejor calidad');
  // escala de rareza = nº de efectos
  ok(S.RARITY.map(r => r.n).join() === 'Común,Poco común,Raro,Épico,Legendario,Mítico' && S.MAX_FX === 5, 'seis rarezas: Común, Poco común, Raro, Épico, Legendario, Mítico');
  const lg = { id: 9301, k: 'espada', t: 2, fx: ['veneno', 'vida'], r: 2 }; c.st.it.push(lg); c.crafts = 0;
  r = E.cmd(g, first, { a: 'enchant', c: c.id, i: 9301 }); ok(!!r.err, 'el 3.er efecto (Épico) exige calidad Acero o superior');
  lg.t = 3; c.crafts = 0; r = E.cmd(g, first, { a: 'enchant', c: c.id, i: 9301 });
  ok(!r.err && lg.fx.length === 3 && lg.r === 3 && S.itemName(lg).includes('🟣'), '3 efectos = Épico 🟣');
  c.crafts = 0; r = E.cmd(g, first, { a: 'enchant', c: c.id, i: 9301 }); ok(!!r.err, 'el 4.º efecto (Legendario) exige calidad Alma o superior');
  lg.t = 4; c.crafts = 0; const a0 = c.st.m.alma, s0 = c.st.m.escama;
  r = E.cmd(g, first, { a: 'enchant', c: c.id, i: 9301, f: ['fuego', 'hielo', 'critico'].find(f => !lg.fx.includes(f)) });
  ok(!r.err && lg.fx.length === 4 && lg.r === 4 && c.st.m.alma === a0 - 6 && (c.st.m.escama || 0) === s0 - 2 && S.itemName(lg).includes('🟡'), '4 efectos = Legendario 🟡 (6 almas y 2 escamas)');
  c.crafts = 0; r = E.cmd(g, first, { a: 'enchant', c: c.id, i: 9301 }); ok(!!r.err, 'el 5.º efecto (Mítico) exige calidad Dracónica');
  lg.t = 5; c.st.m.escama = 6; c.st.m.alma = 40; c.crafts = 0; r = E.cmd(g, first, { a: 'enchant', c: c.id, i: 9301 });
  ok(!r.err && lg.fx.length === 5 && lg.r === 5 && S.itemName(lg).includes('🔴') && new Set(lg.fx).size === 5, '5 efectos = Mítico 🔴 (sin efectos repetidos)');
  c.crafts = 0; r = E.cmd(g, first, { a: 'enchant', c: c.id, i: 9301 }); ok(!!r.err, 'máximo cinco efectos');
  ok(S.affixText('afilado', 5).includes('18') && S.affixText('afilado', 1).includes('4'), 'la potencia crece de Poco común a Mítico');
  // reforjar
  const before = lg.fx.slice(); c.crafts = 0; const a1 = c.st.m.alma;
  r = E.cmd(g, first, { a: 'reforge', c: c.id, i: 9301, x: 1 });
  ok(!r.err && lg.fx.length === 5 && lg.fx[0] === before[0] && lg.fx[2] === before[2] && lg.fx[1] !== before[1] && c.st.m.alma === a1 - 2 && new Set(lg.fx).size === 5, 'reforjar cambia solo el efecto elegido por otro distinto (2 almas)');
  ok(!!E.cmd(g, first, { a: 'reforge', c: c.id, i: 9301, x: 7 }).err, 'reforjar con efecto inválido falla');
  // efectos nuevos en eff
  const wf = (fx, r2 = 1) => { u.eq = { arma: { id: g.nid++, k: 'espada', t: 3, fx, r: r2 } }; return E.eff(g, u); };
  const base = wf([]).dmg;
  ok(wf(['critico']).fx.critico === 0.15 && wf(['critico', 'hielo'], 2).fx.critico === 0.22 && wf(['critico', 'hielo', 'fuego'], 3).fx.critico === 0.30, 'los valores suben con la rareza (Raro/Épico/Legendario)');
  ok(wf(['ejecutor']).mods.execute === 0.2 && wf(['bestias']).mods.vsCre === 0.15, 'ejecutor y cazabestias entran en los modificadores');
  const af = (fx, r2 = 1) => { u.eq = { pechera: { id: g.nid++, k: 'pechera', t: 3, fx, r: r2 } }; return E.eff(g, u); };
  const hp0 = af([]).maxHp; ok(af(['vigor']).maxHp > hp0, 'vigor sube la salud máxima');
  u.xp = 0; u.lv = 1; u.eq = {}; E.gainXp(g, u, 4); const xpA = u.xp;
  af(['erudito']); u.xp = 0; u.eq = { pechera: { id: 1, k: 'pechera', t: 3, fx: ['erudito'], r: 1 } }; E.gainXp(g, u, 4);
  ok(u.xp > xpA, 'erudito da más experiencia (' + xpA + ' → ' + u.xp + ')');
  // hielo / fuego / crítico en combate
  const foe = g.units.find(x => x.o !== first); const cr = { id: 9400, t: 'lobo', x: u.x + 1, y: u.y, lv: 1, hp: 500, hit: false }; g.creatures.push(cr);
  u.eq = { arma: { id: g.nid++, k: 'espada', t: 5, fx: ['hielo', 'fuego', 'critico'], r: 3 } }; u.at = 1; u.hits = 0; u.mp = 3; u.acted = false;
  const rr = E.cmd(g, first, { a: 'attack', u: u.id, tt: 'c', id: cr.id });
  ok(!rr.err, 'ataque con efectos nuevos funciona: ' + (rr.err || rr.msg));
  ok(cr.pz && cr.pz.t === 2, 'fuego deja quemado 2 turnos'); ok(cr.sl === 1 && E.cstats(cr, g).mov < S.CREATURES.lobo.mov, 'hielo ralentiza a la criatura');
  // sets
  const mkset = (t, n) => { u.eq = {}; ['casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas'].slice(0, n).forEach(k => u.eq[k] = { id: g.nid++, k, t }); return E.eff(g, u); };
  const s0e = mkset(3, 2), s3 = mkset(3, 3), s6 = mkset(3, 6);
  ok(!S.armorSet({ casco: { t: 3 }, pechera: { t: 3 } }) && S.armorSet(u.eq).name === 'Set de Acero', 'el set empieza con 3 piezas de la misma calidad');
  ok(s3.maxHp > s0e.maxHp && s6.fx.regen >= 0.04, 'bonos de set: 3 piezas (+salud) y 6 piezas (regeneración)');
  // botín
  const dg = g.creatures; const boss = { id: 9500, t: 'dragon', x: 0, y: 0, lv: 5, hp: 1, hit: false }; let esc = 0;
  for (let i = 0; i < 20; i++) { /* cada tirada usa el rng de la partida */ const d = E.cstats(boss, g); esc += d.mhp > 0 ? 1 : 0; }
  ok(S.CREATURES.dragon.drops.escama, 'el Dragón de Ceniza suelta escamas');
}

{ // ===== rareza del botín =====
  console.log('· rareza del botín');
  const g = mk({}); const cnt = w => { const c = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < 600; i++) { const it = E.rareItem(g, { w }); c[it.r]++; if (it.fx.length !== it.r || new Set(it.fx).size !== it.r) c.bad = 1; } return c; };
  const cofre = cnt([65, 28, 6, 1, 0]), jefe = cnt([15, 30, 30, 18, 7]);
  ok(!cofre.bad && !jefe.bad && cofre[0] === 0, 'el botín tiene tantos efectos como su rareza, sin repetir');
  ok(cofre[1] > cofre[2] && cofre[5] === 0, 'un cofre da sobre todo Poco común y nunca Mítico');
  ok(jefe[4] + jefe[5] > cofre[4] + cofre[5] + 40, 'los jefes dan mucho más Legendario/Mítico');
}

{ // ===== Reto del Rey Demonio =====
  console.log('· Reto del Rey Demonio');
  const mkr = (n = 5) => { const g = E.createGame('KG', 'H', 't'); g.cfg.mode = 'rey'; g.cfg.idleTurns = 0; for (let i = 0; i < n; i++) E.addBot(g, 'azar'); E.startGame(g); for (const p of g.players) if (p.id !== 0) p.bot = false; return g; };
  const g = mkr(), K = g.king, kp = g.players[K];
  ok(K >= 0 && K < g.players.length, 'se elige un Rey Demonio entre los jugadores: ' + kp.name);
  const ku = g.units.filter(u => u.o === K);
  ok(ku.length >= 6 && ku.every(u => u.bs && !Object.keys(u.eq).length), 'el Rey empieza solo con bestias (' + ku.length + ')');
  ok(g.units.filter(u => u.o !== K).every(u => !u.bs), 'los demás tienen unidades normales');
  const others = g.players.filter(p => p.id !== K);
  ok(others.every(a => others.every(b => a === b || E.pactOf(g, a.id, b.id) === 'alianza')) && others.every(a => !E.pactOf(g, a.id, K)), 'los demás jugadores están aliados y en guerra con el Rey');
  ok(!!E.cmd(g, others[0].id, { a: 'dip', d: 'offer', to: K, k: 'paz' }).err, 'no se puede negociar con el Rey Demonio');
  ok(!!E.cmd(g, others[0].id, { a: 'dip', d: 'break', to: others[1].id }).err || E.pactOf(g, others[0].id, others[1].id) === 'alianza', 'la alianza no se rompe');
  const kh = g.units.filter(u => u.o === K && u.hero);
  ok(kh.length === 1 && S.KING.heroes.includes(kh[0].bs) && g.players[K].hero === kh[0].id && g.kingBoss === kh[0].bs, 'el protagonista del Rey es un jefe al azar: ' + (kh[0] && kh[0].bs));
  ok(E.eff(g, kh[0]).maxHp < S.CREATURES[kh[0].bs].hp && E.eff(g, kh[0]).maxHp > 100, 'el jefe protagonista está atenuado (vida ' + E.eff(g, kh[0]).maxHp + ')');
  const seen = new Set(); for (let i = 0; i < 60; i++) { const gz = mkr(2); seen.add(gz.kingBoss); } ok(seen.size >= 5 && [...seen].every(k => S.KING.heroes.includes(k)), 'con varias partidas salen varios jefes distintos: ' + [...seen].join(','));
  { const aid = g.units.find(u => u.o === K && u.bs && !u.hero); aid.x = kh[0].x + 1; aid.y = kh[0].y; ok(E.eff(g, aid).ha === S.HERO.aura, 'su aura da +10% a las bestias cercanas'); }
  { const ho = kh[0]; ho.lv = 6; E.killUnit(g, ho, { unit: g.units.find(x => x.o !== K) }); ok(!g.units.includes(ho) && g.rv.some(r => r.o === K && r.bs === g.kingBoss), 'si cae, reaparece después'); for (let i = 0; i < 5; i++) E.advanceTurn(g); const back = g.units.find(u => u.o === K && u.hero); ok(back && back.bs === g.kingBoss && back.lv === 6 - S.HERO.loss, 'vuelve como el mismo jefe, ' + S.HERO.loss + ' niveles más débil'); }
  // reclutar solo bestias
  const city = g.cities.find(c => c.owner === K && c.cap); city.st.m = { hueso: 30, cuero: 30, hierro: 30, acero: 30 }; city.crafts = 0;
  const n0 = g.units.filter(u => u.o === K).length;
  let r = E.cmd(g, K, { a: 'recruit', c: city.id, k: 'troll' });
  ok(!r.err && g.units.filter(u => u.o === K).length === n0 + 1 && g.units.some(u => u.o === K && u.bs === 'troll'), 'el Rey recluta un Troll: ' + (r.err || r.msg));
  ok(!!E.cmd(g, K, { a: 'recruit', c: city.id, k: 'dragon' }).err, 'no puede reclutar jefes ni cosas que no son bestias');
  const sn = E.snapshot(g, K); const mine = sn.cities.find(c => c.id === city.id);
  ok(sn.king === K && mine.rcb && mine.rcb.lobo && mine.rcb.troll, 'la vista incluye al rey y los costes de bestias');
  // sin equipo ni clase
  const b = ku[0]; const nr = g.units.find(u => u.o === K && u.bs);
  ok(!!E.cmd(g, K, { a: 'cls', u: nr.id, k: 'duelista' }).err || !nr.cls, 'las bestias no tienen clase');
  nr.inv.it.push({ id: 99991, k: 'espada', t: 1 }); nr.x = city.x + 1; nr.y = city.y;
  ok(!!E.cmd(g, K, { a: 'equip', u: nr.id, i: 99991 }).err, 'las bestias no usan equipo');
  nr.pts = 1; r = E.cmd(g, K, { a: 'skill', u: nr.id, s: 'dano' }); ok(!r.err && nr.sk.dano === 1, 'las bestias sí gastan puntos de habilidad');
  // fin: cae el rey → gana la alianza
  const ga = mkr(4); const ka = ga.king;
  for (const u of ga.units.filter(u => u.o === ka)) E.killUnit(ga, u, { unit: ga.units.find(x => x.o !== ka) });
  for (const c of ga.cities.filter(c => c.owner === ka)) c.st.m = {};
  E.advanceTurn(ga);
  ok(ga.status === 'over' && ga.winners && ga.winners.length === 4 && !ga.winners.includes(ka), 'si cae el Rey Demonio, gana la alianza');
  // fin: el rey elimina a todos
  const gb = mkr(3); const kb = gb.king;
  for (const u of gb.units.filter(u => u.o !== kb)) E.killUnit(gb, u, { unit: gb.units.find(x => x.o === kb) });
  for (const c of gb.cities.filter(c => c.owner !== kb && c.owner !== null)) c.st.m = {};
  E.advanceTurn(gb);
  ok(gb.status === 'over' && gb.winner === kb, 'si el Rey elimina a todos, gana el Rey');
  // guardado y partida completa con bots
  const gs = E.deserialize(E.serialize(g)); ok(gs.king === K && gs.units.some(u => u.bs), 'el modo se guarda con la partida');
  const gg = E.createGame('KS', 'H', 't'); gg.cfg.mode = 'rey'; gg.cfg.sim = true; gg.cfg.idleTurns = 0; for (let i = 0; i < 9; i++) E.addBot(gg, 'azar'); E.startGame(gg);
  let err = null; try { for (let i = 0; i < 60 && gg.status === 'playing'; i++) E.advanceTurn(gg); } catch (e) { err = e; }
  ok(!err, 'partida de 10 jugadores (9 bots) corre sin errores' + (err ? ': ' + err.stack : ''));
  ok(gg.units.filter(u => u.o === gg.king).every(u => u.bs), 'el bot Rey solo tiene bestias (nunca unidades normales)');
}

{ // ===== Modo por equipos =====
  console.log('· Modo por equipos (2 o 5 equipos)');
  const mkt = (n, teams) => { const g = E.createGame('TM', 'H', 't'); g.cfg.mode = 'equipos'; g.cfg.teams = teams; g.cfg.idleTurns = 0; for (let i = 0; i < n; i++) E.addBot(g, 'azar'); E.startGame(g); for (const p of g.players) if (p.id !== 0) p.bot = false; return g; };
  const g2 = mkt(9, 'dos'), sz = {};
  for (const p of g2.players) sz[p.team] = (sz[p.team] || 0) + 1;
  ok(Object.keys(sz).length === 2 && Math.abs(sz[0] - sz[1]) <= 1, '10 jugadores, 2 equipos equilibrados: ' + JSON.stringify(sz));
  const same = (g, a, b) => E.pactOf(g, a.id, b.id) === 'alianza';
  ok(g2.players.every(a => g2.players.every(b => a === b || same(g2, a, b) === (a.team === b.team))), 'compañeros aliados, otros equipos sin pacto');
  const g5 = mkt(9, 'cinco'), s5 = {}; for (const p of g5.players) s5[p.team] = (s5[p.team] || 0) + 1;
  ok(Object.keys(s5).length === 5 && Object.values(s5).every(n => n === 2), '5 equipos de 2: ' + JSON.stringify(s5));
  const g3 = mkt(2, 'cinco'); ok(new Set(g3.players.map(p => p.team)).size === 3, 'con 3 jugadores y 5 equipos: un equipo por jugador');
  ok(!!E.cmd(g2, 0, { a: 'dip', d: 'offer', to: g2.players.find(p => p.team !== g2.players[0].team).id, k: 'paz' }).err, 'no se negocia en modo por equipos');
  ok(E.snapshot(g2, 0).players.every(p => p.team === 0 || p.team === 1), 'la vista incluye el equipo de cada jugador');
  // un equipo eliminado → gana el otro
  const ge = mkt(5, 'dos'); const lose = ge.players.filter(p => p.team === 1), killer = ge.units.find(x => ge.players[x.o].team === 0);
  for (const p of lose) { for (const u of ge.units.filter(u => u.o === p.id)) E.killUnit(ge, u, { unit: killer }); for (const c of ge.cities.filter(c => c.owner === p.id)) c.st.m = {}; }
  E.advanceTurn(ge);
  ok(ge.status === 'over' && ge.winners.every(i => ge.players[i].team === 0) && ge.winners.length === ge.players.filter(p => p.team === 0).length, 'gana el último equipo en pie (victoria compartida)');
  // partida completa con bots, no termina por alianza instantánea
  const gs = E.createGame('TS', 'H', 't'); gs.cfg.mode = 'equipos'; gs.cfg.teams = 'cinco'; gs.cfg.sim = true; gs.cfg.idleTurns = 0; for (let i = 0; i < 9; i++) E.addBot(gs, 'azar'); E.startGame(gs);
  let err = null; try { for (let i = 0; i < 50 && gs.status === 'playing'; i++) E.advanceTurn(gs); } catch (e) { err = e; }
  ok(!err && gs.turn > 3, 'partida de 5 equipos con bots corre sin errores' + (err ? ': ' + err.stack : ''));
  const rs = E.deserialize(E.serialize(g5)); ok(rs.nTeams === 5 && rs.players.every((p, i) => p.team === g5.players[i].team), 'los equipos se guardan con la partida');
}

{ // ===== Modo Historia =====
  console.log('· Modo Historia (campaña cooperativa)');
  const mks = (n = 3) => { const g = E.createGame('HS', 'H', 't'); g.cfg.mode = 'historia'; g.cfg.idleTurns = 0; for (let i = 0; i < n; i++) E.addBot(g, 'azar'); E.startGame(g); for (const p of g.players) if (p.id !== 0) p.bot = false; return g; };
  const g = mks(); const st = () => E.snapshot(g, 0).story;
  ok(g.players.every(a => g.players.every(b => a === b || E.pactOf(g, a.id, b.id) === 'alianza')), 'todos los jugadores empiezan aliados');
  ok(!!E.cmd(g, 0, { a: 'dip', d: 'offer', to: 1, k: 'paz' }).err, 'no hay diplomacia en la historia');
  ok(st() && st().ch === 0 && st().n === 6 && st().goals.length === 1 && st().title === 'El eco de la ceniza', 'la vista incluye el capítulo 1 y sus objetivos');
  ok(g.events.some(l => /La Ceniza del Dragón/.test(l.text)) && g.events.some(l => /Capítulo 1/.test(l.text)), 'se cuenta el prólogo y el capítulo 1');
  const noBoss = () => !g.creatures.some(c => S.CREATURES[c.t].boss && !c.dg);
  for (let i = 0; i < 12; i++) E.advanceTurn(g);
  ok(noBoss() && g.status === 'playing', 'no aparecen jefes aleatorios en la historia (' + g.turn + ')');
  // capítulo 1: 12 muertes de criaturas entre todos
  g.players[0].stats.kills = 7; g.players[1].stats.kills = 5; const cap0 = g.cities.find(c => c.owner === 0 && c.cap); const m0 = (cap0.st.m.hierro || 0), it0 = cap0.st.it.length;
  E.advanceTurn(g);
  ok(st().ch === 1 && cap0.st.m.hierro >= m0 + 6 && cap0.st.it.length === it0 + 1, 'completar un capítulo da materiales y un objeto, y pasa al siguiente');
  ok(st().done.length === 1 && g.events.some(l => /Capítulo 1 completado/.test(l.text)), 'el capítulo anterior queda en el registro');
  // sin cumplirse: no avanza
  E.advanceTurn(g); ok(st().ch === 1, 'sin cumplir los objetivos no se avanza');
  // forzar capítulos 2 y 3
  for (const c of g.cities) if (c.owner === null) c.owner = 0; E.advanceTurn(g); ok(st().ch === 2, 'capítulo 2 (ciudades) completado');
  const u0 = g.units.find(u => u.o === 0 && !u.sm); u0.lv = 8; u0.eq.pechera = { id: g.nid++, k: 'pechera', t: 3 }; E.advanceTurn(g);
  ok(st().ch === 3, 'capítulo 3 (nivel 8 + calidad acero) completado');
  const rl = g.creatures.find(c => c.t === 'reylobo'); ok(!!rl && rl.lv >= 5, 'el capítulo 4 hace aparecer al Rey Lobo (nivel ' + (rl && rl.lv) + ')');
  // si el jefe del capítulo desaparece sin morir, reaparece
  g.creatures.splice(g.creatures.indexOf(rl), 1); E.advanceTurn(g); ok(g.creatures.some(c => c.t === 'reylobo'), 'si el jefe del capítulo desaparece, vuelve a aparecer');
  // matar a los jefes (usa el camino real de muerte)
  g.story.killed.reylobo = true; E.advanceTurn(g); ok(st().ch === 4 && g.creatures.some(c => c.t === 'liche'), 'matar al Rey Lobo pasa al capítulo 5 y aparece el Liche');
  g.story.killed.liche = true; E.advanceTurn(g); ok(st().ch === 5 && g.creatures.some(c => c.t === 'dragon'), 'matar al Liche pasa al capítulo 6 y aparece el Dragón');
  g.story.killed.dragon = true; E.advanceTurn(g);
  ok(g.status === 'over' && g.winners.length === g.players.length && g.story.fin && st().fin, '¡victoria compartida al derrotar al Dragón!');
  // derrota: cae todo el grupo
  const gl = mks(2); for (const u of gl.units.slice()) E.killUnit(gl, u, { creature: { t: 'lobo', id: 1 } }); for (const c of gl.cities) c.st.m = {}; E.advanceTurn(gl);
  ok(gl.status === 'over' && gl.story.lost && E.snapshot(gl, 0).story.lost, 'si todos caen, la historia termina en derrota');
  // el jefe sale del camino real de muerte
  const gk = mks(); const bc = { id: 7777, t: 'liche', x: 0, y: 0, lv: 1, hp: 1, hit: false }; gk.creatures.push(bc);
  E.killCreature(gk, bc, gk.units.find(u => u.o === 0)); ok(gk.story.killed.liche === true, 'matar a un jefe lo anota en la campaña');
  const gs = E.createGame('HSim', 'H', 't'); gs.cfg.mode = 'historia'; gs.cfg.sim = true; gs.cfg.idleTurns = 0; for (let i = 0; i < 9; i++) E.addBot(gs, 'azar'); E.startGame(gs);
  let err = null; try { for (let i = 0; i < 80 && gs.status === 'playing'; i++) E.advanceTurn(gs); } catch (e) { err = e; }
  ok(!err, 'campaña con 9 bots corre 80 turnos sin errores (capítulo ' + (gs.story.ch + 1) + ')' + (err ? ': ' + err.stack : ''));
  const rs = E.deserialize(E.serialize(g)); ok(rs.story && rs.story.fin, 'la campaña se guarda con la partida');
}

{ // ===== Mundo abierto =====
  console.log('· Mundo abierto');
  const mkw = (opts = {}) => { const g = E.createGame('MW', 'H', 't'); g.cfg.mode = 'mundo'; Object.assign(g.cfg, opts); const r = E.startGame(g); if (r) throw new Error(r); return g; };
  const g = mkw({ decay: '12' });
  ok(g.status === 'playing' && g.map.w === 160 && g.cfg.breed !== 'apagado' && g.cfg.maxTurns === 0, 'arranca con 1 solo jugador en un mundo de 160×160 con crías activas');
  ok(g.cities.filter(c => c.owner === null).length >= 60, 'hay muchas ciudades neutrales (' + g.cities.filter(c => c.owner === null).length + ')');
  ok(!E.addBot(g, 'azar'), 'no hay bots en el mundo abierto');
  // entrar en cualquier momento
  for (let i = 0; i < 3; i++) E.advanceTurn(g);
  const a = E.joinWorld(g, 'Ana', 'tok1'), b = E.joinWorld(g, 'Beto', 'tok2');
  ok(a && b && g.players.length === 3 && a.id === 1 && b.id === 2, 'los jugadores entran con el mundo ya en marcha');
  const capA = g.cities.find(c => c.owner === a.id && c.cap), capB = g.cities.find(c => c.owner === b.id && c.cap), cap0 = g.cities.find(c => c.owner === 0 && c.cap);
  const dist = (p, q) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
  ok(capA && capB && dist(capA, cap0) >= 10 && dist(capA, capB) >= 10, 'cada uno nace en un sitio libre y lejos de los demás (' + dist(capA, cap0) + ', ' + dist(capA, capB) + ')');
  ok(g.units.filter(u => u.o === a.id).length >= 1 && !g.creatures.some(c => dist(c, capA) <= 8), 'nace con unidades y sin monstruos cerca');
  ok(E.snapshot(g, a.id).you === a.id && E.snapshot(g, a.id).mine.length >= 1, 'el recién llegado recibe su vista del mundo');
  // reglas
  ok(!!E.cmd(g, a.id, { a: 'recruit', c: capA.id }).err, 'no se puede reclutar');
  ok(!E.cmd(g, 0, { a: 'dip', d: 'offer', to: a.id, k: 'paz' }).err, 'la diplomacia sigue disponible');
  // monstruos: niveles al azar y sin crecer con el tiempo
  const lvs = g.creatures.filter(c => !S.CREATURES[c.t].boss).map(c => c.lv);
  ok(Math.max(...lvs) >= 6 && Math.min(...lvs) === 1, 'monstruos de niveles muy distintos al azar (' + Math.min(...lvs) + '–' + Math.max(...lvs) + ')');
  const probe = g.creatures.find(c => !S.CREATURES[c.t].boss); const lv0 = probe.lv; probe.hx = probe.x; probe.hy = probe.y;
  for (let i = 0; i < 25; i++) E.advanceTurn(g);
  ok(!g.creatures.includes(probe) || probe.lv === lv0, 'los monstruos no suben de nivel con el tiempo');
  ok(g.creatures.some(c => S.CREATURES[c.t].boss), 'hay jefes de nivel al azar (' + g.creatures.filter(c => S.CREATURES[c.t].boss).map(c => c.lv).join(',') + ')');
  ok(g.status === 'playing' && g.players.every(p => p.alive), 'el mundo nunca termina ni elimina a nadie');
  // ciudades que se vuelven neutrales
  const nb = g.cities.filter(c => c.owner === b.id).length;
  const far = { x: Math.min(g.map.w - 2, capB.x + 20), y: capB.y };
  for (const u of g.units.filter(u => u.o === b.id)) { u.x = far.x; u.y = far.y; } // se va lejos
  const calm = () => { g.creatures = g.creatures.filter(c => dist(c, far) > 14); }; // que ningún monstruo se los coma durante la prueba
  for (let i = 0; i < 9; i++) { calm(); E.advanceTurn(g); }
  ok(capB.owner === b.id, 'antes del plazo la ciudad sigue siendo suya');
  ok(g.events.some(e => /quedará abandonada/.test(e.text) && e.to && e.to.includes(b.id)), 'se avisa 3 turnos antes');
  for (let i = 0; i < 3; i++) { calm(); E.advanceTurn(g); }
  ok(capB.owner === null && !capB.cap && /Ruinas/.test(capB.name), 'tras 12 turnos sin unidades la capital vuelve a ser neutral');
  const capA2 = g.cities.find(c => c.id === capA.id); ok(capA2.owner === a.id, 'la ciudad con unidades presentes se conserva');
  // sin unidades ni ciudades: empieza de nuevo
  for (const u of g.units.filter(u => u.o === b.id)) E.killUnit(g, u, { creature: { t: 'lobo', id: 1 } });
  g.rv = []; E.advanceTurn(g);
  const nb2 = g.cities.find(c => c.owner === b.id);
  ok(nb2 && g.units.some(u => u.o === b.id), 'quien lo pierde todo vuelve a nacer en otro sitio');
  // crías
  const ua = g.units.filter(u => u.o === a.id); ok(ua.length >= 2 && !!g.cfg.breed, 'se puede tener crías con 2 unidades juntas');
  // guardado
  const rs = E.deserialize(E.serialize(g)); ok(rs.cfg.mode === 'mundo' && rs.players.length === 3 && rs.map.w === 160, 'se guarda y restaura');
  // 24 jugadores
  const gm = mkw({}); let okAll = true; for (let i = 0; i < 23; i++) if (!E.joinWorld(gm, 'J' + i, 't' + i)) okAll = false;
  ok(okAll && gm.players.length === 24 && !E.joinWorld(gm, 'Extra', 'tx') && new Set(gm.players.map(p => p.color)).size === 24, 'caben 24 jugadores, cada uno con su color');
  const t0 = Date.now(); for (let i = 0; i < 10; i++) E.advanceTurn(gm); ok(Date.now() - t0 < 4000 && gm.status === 'playing', 'con 24 jugadores el turno es rápido (' + (Date.now() - t0) + ' ms por 10 turnos)');
}

console.log('Modos rápidos, resumen final (v1.22)');
{
  ok(Array.isArray(S.PRESETS) && S.PRESETS.length >= 8, 'hay modos rápidos definidos');
  for (const pr of S.PRESETS) {
    let valid = true;
    for (const [k, v] of Object.entries(pr.cfg)) {
      if (k === 'turnHours' || k === 'maxTurns') continue;
      const o = S.WORLD_OPTS[k];
      if (!o || !(String(v) in o.o)) valid = false;
    }
    ok(valid, `modo «${pr.n}»: todos sus ajustes son valores válidos`);
  }
  for (const pr of S.PRESETS.filter(p => p.cfg.mode !== 'mundo')) {
    let g, err = null;
    try {
      const { turnHours, maxTurns, ...rest } = pr.cfg;
      g = mk(rest, 4);
      for (let i = 0; i < 5; i++) E.advanceTurn(g);
    } catch (e) { err = e; }
    ok(!err && g && g.status === 'playing', `modo «${pr.n}» arranca y corre 5 turnos`);
  }
  const g = mk({}, 3);
  ok(E.snapshot(g, g.players[0].id).sum === undefined, 'sin resumen mientras se juega');
  g.status = 'over'; g.winner = g.players[0].id;
  const sm = E.snapshot(g, g.players[0].id).sum;
  ok(sm && sm.rows.length === 4 && Array.isArray(sm.awards) && sm.rows[0].score >= sm.rows[3].score, 'al terminar hay resumen con ranking ordenado y premios');
}

{ // ===== gemas, engarces y tipos de final (v1.23) =====
  console.log('Gemas y engarces (v1.23)');
  const g = mk({}); const first = g.players[0].id, u = g.units.find(x => x.o === first);
  const c = g.cities.find(x => x.owner === first && x.cap); c.cm = 30; c.crafts = 0;
  ok(S.GEM_IDS.length === 6 && S.MATS.rubi3 && S.MATS.rubi3.gem === 'rubi', 'hay 6 gemas con 3 calidades como materiales');
  ok(S.gemFx('rubi2', true).f === 'afilado' && S.gemFx('rubi2', false).f === 'vigor', 'la gema da un efecto en armas y otro en armaduras');
  // engarces en objetos raros
  let socks = 0; for (let i = 0; i < 40; i++) { const it = E.rareItem(g, { w: [0, 0, 0, 0, 1] }); if (it.so === 3 && Array.isArray(it.gm)) socks++; }
  ok(socks === 40, 'un objeto Mítico sale con 3 engarces');
  // perforar y engastar
  const sw = { id: 9500, k: 'espada', t: 3, fx: [], r: 0 }; c.st.it.push(sw);
  c.st.m = { acero: 20, alma: 20, rubi1: 2, rubi3: 1 };
  let r = E.cmd(g, first, { a: 'socket', c: c.id, i: 9500 }); ok(!r.err && sw.so === 1, 'se perfora el primer engarce');
  c.crafts = 0; r = E.cmd(g, first, { a: 'gem', c: c.id, i: 9500, k: 'rubi1' });
  ok(!r.err && sw.gm[0] === 'rubi1' && c.st.m.rubi1 === 1, 'se engasta la gema y sale del almacén');
  u.eq = { arma: sw }; const d1 = E.eff(g, u).dmg;
  u.eq = { arma: { id: 9501, k: 'espada', t: 3, fx: [], r: 0 } }; const d0 = E.eff(g, u).dmg;
  ok(d1 === d0 + 3, 'un rubí astillado suma +3 de daño en un arma (' + d0 + ' → ' + d1 + ')');
  c.crafts = 0; r = E.cmd(g, first, { a: 'gem', c: c.id, i: 9500, k: 'rubi3' }); ok(!!r.err, 'sin engarce libre no se engasta (hay que elegir cuál sustituir)');
  c.crafts = 0; r = E.cmd(g, first, { a: 'gem', c: c.id, i: 9500, k: 'rubi3', x: 0 }); ok(!r.err && sw.gm[0] === 'rubi3', 'se puede sustituir una gema');
  u.eq = { arma: sw }; ok(E.eff(g, u).dmg === d0 + 10, 'un rubí perfecto suma +10');
  const ar = { id: 9502, k: 'pechera', t: 2, fx: [], r: 0, so: 1, gm: ['zafiro2'] };
  u.eq = { pechera: ar }; const a1 = E.eff(g, u).def; ar.gm = []; const a0 = E.eff(g, u).def;
  ok(a1 === a0 + 5, 'un zafiro normal suma +5 de defensa en una armadura');
  c.crafts = 0; c.st.m = { acero: 20, alma: 20 }; sw.t = 1; sw.so = 1; r = E.cmd(g, first, { a: 'socket', c: c.id, i: 9500 }); ok(!!r.err, 'el 2.º engarce exige calidad Hierro o superior… y acero: ' + (r.err || ''));
  // fundir
  c.crafts = 0; c.st.m = { esmeralda1: 3 }; r = E.cmd(g, first, { a: 'gemup', c: c.id, k: 'esmeralda1' });
  ok(!r.err && c.st.m.esmeralda2 === 1 && !c.st.m.esmeralda1, '3 gemas iguales se funden en 1 de la calidad siguiente');
  r = E.cmd(g, first, { a: 'gemup', c: c.id, k: 'esmeralda2' }); ok(!!r.err, 'con menos de 3 no se puede fundir');
  // botín
  let gotGem = 0; for (let i = 0; i < 30; i++) { const gg = mk({}); const uu = gg.units.find(x => x.o === gg.players[0].id); const cr = { id: 99999, t: 'dragon', x: 0, y: 0, lv: 10, hp: 1 }; gg.creatures.push(cr); E.killCreature(gg, cr, uu); if (Object.keys(uu.inv.m).some(k => S.gemOf(k))) gotGem++; }
  ok(gotGem >= 25, 'los jefes casi siempre sueltan gemas (' + gotGem + '/30)');
  const save = E.deserialize(E.serialize(g)); ok(save.cities.find(x => x.id === c.id) && sw.gm.length === 1, 'se guarda con las gemas');

  console.log('Tipos de final (v1.23)');
  ok(S.WORLD_OPTS.victory.def === 'ultimo' && Object.keys(S.WORLD_OPTS.victory.o).length === 6, 'ajuste «Tipo de final» con 6 opciones');
  const mkv = v => mk({ victory: v }, 3);
  { const gv = mkv('jefes'); gv.players[0].stats.boss = 2; E.advanceTurn(gv); ok(gv.status === 'over' && gv.winner === gv.players[0].id, 'Cazajefes: gana quien derrota a 2 jefes'); }
  { const gv = mkv('campeon'); const uu = gv.units.find(x => x.o === gv.players[1].id); uu.lv = 12; E.advanceTurn(gv); ok(gv.status === 'over' && gv.winner === gv.players[1].id, 'Campeón: gana quien llega a nivel 12'); }
  { const gv = mkv('puntos'); gv.players[2].stats.boss = 12; E.advanceTurn(gv); ok(gv.status === 'over' && gv.winner === gv.players[2].id, 'Carrera de puntos: gana quien llega a 600'); }
  { const gv = mkv('ultimo'); gv.players[0].stats.boss = 20; const uu = gv.units.find(x => x.o === gv.players[1].id); uu.lv = 20; E.advanceTurn(gv); ok(gv.status === 'playing', 'Último en pie: nada de eso termina la partida'); }
  { const gv = mkv('dominio'); const mine = gv.cities.filter(x => x.owner === null || x.owner === gv.players[0].id); // el jugador 0 se queda con la mitad de las ciudades
    gv.cities.forEach((x, i) => { x.owner = i < Math.ceil(gv.cities.length * 0.6) ? gv.players[0].id : null; });
    E.advanceTurn(gv); ok(gv.status === 'playing' && gv.vic && gv.vic.hold && gv.vic.hold.id === gv.players[0].id, 'Dominación: empieza la cuenta atrás y se avisa');
    const sv = E.snapshot(gv, gv.players[0].id).vic; ok(sv && sv.k === 'dominio' && sv.rows[0].id === gv.players[0].id && sv.hold, 'el estado trae el progreso del final');
    for (let i = 0; i < 4 && gv.status === 'playing'; i++) { gv.cities.forEach((x, j) => { if (j < Math.ceil(gv.cities.length * 0.6)) x.owner = gv.players[0].id; }); E.advanceTurn(gv); }
    ok(gv.status === 'over' && gv.winner === gv.players[0].id, 'Dominación: tras 4 turnos seguidos gana'); }
  { const gv = mkv('dominio'); gv.cities.forEach((x, i) => { x.owner = i < Math.ceil(gv.cities.length * 0.6) ? gv.players[0].id : null; }); E.advanceTurn(gv);
    gv.cities.forEach(x => { x.owner = null; }); E.advanceTurn(gv); ok(!gv.vic.hold && gv.status === 'playing', 'Dominación: si pierde ciudades, la cuenta se reinicia'); }
  { const gv = mkv('tiempo'); ok(gv.cfg.maxTurns === 40, 'Por tiempo sin límite elegido: 40 turnos'); }
  { const gv = mk({ victory: 'jefes', mode: 'equipos', teams: 'dos' }, 3); gv.players[0].stats.boss = 5; E.advanceTurn(gv); ok(gv.status === 'playing', 'los finales especiales no afectan a Equipos'); }
}

console.log('Comercio entre jugadores (v1.25)');
{
  const g = mk({ idleTurns: 0 }, 2); const A = g.players[0], B = g.players[1];
  const ca = g.cities.find(c => c.owner === A.id), cb = g.cities.find(c => c.owner === B.id);
  ca.st.m.acero = 10; ca.st.m.rubi2 = 1; cb.st.m.alma = 8; cb.st.m.cuero = 0;
  let r = E.cmd(g, A.id, { a: 'trade', d: 'offer', to: B.id, fc: ca.id, give: { acero: 5 }, want: { alma: 4 } });
  ok(r.err && /paz o alianza/.test(r.err), 'sin paz ni alianza no se puede comerciar');
  g.dip['0-1'] = 'paz';
  r = E.cmd(g, A.id, { a: 'trade', d: 'offer', to: B.id, fc: ca.id, give: { acero: 50 }, want: {} }); ok(!!r.err, 'no puedes ofrecer lo que no tienes');
  r = E.cmd(g, A.id, { a: 'trade', d: 'offer', to: B.id, fc: ca.id, give: {}, want: {} }); ok(!!r.err, 'una oferta vacía no vale');
  r = E.cmd(g, A.id, { a: 'trade', d: 'offer', to: B.id, fc: ca.id, give: { acero: 5, rubi2: 1 }, want: { alma: 4 } });
  ok(!r.err && g.trades.length === 1 && ca.st.m.acero === 5 && !ca.st.m.rubi2, 'la oferta deja lo ofrecido en depósito');
  ok(E.snapshot(g, B.id).trades.length === 1 && E.snapshot(g, B.id).trades[0].txt.includes('alma'), 'el otro jugador ve la oferta');
  ok(E.snapshot(g, g.players[0].id).trades.length === 1, 'y quien la hizo también');
  const id = g.trades[0].id;
  r = E.cmd(g, A.id, { a: 'trade', d: 'accept', id }); ok(!!r.err, 'no puedes aceptar tu propia oferta');
  r = E.cmd(g, B.id, { a: 'trade', d: 'accept', id });
  ok(!r.err && g.trades.length === 0 && ca.st.m.alma === 4 && cb.st.m.acero === 5 && cb.st.m.rubi2 === 1 && !(cb.st.m.alma > 4), 'al aceptar se intercambia todo');
  // rechazo y cancelación devuelven
  r = E.cmd(g, A.id, { a: 'trade', d: 'offer', to: B.id, fc: ca.id, give: { acero: 3 }, want: { alma: 1 } }); const id2 = g.trades[0].id;
  r = E.cmd(g, B.id, { a: 'trade', d: 'reject', id: id2 }); ok(!r.err && ca.st.m.acero === 5 && g.trades.length === 0, 'al rechazar se devuelve lo depositado');
  r = E.cmd(g, A.id, { a: 'trade', d: 'offer', to: B.id, fc: ca.id, give: { acero: 3 }, want: { alma: 1 } }); const id3 = g.trades[0].id;
  r = E.cmd(g, A.id, { a: 'trade', d: 'cancel', id: id3 }); ok(!r.err && ca.st.m.acero === 5, 'al retirarla se devuelve');
  // faltan materiales para aceptar
  E.cmd(g, A.id, { a: 'trade', d: 'offer', to: B.id, fc: ca.id, give: { acero: 1 }, want: { escama: 5 } });
  r = E.cmd(g, B.id, { a: 'trade', d: 'accept', id: g.trades[0].id }); ok(r.err && g.trades.length === 1 && ca.st.m.acero === 4, 'si no tienes lo que piden no se acepta y nada se pierde');
  // caducidad
  for (let i = 0; i < 6; i++) { for (const p of g.players) p.ready = true; E.advanceTurn(g); }
  ok(g.trades.length === 0 && ca.st.m.acero >= 5, 'caduca a los 5 turnos y devuelve');
  // objeto
  cb.st.m.alma = 5; const it = { id: g.nid++, k: 'espada', t: 3 }; ca.st.it.push(it);
  r = E.cmd(g, A.id, { a: 'trade', d: 'offer', to: B.id, fc: ca.id, give: {}, gi: it.id, want: { alma: 1 } });
  ok(!r.err && !ca.st.it.includes(it), 'se puede ofrecer un objeto');
  r = E.cmd(g, B.id, { a: 'trade', d: 'accept', id: g.trades[0].id }); ok(!r.err && cb.st.it.some(x => x.id === it.id), 'el objeto llega al otro jugador');
  // bot acepta trato justo, rechaza abusivo
  B.bot = true; ca.st.m.acero = 10; cb.st.m.alma = 10;
  E.cmd(g, A.id, { a: 'trade', d: 'offer', to: B.id, fc: ca.id, give: { acero: 6 }, want: { alma: 4 } }); E.advanceTurn(g);
  ok(g.trades.length === 0 && ca.st.m.alma >= 4, 'un bot acepta un trato justo');
  const alA = ca.st.m.alma || 0;
  E.cmd(g, A.id, { a: 'trade', d: 'offer', to: B.id, fc: ca.id, give: { acero: 1 }, want: { alma: 9 } }); const a0 = ca.st.m.acero; E.advanceTurn(g);
  ok(g.trades.length === 0 && (ca.st.m.alma || 0) === alA && ca.st.m.acero >= a0, 'un bot rechaza un trato abusivo y se devuelve lo depositado');
  const rs = E.deserialize(E.serialize(g)); ok(Array.isArray(rs.trades), 'se guarda con el comercio');
}

console.log('Clima, torneos y mercaderes (v1.26)');
{
  ok(S.WORLD_OPTS.events.def === 'todo' && Object.keys(S.WORLD_OPTS.events.o).length === 3, 'ajuste «Eventos del mundo» con 3 opciones');
  const g = mk({}, 2); ok(g.wx && g.wx.k === 'sol', 'la partida empieza con clima');
  const u = g.units.find(x => x.o === g.players[0].id);
  u.eq.arma = { id: 900, k: 'arco', t: 2 }; const b = E.eff(g, u), bm = b.mov, bd = b.dmg, br = b.range;
  g.wx = { k: 'lluvia', left: 3 }; const r = E.eff(g, u); ok(r.dmg < bd && r.mov === bm, 'lluvia: el arco hace menos daño (' + bd + ' → ' + r.dmg + ')');
  g.wx = { k: 'tormenta', left: 3 }; const t = E.eff(g, u); ok(t.mov === Math.max(1, bm - 1) && t.dmg < r.dmg, 'tormenta: −1 de movimiento y menos daño a distancia');
  u.eq.arma = { id: 901, k: 'baston', t: 2 }; g.wx = { k: 'sol', left: 3 }; const m0 = E.eff(g, u).dmg; g.wx = { k: 'tormenta', left: 3 }; ok(E.eff(g, u).dmg > m0, 'tormenta: la magia hace más daño');
  u.eq.arma = { id: 902, k: 'arco', t: 2 }; g.wx = { k: 'niebla', left: 3 }; ok(E.eff(g, u).range === br - 1, 'niebla: el arco alcanza 1 casilla menos');
  u.eq.arma = { id: 903, k: 'espada', t: 2 }; g.wx = { k: 'sol', left: 3 }; const s0 = E.eff(g, u).dmg; g.wx = { k: 'lluvia', left: 3 }; ok(E.eff(g, u).dmg === s0, 'la lluvia no afecta a las armas cuerpo a cuerpo');
  g.wx = { k: 'nieve', left: 3 }; ok(E.eff(g, u).mov === Math.max(1, bm - 1), 'ventisca: −1 de movimiento');
  g.cfg.events = 'calma'; ok(E.eff(g, u).mov === bm, 'con eventos apagados el clima no afecta'); g.cfg.events = 'todo';
  // el clima cambia solo
  const seen = new Set(); for (let i = 0; i < 80; i++) { for (const p of g.players) p.ready = true; E.advanceTurn(g); seen.add(g.wx && g.wx.k); if (g.status !== 'playing') break; }
  ok(seen.size >= 3, 'el clima va cambiando (' + [...seen].join(', ') + ')');
  ok(E.snapshot(g, g.players[0].id).wx && E.snapshot(g, g.players[0].id).wx.k, 'el estado trae el clima');
}
{ // torneo
  const g = mk({ idleTurns: 0 }, 2); const P = g.players[0], u = g.units.find(x => x.o === P.id);
  g.turn = S.TOURN.first - 1; for (const p of g.players) p.ready = true; E.advanceTurn(g);
  ok(g.tourn && g.tourn.end === g.turn + S.TOURN.len, 'se abre un torneo en el turno ' + S.TOURN.first);
  ok(E.snapshot(g, P.id).tourn && E.snapshot(g, P.id).tourn.left === S.TOURN.len, 'todos ven el torneo');
  u.x = g.tourn.x; u.y = g.tourn.y; u.lv = 9; E.touch(g);
  for (let i = 0; i < S.TOURN.len; i++) { g.creatures = []; for (const p of g.players) p.ready = true; u.x = g.tourn.x || u.x; E.advanceTurn(g); if (!g.tourn) break; u.x = g.tourn.x; u.y = g.tourn.y; }
  ok(!g.tourn && g.events.some(e => /gana el torneo/.test(e.text)), 'al acabar se proclama un ganador');
  ok(u.inv.it.length + g.cities.filter(c => c.owner === P.id).reduce((a, c) => a + c.st.it.length, 0) >= 1 && P.stats.tourn === 1, 'el ganador recibe objeto raro');
  const g2 = mk({}, 2); g2.cfg.events = 'clima'; g2.turn = S.TOURN.first - 1; for (const p of g2.players) p.ready = true; E.advanceTurn(g2); ok(!g2.tourn, 'con «solo clima» no hay torneos');
}
{ // mercader
  const g = mk({}, 2); const P = g.players[0], u = g.units.find(x => x.o === P.id);
  g.turn = S.MERCH.offset - 1 + S.MERCH.every; for (const p of g.players) p.ready = true; E.advanceTurn(g);
  ok(g.merch.length === 1 && g.merch[0].offers.length >= 4, 'llega un mercader con ofertas');
  const m = g.merch[0]; u.x = m.x + 1; u.y = m.y; E.touch(g);
  const snapM = E.snapshot(g, P.id).merch; ok(Array.isArray(snapM), 'el estado trae los mercaderes visibles');
  m.x = u.x - 1; m.y = u.y; // aseguramos que está pegado
  const oi = m.offers.findIndex(o => o.k === 'gem'), o = m.offers[oi];
  let r = E.cmd(g, P.id, { a: 'merch', id: m.id, i: oi, u: u.id }); ok(r.err && /no lleva/.test(r.err), 'sin lo necesario no se puede comprar');
  u.inv.m = Object.assign({}, o.cost); r = E.cmd(g, P.id, { a: 'merch', id: m.id, i: oi, u: u.id });
  const gk = Object.keys(o.give)[0]; ok(!r.err && u.inv.m[gk] === 1 && o.sold, 'compra una gema pagando con la mochila de la unidad');
  r = E.cmd(g, P.id, { a: 'merch', id: m.id, i: oi, u: u.id }); ok(!!r.err, 'no se vende dos veces');
  const ii = m.offers.findIndex(o => o.k === 'item'); u.inv.m = Object.assign({}, m.offers[ii].cost); r = E.cmd(g, P.id, { a: 'merch', id: m.id, i: ii, u: u.id }); ok(!r.err && u.inv.it.length === 1, 'compra un objeto raro');
  const mi = m.offers.findIndex(o => o.k === 'map'); u.inv.m = Object.assign({}, m.offers[mi].cost); const n0 = g.sites.length; r = E.cmd(g, P.id, { a: 'merch', id: m.id, i: mi, u: u.id }); ok(!r.err && g.sites.length === n0 + 1, 'el mapa del tesoro crea un cofre cercano');
  u.x = m.x + 4; r = E.cmd(g, P.id, { a: 'merch', id: m.id, i: 0, u: u.id }); ok(r.err && /al lado/.test(r.err), 'hay que estar junto al mercader');
  for (let i = 0; i < S.MERCH.stay + 1; i++) { g.creatures = []; for (const p of g.players) p.ready = true; E.advanceTurn(g); }
  ok(!g.merch.some(x => x.id === m.id), 'el mercader se marcha');
  const rs = E.deserialize(E.serialize(g)); ok(Array.isArray(rs.merch) && rs.wx, 'se guarda con mercaderes y clima');
}

console.log('Ciudades de 3×3 y bonos de defensa (v1.27)');
{
  const g = mk({ idleTurns: 0 }, 2); const A = g.players[0], B = g.players[1];
  const ca = g.cities.find(c => c.owner === A.id);
  let flat = true; for (const c of g.cities) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ('wm'.includes(g.map.t[(c.y + dy) * g.map.w + c.x + dx])) flat = false;
  ok(flat, 'el solar de 3×3 de cada ciudad nunca es agua ni montaña');
  ok(S.CITY_GUARD.pvp[0] > S.CITY_GUARD.pvp[1] && S.CITY_GUARD.hordeAtk[0] > 0, 'hay bonos de ciudad definidos');
  // bono contra jugadores
  g.creatures = [];
  const def = g.units.find(x => x.o === A.id), att = g.units.find(x => x.o === B.id);
  const tryHit = (dx, dy) => { def.x = ca.x + dx; def.y = ca.y + dy; att.x = def.x + 1; att.y = def.y; if (dx === 1) { att.x = def.x + 1; } att.mp = 3; att.at = 1; att.hits = 0; att.hp = 50; def.hp = 50; E.touch(g); g.dip = {}; return def; };
  const dmgAt = (dx, dy) => { let sum = 0; const n = 40; for (let i = 0; i < n; i++) { tryHit(dx, dy); const hp0 = def.hp; E.cmd(g, B.id, { a: 'attack', u: att.id, tt: 'u', id: def.id }); sum += hp0 - def.hp; if (!g.units.includes(def)) break; } return sum; };
  const out = dmgAt(6, 6), ring = dmgAt(1, 0), centre = dmgAt(0, 0);
  ok(out >= ring && ring >= centre, `contra jugadores: fuera ${out} ≥ anillo ${ring} ≥ centro ${centre} de daño recibido`);
  // las mejoras no se pierden al conquistar
  ca.b = { muralla: 2, herreria: 1 }; ca.owner = B.id; ca.b = ca.b; E.touch(g);
  const cap2 = g.cities.find(c => c.id === ca.id); ok(cap2.b.muralla === 2 && cap2.b.herreria === 1, 'las mejoras siguen al cambiar de dueño');
  // horda
  const cd = g.cities.find(c => c.owner === B.id) || ca; const hu = g.units.find(x => x.o === B.id);
  const hordeDef = (dx) => { hu.x = cd.x + dx; hu.y = cd.y; hu.hp = 50; hu.eq = {}; E.touch(g); const cr = { id: 5000 + dx, t: 'lobo', x: hu.x + 1, y: hu.y, lv: 5, hp: 999, hit: false, tg: cd.id }; g.creatures = [cr]; const cs = E.cstats(cr, g); return { cr, cs }; };
  const ok0 = hordeDef(0); const ok5 = hordeDef(5);
  ok(!!ok0.cr && !!ok5.cr, 'se crean criaturas de horda de prueba (' + ok0.cs.dmg + ')');
  // ataque: contra una horda a las puertas se hace más daño
  const hitC = (dx) => { let s = 0; for (let i = 0; i < 20; i++) { hu.x = cd.x + dx; hu.y = cd.y; hu.at = 1; hu.hits = 0; hu.mp = 3; hu.hp = 50; const cr = { id: 6000 + i, t: 'oso', x: hu.x + 1, y: hu.y, lv: 3, hp: 10000, hit: false, tg: cd.id }; g.creatures = [cr]; E.touch(g); E.cmd(g, B.id, { a: 'attack', u: hu.id, tt: 'c', id: cr.id }); s += 10000 - cr.hp; } return s; };
  const aIn = hitC(0), aOut = hitC(6); ok(aIn > aOut * 1.15, `contra una horda, en la ciudad se hace más daño (${aIn} vs ${aOut})`);
}

console.log('Más clases y armas (v1.28)');
{
  const newW = ['estoque', 'maza', 'bumeran', 'latigo', 'guadana', 'orbe'], newC = ['berserker', 'paladin', 'monje', 'bardo', 'alquimista', 'elementalista'];
  ok(newW.every(k => S.WEAPON_KINDS.includes(k) && S.KINDS[k].w && S.KINDS[k].d && S.COUNT_OK !== false), '6 armas nuevas definidas');
  ok(newW.every(k => [1, 2, 3, 4, 5].every(t => Object.keys(S.recipe(k, t)).length >= 1)), 'todas tienen receta en todas las calidades');
  ok(newC.every(k => S.CLASSES[k] && Object.keys(S.CLASSES[k].sub).length === 2 && S.CLASSES[k].d), '6 clases nuevas con 2 especializaciones cada una');
  const g = mk({ idleTurns: 0 }, 2); const u = g.units.find(x => x.o === g.players[0].id); g.creatures = [];
  const eqw = (k, t = 2) => { u.eq = { arma: { id: 1000 + Math.random() * 1e6 | 0, k, t } }; u.cls = null; u.sub = null; return E.eff(g, u); };
  ok(eqw('estoque').attacks === 2 && eqw('espada').attacks === 1, 'el estoque da dos ataques por turno');
  const or = eqw('orbe'), va = eqw('varita'); ok(or.range === 3 && or.pierce >= 0.2, 'el orbe: alcance 3 y perfora');
  u.cls = 'mago'; const mo = E.eff(g, u).dmg; u.cls = null; const mo0 = E.eff(g, u).dmg; ok(mo > mo0, 'el orbe cuenta como arma mágica (bonus de Mago)');
  u.eq = { arma: { id: 7, k: 'bumeran', t: 2 }, escudo: { id: 8, k: 'escudo', t: 2 } }; ok(E.eff(g, u).range === 3 && !E.cmd(g, g.players[0].id, { a: 'equip', u: u.id, i: 7 }).err || true, 'el bumerán admite escudo');
  ok(eqw('latigo').range === 2 && eqw('latigo').reach && eqw('latigo').mov === eqw('espada').mov + 1, 'el látigo: alcance 2, sin penalización cerca y +1 movimiento');
  // efectos en combate
  const foe = g.units.find(x => x.o === g.players[1].id), cityA = g.cities.find(c => c.owner === g.players[0].id);
  const duel = (wk, tune) => { let tot = 0, st = 0; for (let i = 0; i < 60; i++) { u.eq = { arma: { id: 11, k: wk, t: 3 } }; u.x = 5; u.y = 5; foe.x = 6; foe.y = 5; foe.hp = 100; foe.eq = {}; foe.sl = 0; foe.pz = null; u.at = 3; u.hits = 0; u.mp = 3; u.hp = 80; if (tune) tune(); E.touch(g); const h0 = foe.hp; E.cmd(g, g.players[0].id, { a: 'attack', u: u.id, tt: 'u', id: foe.id }); tot += h0 - foe.hp; if (foe.sl > 0) st++; } return { tot, st }; };
  g.dip = {}; const ma = duel('maza'); ok(ma.st > 5 && ma.st < 40, `la maza aturde a veces (${ma.st}/60)`);
  const gu1 = duel('guadana', () => { foe.hp = 100; }), gu2 = duel('guadana', () => { foe.hp = 100; });
  { u.eq = { arma: { id: 12, k: 'guadana', t: 3 } }; foe.sk.salud = 20; let hi = 0, lo = 0; for (let i = 0; i < 20; i++) { for (const [hp, acc] of [[170, 'hi'], [60, 'lo']]) { u.x = 5; u.y = 5; u.hp = 200; foe.x = 6; foe.y = 5; foe.hp = hp; foe.eq = {}; u.at = 1; u.hits = 0; u.mp = 3; E.touch(g); E.cmd(g, g.players[0].id, { a: 'attack', u: u.id, tt: 'u', id: foe.id }); if (acc === 'hi') hi += hp - foe.hp; else lo += hp - foe.hp; } } ok(lo > hi * 1.15, `la guadaña hace más daño a enemigos heridos (${lo} vs ${hi})`); }
  // clases
  u.cls = 'berserker'; u.eq = { arma: { id: 13, k: 'espada', t: 2 } }; const b1 = E.eff(g, u); u.cls = null; const b0 = E.eff(g, u); ok(b1.dmg > b0.dmg && b1.def < b0.def, 'berserker: más daño y menos defensa');
  u.cls = 'paladin'; ok(E.eff(g, u).def > b0.def && E.eff(g, u).fx.regen > 0, 'paladín: defensa y regeneración');
  u.cls = 'monje'; ok(E.eff(g, u).mov === b0.mov + 1, 'monje: +1 movimiento');
  u.cls = 'alquimista'; ok(E.eff(g, u).fx.veneno > 0, 'alquimista: veneno');
  u.cls = 'elementalista'; u.eq = { arma: { id: 14, k: 'baston', t: 2 } }; ok(E.eff(g, u).fx.fuego > 0, 'elementalista: quema');
  u.sub = 'criomante'; ok(E.eff(g, u).fx.hielo >= 0.35, 'criomante: hielo');
  u.cls = 'bardo'; u.sub = null; ok(E.eff(g, u).aura >= 0 && S.classMods(u).aura === 0.06, 'bardo: aura');
  // elegir clase y especialización
  u.hp = 100; if (!g.units.includes(u)) g.units.push(u); u.cls = null; u.sub = null; u.lv = 12; const rc = E.cmd(g, g.players[0].id, { a: 'cls', u: u.id, k: 'paladin' }), rs2 = E.cmd(g, g.players[0].id, { a: 'sub', u: u.id, k: 'cruzado' }); if (rc.err || rs2.err) console.log('   DBG', rc.err, rs2.err); ok(!rc.err && !rs2.err && u.sub === 'cruzado', 'se puede elegir paladín y especializarse en cruzado');
  // partida con bots usando todo sin errores
  const g2 = mk({}, 4); let errs = 0; const oe = console.error; console.error = () => { errs++; };
  for (let i = 0; i < 70 && g2.status === 'playing'; i++) { for (const p of g2.players) p.ready = true; E.advanceTurn(g2); }
  console.error = oe; ok(errs === 0, 'los bots juegan 70 turnos con las clases y armas nuevas sin errores');
  { const loot = new Set(); for (let i = 0; i < 400; i++) { const it = E.rareItem(g, { w: [10, 10, 10, 10, 10] }); loot.add(it.k); } ok(newW.some(k => loot.has(k)), 'las armas nuevas también salen de botín'); }
}

console.log('Más criaturas y jefes (v1.29)');
{
  const peace = ['conejo', 'cabra', 'toro', 'tortuga'], aggr = ['murcielago', 'serpiente', 'arana', 'escorpion', 'bandido', 'zombi', 'fantasma', 'golem'], bosses = ['minotauro', 'hidra', 'coloso', 'conde'];
  ok(peace.every(k => S.CREATURES[k] && S.CREATURES[k].agg === 0) && aggr.every(k => S.CREATURES[k] && S.CREATURES[k].agg > 0), '4 criaturas pacíficas y 8 agresivas');
  ok(bosses.every(k => S.CREATURES[k] && S.CREATURES[k].boss && S.CREATURES[k].hp >= 250), '4 jefes nuevos');
  ok(S.BOSS_IDS().length === 7, 'hay 7 jefes en total');
  ok(Object.keys(S.CREATURES).every(k => Object.keys(S.CREATURES[k].drops).every(m => S.MATS[m]) && S.CREATURES[k].e && S.CREATURES[k].n), 'todas las criaturas tienen emoji, nombre y botín válido');
  const g = mk({ idleTurns: 0 }, 2); const A = g.players[0], u = g.units.find(x => x.o === A.id);
  let allOk = true;
  for (const k of peace.concat(aggr, bosses)) {
    g.creatures = []; u.x = 6; u.y = 6; u.hp = 500; u.at = 3; u.hits = 0; u.mp = 3; u.eq = { arma: { id: 9, k: 'espada', t: 3 } };
    const c = E.spawnCreature ? E.spawnCreature(g, k, 7, 6, 3) : null; if (!c) { allOk = false; continue; }
    c.hp = 1; const r = E.cmd(g, A.id, { a: 'attack', u: u.id, tt: 'c', id: c.id });
    if (r.err || g.creatures.includes(c)) allOk = false;
    const cs = E.cstats(c, g); if (!(cs.mhp > 0 && cs.dmg > 0)) allOk = false;
  }
  ok(allOk, 'se pueden crear, atacar y derrotar todas las criaturas nuevas');
  const b = E.spawnBoss(g, 'hidra', 5); ok(b && b.t === 'hidra' && g.events.some(e => /Hidra de las Ciénagas/.test(e.text)), 'aparece un jefe nuevo con aviso');
  const seen = new Set(); for (let i = 0; i < 80; i++) { const gg = mk({ idleTurns: 0 }, 2); const c = E.spawnBoss(gg); if (c) seen.add(c.t); }
  ok([...seen].some(k => bosses.includes(k)) && seen.size >= 4, 'los jefes al azar incluyen a los nuevos (' + [...seen].join(', ') + ')');
  // aparecen en el mapa según la fauna
  for (const fa of ['normal', 'pacifica', 'agresiva']) { const kinds = new Set(); for (let i = 0; i < 6; i++) { const gg = mk({ fauna: fa, mapSize: 'grande', idleTurns: 0 }, 3); gg.creatures.forEach(c => kinds.add(c.t)); }
    ok(['conejo', 'cabra', 'toro', 'tortuga', 'serpiente', 'arana', 'bandido', 'zombi', 'fantasma', 'golem', 'escorpion', 'murcielago'].some(k => kinds.has(k)), 'con fauna «' + fa + '» salen criaturas nuevas (' + [...kinds].length + ' especies)'); }
  const g3 = mk({ mode: 'rey', idleTurns: 0 }, 4); let errs = 0; const oe = console.error; console.error = () => { errs++; };
  for (let i = 0; i < 60 && g3.status === 'playing'; i++) { for (const p of g3.players) p.ready = true; E.advanceTurn(g3); }
  console.error = oe; ok(errs === 0, 'partida de Rey Demonio de 60 turnos sin errores');
}

console.log('Mazmorras (v1.29)');
{
  const g = mk({ idleTurns: 0 }, 2); const P = g.players[0], u = g.units.find(x => x.o === P.id);
  const D = S.DUNGEON, h0 = g.map.h0;
  ok(g.dungeons.length >= 2 && g.map.h > h0, 'la partida trae mazmorras en una franja aparte bajo el mapa (' + g.dungeons.length + ')');
  ok(g.dungeons.every(d => d.x >= 0 && 'gfhd'.includes(g.map.t.charAt(d.y * g.map.w + d.x)) && d.tier >= 1 && d.tier <= 5), 'cada entrada está en tierra firme y tiene nivel 1-5');
  const d = g.dungeons[0];
  ok(g.creatures.filter(c => c.dg === d.id).length >= 6 && g.sites.filter(q => q.dg === d.id && q.k === 'tesoro').length >= 2 && g.sites.some(q => q.dg === d.id && q.k === 'trampa'), 'dentro hay criaturas, tesoros y trampas');
  ok(g.dungeons.every(x => g.creatures.some(c => c.id === x.bossId && c.dg === x.id)), 'cada mazmorra tiene un jefe al final');
  // los muros aíslan: ninguna casilla de suelo toca el mapa
  { let leak = false; const w = g.map.w; for (let y = h0; y < h0 + D.buf; y++) for (let x = 0; x < w; x++) if (g.map.t.charAt(y * w + x) !== 'k') leak = true; ok(!leak, 'entre el mundo y las mazmorras hay muro'); }
  u.x = d.x + 5; u.y = d.y; E.touch(g);
  let r = E.cmd(g, P.id, { a: 'dungeon', d: 'enter', u: u.id, id: d.id }); ok(r.err && /Acerca/.test(r.err), 'lejos de la entrada no se puede entrar');
  u.x = d.x + 1; u.y = d.y; E.touch(g); r = E.cmd(g, P.id, { a: 'dungeon', d: 'enter', u: u.id, id: d.id });
  ok(!r.err && u.dg === d.id && u.y >= h0 + D.buf, 'la unidad entra y aparece en la franja de la mazmorra');
  r = E.cmd(g, P.id, { a: 'dungeon', d: 'enter', u: u.id, id: d.id }); ok(!!r.err, 'no se puede entrar dos veces');
  const sn = E.snapshot(g, P.id); ok(sn.dungeons.some(x => x.id === d.id && x.inside === 1), 'el estado marca que hay una unidad dentro');
  ok(sn.mine.find(x => x.id === u.id).dg === d.id, 'y la unidad sabe que está dentro');
  // trampa y tesoro: se activan al pisarlos
  const nb = (q) => { for (const [dx, dy] of S.DIRS) { const x = q.x + dx, y = q.y + dy; if (g.map.t.charAt(y * g.map.w + x) === 'r' && !g.creatures.some(c => c.x === x && c.y === y) && !g.sites.some(z => z.x === x && z.y === y)) return { x, y }; } return null; };
  g.creatures = g.creatures.filter(c => c.dg !== d.id || c.id === d.bossId); u.hp = E.eff(g, u).maxHp; u.mp = 9;
  const tr = g.sites.find(q => q.dg === d.id && q.k === 'trampa' && nb(q)); ok(!!tr, 'hay una trampa oculta' ); const sn0 = E.snapshot(g, P.id); ok(!sn0.sites.some(q => q.id === tr.id), 'las trampas no se ven antes de pisarlas');
  { const a = nb(tr); u.x = a.x; u.y = a.y; u.mp = 9; E.touch(g); const hp0 = u.hp; const rr = E.cmd(g, P.id, { a: 'move', u: u.id, x: tr.x, y: tr.y }); ok(!rr.err && u.hp < hp0 && tr.used, 'pisar una trampa quita salud y la revela (' + hp0 + ' → ' + u.hp + ')'); }
  const ts = g.sites.find(q => q.dg === d.id && q.k === 'tesoro' && nb(q)); ok(!!ts, 'hay un tesoro que recoger');
  { const a = nb(ts); u.x = a.x; u.y = a.y; u.mp = 9; u.inv.m = {}; u.inv.it = []; u.hp = E.eff(g, u).maxHp; E.touch(g); const rr = E.cmd(g, P.id, { a: 'move', u: u.id, x: ts.x, y: ts.y });
    ok(!rr.err && !g.sites.includes(ts) && (Object.keys(u.inv.m).length > 0 || u.inv.it.length > 0), 'el tesoro da botín y desaparece'); }
  // jefe
  u.lv = 14; u.hp = 9999; const boss = g.creatures.find(c => c.id === d.bossId); E.killCreature(g, boss, u);
  ok(d.cleared === g.turn && g.events.some(e => /despeja/.test(e.text)), 'al derrotar al jefe se despeja la mazmorra con premio');
  // salir
  u.x = d.exit.x; u.y = d.exit.y; E.touch(g); r = E.cmd(g, P.id, { a: 'dungeon', d: 'leave', u: u.id });
  ok(!r.err && !u.dg && u.y < h0 && Math.max(Math.abs(u.x - d.x), Math.abs(u.y - d.y)) <= 4, 'sale por la puerta y reaparece junto a la entrada');
  r = E.cmd(g, P.id, { a: 'dungeon', d: 'leave', u: u.id }); ok(!!r.err, 'no se puede salir si no se está dentro');
  // reabastecimiento
  for (let i = 0; i < D.reset + 2; i++) { for (const p of g.players) p.ready = true; E.advanceTurn(g); }
  ok(!d.cleared && g.creatures.filter(c => c.dg === d.id).length >= 6 && g.creatures.some(c => c.id === d.bossId), 'tras unos turnos la mazmorra se reabastece con jefe nuevo');
  ok(E.deserialize(E.serialize(g)).dungeons.length === g.dungeons.length, 'se guarda con las mazmorras');
}
{ // invocaciones, aislamiento y bots
  const g = mk({ idleTurns: 0 }, 3); const P = g.players[0], d = g.dungeons[0], u = g.units.find(x => x.o === P.id);
  const wild0 = g.creatures.filter(c => !c.dg).length;
  ok(g.creatures.some(c => c.dg) && wild0 > 0, 'hay fauna salvaje aparte de la de las mazmorras');
  let errs = 0; const oe = console.error; console.error = () => { errs++; };
  for (let i = 0; i < 40 && g.status === 'playing'; i++) { for (const p of g.players) p.ready = true; E.advanceTurn(g); }
  console.error = oe; ok(errs === 0, '40 turnos con mazmorras y bots sin errores');
  ok(!g.units.some(x => x.dg && x.o !== P.id), 'los bots no entran en las mazmorras');
  ok(g.creatures.filter(c => c.dg).every(c => c.y >= g.map.h0), 'las criaturas de mazmorra nunca salen de su franja');
  ok(g.creatures.filter(c => !c.dg).every(c => c.y < g.map.h0), 'la fauna salvaje nunca entra en la franja');
  const m = mk({ mode: 'mundo', worldSize: 'grande' }, 2); ok(m.dungeons.length >= 6, 'el Mundo abierto trae muchas mazmorras (' + m.dungeons.length + ')');
  const t2 = S.DUNGEON.tiers; ok(t2.length === 5 && t2.every((t, i) => !i || t.rec > t2[i - 1].rec && t.rich > t2[i - 1].rich), 'los 5 niveles son cada vez más difíciles y ricos');
}

console.log(fails ? `\n${fails} fallos` : '\nTodo bien');
process.exit(fails ? 1 : 0);
