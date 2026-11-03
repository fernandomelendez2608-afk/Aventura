/* Aventura de almas — datos y utilidades compartidas (servidor + celular) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SH = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SKILLS = {
    dano:     { n: 'Daño',         cap: 10, d: '+2 de daño por punto' },
    salud:    { n: 'Salud',        cap: 10, d: '+6 de salud máxima por punto' },
    movilidad:{ n: 'Movilidad',    cap: 2,  d: '+1 casilla de movimiento por punto (máx. 2)' },
    medico:   { n: 'Médico',       cap: 10, d: 'Al iniciar el turno cura a los aliados adyacentes un 4% de su salud por punto' },
    doble:    { n: 'Doble ataque', cap: 1,  d: 'Ataca dos veces por turno (el segundo golpe hace 60%). Solo se aprende una vez' },
    defensa:  { n: 'Defensa',      cap: 10, d: '+2 de defensa por punto' },
    general:  { n: 'General',      cap: 10, d: 'Aliados adyacentes ganan +2% de salud y defensa por punto' },
  };
  const SKILL_ORDER = ['dano', 'salud', 'defensa', 'movilidad', 'medico', 'doble', 'general'];

  const MATS = {
    cuero: { n: 'Cuero', e: '🟫' },
    hueso: { n: 'Hueso', e: '🦴' },
    hierro: { n: 'Hierro', e: '⛓️' },
    acero: { n: 'Acero', e: '🔩' },
    alma: { n: 'Alma', e: '👻' },
  };
  const MAT_ORDER = ['cuero', 'hueso', 'hierro', 'acero', 'alma'];

  const TIER_NAMES = [null, 'Cuero', 'Hierro', 'Acero', 'Alma'];
  const WM = [0, 1, 1.5, 2.1, 3.0];   // multiplicador de daño de armas
  const AM = [0, 1, 1.7, 2.6, 3.8];   // multiplicador de defensa de armaduras

  const KINDS = {
    daga:      { n: 'Daga',        e: '🗡️', slot: 'arma',       w: true, base: 4,  range: 1, min: 1, pierce: 0.25, mov: 1, d: 'Ignora 25% de defensa, +1 movimiento' },
    espada:    { n: 'Espada',      e: '⚔️', slot: 'arma',       w: true, base: 7,  range: 1, min: 1, d: 'Arma cuerpo a cuerpo equilibrada' },
    arco:      { n: 'Arco',        e: '🏹', slot: 'arma',       w: true, base: 5,  range: 3, min: 1, two: true, d: 'Alcance 3. Dos manos' },
    arcolargo: { n: 'Arco largo',  e: '🎯', slot: 'arma',       w: true, base: 6,  range: 5, min: 2, two: true, d: 'Alcance 5 (no dispara a casillas adyacentes). Dos manos' },
    ballesta:  { n: 'Ballesta',    e: '🔱', slot: 'arma',       w: true, base: 10, range: 4, min: 1, two: true, pierce: 0.4, single: true, d: 'Alcance 4, ignora 40% de defensa, un solo disparo por turno. Dos manos' },
    escudo:    { n: 'Escudo',      e: '🛡️', slot: 'escudo',     def: 4, d: 'Solo con armas de una mano' },
    casco:     { n: 'Casco',       e: '⛑️', slot: 'casco',      def: 2 },
    guantes:   { n: 'Guantes',     e: '🧤', slot: 'guantes',    def: 1 },
    hombreras: { n: 'Hombreras',   e: '🦺', slot: 'hombreras',  def: 2 },
    pechera:   { n: 'Pechera',     e: '🥋', slot: 'pechera',    def: 4 },
    pantalones:{ n: 'Pantalones',  e: '👖', slot: 'pantalones', def: 3 },
    botas:     { n: 'Botas',       e: '🥾', slot: 'botas',      def: 1 },
  };
  const WEAPON_KINDS = ['daga', 'espada', 'arco', 'arcolargo', 'ballesta'];
  const GEAR_KINDS = ['escudo', 'casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas'];
  const SLOTS = ['arma', 'escudo', 'casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas'];
  const SLOT_NAMES = { arma: 'Arma', escudo: 'Escudo', casco: 'Casco', guantes: 'Guantes', hombreras: 'Hombreras', pechera: 'Pechera', pantalones: 'Pantalones', botas: 'Botas' };

  const COUNT = { daga: 1, espada: 3, arco: 2, arcolargo: 3, ballesta: 4, escudo: 3, casco: 2, guantes: 1, hombreras: 2, pechera: 4, pantalones: 3, botas: 2 };
  function recipe(kind, t) {
    const weapon = !!KINDS[kind].w;
    const main = [null, weapon ? 'hueso' : 'cuero', 'hierro', 'acero', 'alma'][t];
    const aux = [null, weapon ? 'cuero' : null, 'cuero', 'hierro', 'acero'][t];
    const r = {}; r[main] = COUNT[kind];
    if (aux) r[aux] = (r[aux] || 0) + 1;
    return r;
  }
  function itemValue(it) {
    const k = KINDS[it.k];
    return k.w ? Math.round(k.base * WM[it.t]) : Math.round(k.def * AM[it.t] * 10) / 10;
  }
  function tierName(kind, t) { return t === 1 ? (KINDS[kind].w ? 'Hueso' : 'Cuero') : TIER_NAMES[t]; }
  function itemName(it) { return KINDS[it.k].n + ' de ' + tierName(it.k, it.t); }

  const TERR = {
    g: { n: 'Pradera', c: 1, def: 0 },
    f: { n: 'Bosque', c: 2, def: 3 },
    h: { n: 'Colinas', c: 2, def: 5 },
    m: { n: 'Montaña', c: 99, def: 0 },
    w: { n: 'Agua', c: 99, def: 0 },
  };

  // agg = radio de agresividad (0 = pasivo hasta que lo golpean)
  const CREATURES = {
    ciervo:    { n: 'Ciervo',    e: '🦌', hp: 22,  dmg: 3,  def: 0,  mov: 3, agg: 0, max: 5,  xp: 5,  drops: { cuero: [1, 2], hueso: [0, 1] } },
    jabali:    { n: 'Jabalí',    e: '🐗', hp: 32,  dmg: 5,  def: 1,  mov: 3, agg: 0, max: 5,  xp: 6,  drops: { cuero: [1, 3], hueso: [1, 2] } },
    lobo:      { n: 'Lobo',      e: '🐺', hp: 30,  dmg: 6,  def: 1,  mov: 4, agg: 2, max: 6,  xp: 7,  drops: { cuero: [1, 2], hueso: [1, 2] } },
    oso:       { n: 'Oso',       e: '🐻', hp: 60,  dmg: 10, def: 3,  mov: 3, agg: 0, max: 7,  xp: 12, drops: { cuero: [2, 4], hueso: [2, 3] } },
    goblin:    { n: 'Goblin',    e: '👺', hp: 36,  dmg: 7,  def: 3,  mov: 3, agg: 3, max: 8,  xp: 10, drops: { hierro: [1, 2], cuero: [1, 1], hueso: [0, 1] }, soul: 0.03 },
    esqueleto: { n: 'Esqueleto', e: '💀', hp: 42,  dmg: 8,  def: 4,  mov: 3, agg: 3, max: 9,  xp: 12, drops: { hueso: [2, 4], hierro: [1, 2] }, soul: 0.06 },
    orco:      { n: 'Orco',      e: '👹', hp: 75,  dmg: 13, def: 8,  mov: 3, agg: 4, max: 10, xp: 18, drops: { hierro: [2, 3], acero: [0, 1], cuero: [1, 2] }, soul: 0.05 },
    troll:     { n: 'Troll',     e: '🦍', hp: 120, dmg: 17, def: 10, mov: 2, agg: 4, max: 10, xp: 26, drops: { acero: [1, 3], hierro: [1, 2] }, soul: 0.08 },
    reylobo:   { n: 'Rey Lobo',  e: '🐺', hp: 220, dmg: 20, def: 12, mov: 4, agg: 5, max: 15, xp: 70,  boss: true, drops: { acero: [3, 5], cuero: [4, 6], alma: [2, 3] } },
    liche:     { n: 'Liche',     e: '🧙', hp: 260, dmg: 24, def: 10, mov: 3, agg: 6, max: 15, xp: 90,  boss: true, rng: 4, drops: { alma: [3, 5], acero: [2, 4], hierro: [3, 5] } },
    dragon:    { n: 'Dragón de Ceniza', e: '🐉', hp: 480, dmg: 34, def: 20, mov: 3, agg: 6, max: 15, xp: 160, boss: true, rng: 2, drops: { alma: [5, 8], acero: [4, 6] } },
  };

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  /**
   * Dijkstra limitado por puntos de movimiento.
   * env: { w, h, terr(x,y)->char, occ(x,y)->0 libre|1 aliado (se puede cruzar)|2 bloqueado, stop(x,y)->bool }
   * Devuelve Map(key=y*w+x -> {c: costo, p: previo, end: se puede terminar ahí})
   */
  function reach(env, sx, sy, mp) {
    const w = env.w, h = env.h;
    const res = new Map();
    res.set(sy * w + sx, { c: 0, p: -1, end: false });
    const open = [[0, sx, sy]];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const cur = open.splice(bi, 1)[0];
      const c = cur[0], x = cur[1], y = cur[2];
      const rec = res.get(y * w + x);
      if (rec.c < c) continue;
      if (!(x === sx && y === sy) && env.stop && env.stop(x, y)) continue;
      for (let d = 0; d < 8; d++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const tc = TERR[env.terr(nx, ny)];
        if (!tc || tc.c >= 99) continue;
        const o = env.occ(nx, ny);
        if (o === 2) continue;
        const nc = c + tc.c;
        if (nc > mp) continue;
        const k = ny * w + nx;
        const old = res.get(k);
        if (!old || nc < old.c) {
          res.set(k, { c: nc, p: y * w + x, end: o === 0 });
          open.push([nc, nx, ny]);
        }
      }
    }
    return res;
  }

  return {
    SKILLS, SKILL_ORDER, MATS, MAT_ORDER, TIER_NAMES, WM, AM, KINDS, WEAPON_KINDS, GEAR_KINDS, SLOTS, SLOT_NAMES,
    recipe, itemValue, itemName, tierName, TERR, CREATURES, DIRS, cheb, reach,
  };
});
