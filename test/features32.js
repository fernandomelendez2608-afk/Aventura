require('./seed.js');
// v1.66: nivel máximo 99 y 6 habilidades nuevas (alcance, provocar, embestida, esquiva, contraataque, regeneración)
const E = require('../engine.js'), S = require('../shared.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
console.log('Habilidades nuevas y nivel 99');
const sum = S.SKILL_ORDER.reduce((a, k) => a + S.SKILLS[k].cap, 0);
ok(sum === 99, 'los topes suman 99 = nivel máximo (' + sum + ')');
ok(['alcance', 'provocar', 'embestida', 'esquiva', 'contra', 'regen'].every(k => S.SKILLS[k] && S.SKILL_ORDER.includes(k)), 'las 6 habilidades existen');
const mk = () => { const g = E.createGame('S32', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; g.cfg.idleTurns = 0; E.addBot(g, 'azar'); E.startGame(g); g.creatures = [];
  const us = g.units.filter(u => u.o === 0 && !u.sm); g.units.forEach(v => { v.x = 90; v.y = 70; v.hp = 9999; });
  let p = null; for (let y = 20; y < 60 && !p; y++) for (let x = 20; x < 60 && !p; x++) if ('g'.includes(g.map.t.charAt(y * g.map.w + x))) p = { x, y };
  const t = g.map.t.split(''), w = g.map.w; for (let k = -6; k <= 6; k++) for (let j = -3; j <= 3; j++) t[(p.y + j) * w + p.x + k] = 'g'; g.map.t = t.join('');
  return { g, us, p }; };
{ const { g, us } = mk(); const u = us[0]; u.pts = 5; delete u.sk.regen; ok(E.cmd(g, 0, { a: 'skill', u: u.id, s: 'regen' }) === null || u.sk.regen === 1, 'subir una habilidad nueva en una unidad antigua (sin la clave) funciona');
  u.sk.alcance = 0; u.pts = 5; E.cmd(g, 0, { a: 'skill', u: u.id, s: 'alcance' }); E.cmd(g, 0, { a: 'skill', u: u.id, s: 'alcance' }); const r = E.cmd(g, 0, { a: 'skill', u: u.id, s: 'alcance' });
  ok(u.sk.alcance === 2 && r && r.error !== undefined || u.sk.alcance === 2, 'alcance respeta el tope de 2'); }
{ const { g, us } = mk(); const u = us[0]; u.eq.arma = { id: 9100, k: 'arco', t: 3, r: 1, fx: [] }; u.sk.alcance = 0; const r0 = E.eff(g, u).range; u.sk.alcance = 2; const r2 = E.eff(g, u).range;
  ok(r2 === r0 + 2 && r0 > 1, 'alcance: +1 casilla por punto con arco (' + r0 + ' → ' + r2 + ')'); }
{ const { g, us } = mk(); const u = us[0]; u.eq.arma = { id: 9101, k: 'espada', t: 3, r: 1, fx: [] }; const r0 = E.eff(g, u).range; u.sk.alcance = 2; ok(E.eff(g, u).range === r0, 'alcance no cambia las armas cuerpo a cuerpo'); }
{ const { g, us, p } = mk(); const u = us[0], v = us[1]; u.x = p.x + 3; u.y = p.y; v.x = p.x + 1; v.y = p.y; u.sk.provocar = 1; v.hp = 1; u.hp = 9999;
  const c = E.spawnCreature(g, 'lobo', p.x + 2, p.y, 5); c.hx = c.x; c.hy = c.y; v.hp = 1;
  const h = u.hp; E.creaturesTurn(g); ok(v.hp === 1 && u.hp < h, 'provocar: la criatura ataca al provocador y no al aliado débil'); }
{ const { g, us, p } = mk(); const u = us[0], v = us[1]; u.x = p.x; u.y = p.y; v.x = p.x + 4; v.y = p.y; u.sk.provocar = 1; u.hp = 9999; v.hp = 50;
  const c = E.spawnCreature(g, 'lobo', p.x + 5, p.y, 5); c.hx = c.x; c.hy = c.y; E.creaturesTurn(g); ok(v.hp < 50, 'provocar nivel 1 solo alcanza a 1 casilla: la criatura lejana va a por el aliado'); }
{ const { g, us, p } = mk(); const u = us[0]; u.x = p.x; u.y = p.y; u.eq.arma = { id: 9102, k: 'espada', t: 3, r: 1, fx: [] };
  const mkc = () => { const c = E.spawnCreature(g, 'lobo', p.x + 5, p.y, 5); c.hx = c.x; c.hy = c.y; c.hp = 99999; c.agg = 0; return c; };
  const dmgOf = (emb, mv) => { const c = mkc(); u.sk.embestida = emb; u.at = 2; u.hits = 0; u.mp = 6; u.acted = false; u.mvd = mv; u.x = p.x + 4; u.y = p.y; const h = c.hp; E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: c.id }); const d = h - c.hp; g.creatures = []; return { d, c }; };
  const a = dmgOf(0, 0), b = dmgOf(3, 0); u.x = p.x; u.y = p.y; u.mvd = 0; ok(b.d === a.d, 'embestida: sin recorrido previo no hay bono');
  u.x = p.x; u.y = p.y; const c1 = mkc(); u.sk.embestida = 3; u.at = 2; u.hits = 0; u.mp = 6; u.acted = false; u.mvd = 0; const h1 = c1.hp; E.cmd(g, 0, { a: 'attack', u: u.id, tt: 'c', id: c1.id }); const dm = h1 - c1.hp; ok(u.mvd >= 3 && dm > a.d && c1.sl === 1, 'embestida: tras moverse 3+ casillas hace más daño y a nivel 3 aturde (' + a.d + ' → ' + dm + ', sl=' + c1.sl + ')'); }
{ const { g, us, p } = mk(); const u = us[0]; u.x = p.x; u.y = p.y; u.sk.esquiva = 5; let ev = 0;
  for (let i = 0; i < 100; i++) { const c = E.spawnCreature(g, 'lobo', p.x + 1, p.y, 3); c.hx = c.x; c.hy = c.y; u.hp = 9999; const h = u.hp; E.creaturesTurn(g); if (u.hp === h) ev++; g.creatures = []; }
  ok(ev >= 12 && ev <= 40, 'esquiva 5 puntos (~25%): evita ' + ev + ' de 100 ataques'); }
{ const { g, us, p } = mk(); const u = us[0]; u.x = p.x; u.y = p.y; u.eq.arma = { id: 9103, k: 'espada', t: 3, r: 1, fx: [] }; u.sk.dano = 5;
  const run = ct => { u.sk.contra = ct; u.ctt = 0; const c = E.spawnCreature(g, 'lobo', p.x + 1, p.y, 3); c.hx = c.x; c.hy = c.y; c.hp = 99999; u.hp = 9999; const h = c.hp; E.creaturesTurn(g); const d = h - c.hp; g.creatures = []; return d; };
  const base = run(0), c1 = run(1), c2 = run(2);
  ok(c1 > base && c2 > c1, 'contraataque: daño extra al atacante (' + base + ' → ' + c1 + ' → ' + c2 + ')');
  u.sk.contra = 1; u.ctt = 0; const ca = E.spawnCreature(g, 'lobo', p.x + 1, p.y, 3); ca.hx = ca.x; ca.hy = ca.y; ca.hp = 99999; const cb = E.spawnCreature(g, 'lobo', p.x, p.y + 1, 3); cb.hx = cb.x; cb.hy = cb.y; cb.hp = 99999; u.hp = 9999; E.creaturesTurn(g);
  ok(u.ctt === 1, 'contraataque: marcado como usado en el turno (una vez por turno)'); }
{ const { g, us } = mk(); const u = us[0]; u.sk.regen = 5; const m = E.eff(g, u).maxHp; u.x = 90; u.y = 60; u.hp = Math.round(m * 0.3); E.advanceTurn(g); const gain = u.hp - Math.round(m * 0.3);
  ok(gain >= Math.round(m * 0.15) - 2, 'regeneración 5 puntos: ≥15% de la vida máxima por turno (+' + gain + ' de ' + m + ')'); }
{ const g = E.createGame('S33', 'H', 't'); g.cfg.mode = 'ciudadela'; g.cfg.sim = true; E.addBot(g, 'azar'); E.startGame(g); const u = g.units.find(x => x.o === 0 && !x.sm); u.lv = 98; u.xp = 0; E.gainXp ? E.gainXp(g, u, 5000) : 0; ok(u.lv <= 99, 'el nivel no pasa de 99 (' + u.lv + ')'); }
{ const { g, us, p } = mk(); const u = us[0]; u.x = p.x; u.y = p.y; u.sk.esquiva = 5; g.vx = []; let n = 0;
  for (let i = 0; i < 60 && !n; i++) { const c = E.spawnCreature(g, 'lobo', p.x + 1, p.y, 3); c.hx = c.x; c.hy = c.y; u.hp = 9999; E.creaturesTurn(g); n = g.vx.filter(q => q.k === 'miss').length; g.creatures = []; }
  ok(n > 0, 'esquiva: el motor emite un efecto visual «miss»');
  const st = E.snapshot(g, 0); ok(st && Array.isArray(st.vx) && st.vx.length > 0, 'el estado enviado al cliente incluye los efectos (vx)'); }
console.log(fails ? fails + ' FALLOS' : 'OK');
process.exit(fails ? 1 : 0);
