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
    hacha:     { n: 'Hacha',       e: '🪓', slot: 'arma',       w: true, base: 8,  range: 1, min: 1, d: 'Más daño que la espada. Una mano (admite escudo)' },
    katana:    { n: 'Katana',      e: '⛩️', slot: 'arma',       w: true, base: 9,  range: 1, min: 1, pierce: 0.2, d: 'Filo afilado: ignora 20% de defensa. Una mano' },
    hachabatalla: { n: 'Hacha de batalla', e: '⚒️', slot: 'arma', w: true, base: 13, range: 1, min: 1, pierce: 0.15, mov: -1, two: true, d: 'Golpe devastador, ignora 15% de defensa, pesada (-1 movimiento). Dos manos' },
    lanza:     { n: 'Lanza',       e: '🪝', slot: 'arma',       w: true, base: 8,  range: 2, min: 1, two: true, reach: true, d: 'Alcance 2 y sin penalización a quemarropa. Dos manos' },
    baston:    { n: 'Báculo',      e: '🪄', slot: 'arma',       w: true, base: 9,  range: 3, min: 1, pierce: 0.25, two: true, d: 'Arma mágica: alcance 3, ignora 25% de defensa. Dos manos' },
    varita:    { n: 'Varita',      e: '✨', slot: 'arma',       w: true, base: 6,  range: 2, min: 1, pierce: 0.2, d: 'Arma mágica: alcance 2, ignora 20% de defensa. Una mano (admite escudo)' },
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
  const WEAPON_KINDS = ['daga', 'espada', 'hacha', 'katana', 'hachabatalla', 'lanza', 'baston', 'varita', 'arco', 'arcolargo', 'ballesta'];
  const GEAR_KINDS = ['escudo', 'casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas'];
  const SLOTS = ['arma', 'escudo', 'casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas'];
  const SLOT_NAMES = { arma: 'Arma', escudo: 'Escudo', casco: 'Casco', guantes: 'Guantes', hombreras: 'Hombreras', pechera: 'Pechera', pantalones: 'Pantalones', botas: 'Botas' };

  const COUNT = { daga: 1, espada: 3, hacha: 3, katana: 4, hachabatalla: 5, lanza: 3, baston: 4, varita: 2, arco: 2, arcolargo: 3, ballesta: 4, escudo: 3, casco: 2, guantes: 1, hombreras: 2, pechera: 4, pantalones: 3, botas: 2 };
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
  // ---- equipo raro: efectos (afijos) ----
  const RARITY = [null, { n: 'Raro', e: '🔷' }, { n: 'Épico', e: '🟣' }];
  const pc = v => Math.round(v * 100) + '%';
  const AFFIX = {
    vida:    { n: 'Robo de vida', e: '🩸', w: true,  v: [0.20, 0.30], d: v => `recupera ${pc(v)} del daño que hace` },
    veneno:  { n: 'Veneno',       e: '☠️', w: true,  v: [0.20, 0.30], d: v => `envenena 3 turnos (${pc(v)} de su daño por turno)` },
    afilado: { n: 'Afilado',      e: '🗡️', w: true,  v: [4, 6],       d: v => `+${v} de daño` },
    certero: { n: 'Certero',      e: '🎯', w: true,  v: [0.20, 0.30], d: v => `ignora ${pc(v)} más de defensa` },
    regen:   { n: 'Regeneración', e: '🌿', w: false, v: [0.08, 0.12], d: v => `cura ${pc(v)} de la salud al empezar el turno` },
    espinas: { n: 'Espinas',      e: '🌵', w: false, v: [0.25, 0.40], d: v => `devuelve ${pc(v)} del daño cuerpo a cuerpo` },
    dureza:  { n: 'Dureza',       e: '🧱', w: false, v: [4, 6],       d: v => `+${v} de defensa` },
    agil:    { n: 'Ágil',         e: '💨', w: false, v: [1, 1],       d: v => `+${v} de movimiento` },
  };
  const WEAPON_FX = Object.keys(AFFIX).filter(k => AFFIX[k].w);
  const ARMOR_FX = Object.keys(AFFIX).filter(k => !AFFIX[k].w);
  const affixText = (f, r) => AFFIX[f] ? AFFIX[f].e + ' ' + AFFIX[f].n + ': ' + AFFIX[f].d(AFFIX[f].v[Math.max(1, r || 1) - 1]) : f;
  function itemName(it) {
    let s = KINDS[it.k].n + ' de ' + tierName(it.k, it.t);
    if (it.fx && it.fx.length) s += ' ' + it.fx.map(f => AFFIX[f] ? AFFIX[f].e : '').join('');
    return (RARITY[it.r || 0] ? RARITY[it.r].e + ' ' : '') + s;
  }
  function upgradeCost(kind, newTier) { // mejorar de calidad cuesta menos que forjar de cero
    const r = recipe(kind, newTier), o = {};
    for (const m in r) o[m] = Math.max(1, Math.ceil(r[m] * 0.6));
    return o;
  }
  const ENCHANT_COST = { alma: 3 };

  // ---- estaciones ----
  const SEASON_LEN = 12;
  const SEASONS = [
    { k: 'primavera', n: 'Primavera', e: '🌸', lead: 'la primavera', d: 'Aparecen más animales para cazar.' },
    { k: 'verano',    n: 'Verano',    e: '☀️', lead: 'el verano',    d: 'Días tranquilos, sin cambios.' },
    { k: 'otono',     n: 'Otoño',     e: '🍂', lead: 'el otoño',     d: 'Cosecha: las criaturas sueltan un 25% más de botín.' },
    { k: 'invierno',  n: 'Invierno',  e: '❄️', lead: 'el invierno',  d: 'Criaturas más agresivas (+15% de daño, ven más lejos) y hordas más frecuentes.' },
  ];
  const seasonIdx = turn => Math.floor(Math.max(0, turn - 1) / SEASON_LEN) % 4;
  const ELITE_NAMES = ['Colmillo Rojo', 'Garra Negra', 'Ojo de Ceniza', 'Sombra Hueca', 'Rompehuesos', 'Furia Gris', 'Aliento Frío', 'Cuerno Roto', 'Mordisco Sangriento', 'Espina Venenosa', 'Lomo de Hierro', 'Paso Silente', 'Voz del Abismo', 'Cráneo Ardiente'];
  const SITES = { cofre: { n: 'Cofre', e: '🎁' }, ruina: { n: 'Ruinas antiguas', e: '🏛️' } };

  // ---- bots y diplomacia ----
  const PERS = {
    granjero:     { n: 'Granjero',     e: '🌾', d: 'Caza, recolecta y construye. Solo pelea contra jugadores si lo atacan.' },
    conquistador: { n: 'Conquistador', e: '⚔️', d: 'Agresivo desde el primer turno: busca ciudades y jugadores débiles.' },
    equilibrado:  { n: 'Equilibrado',  e: '⚖️', d: 'Cuida su economía y ataca cuando se siente fuerte.' },
  };
  const BOT_LEVELS = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };
  // ---- clases (nivel 6) y especializaciones (nivel 12) ----
  const CLASS_LV = 6, SUB_LV = 12;
  const CLASSES = {
    guardian: { n: 'Guardián', e: '🛡️', d: '+15% salud, +4 defensa y aura de +3% a los aliados cercanos.', mods: { hpPct: 0.15, def: 4, aura: 0.03 },
      sub: { muralla: { n: 'Muralla', e: '🧱', d: '+6 defensa y devuelve 25% del daño cuerpo a cuerpo.', mods: { def: 6, espinas: 0.25 } },
             protector: { n: 'Protector', e: '💞', d: 'Cura 10% de su salud por turno y aura +4%.', mods: { regen: 0.10, aura: 0.04 } } } },
    duelista: { n: 'Duelista', e: '⚔️', d: '+15% de daño y +20% contra enemigos por debajo de la mitad de salud.', mods: { dmgPct: 0.15, execute: 0.20 },
      sub: { verdugo: { n: 'Verdugo', e: '🪓', d: '+40% contra enemigos heridos y +5% de daño.', mods: { execute: 0.40, dmgPct: 0.05 } },
             sanguinario: { n: 'Sanguinario', e: '🩸', d: 'Recupera 20% del daño que hace.', mods: { vida: 0.20 } } } },
    cazador: { n: 'Cazador', e: '🏹', d: '+1 alcance con armas a distancia, +1 movimiento y +30% de daño a criaturas.', mods: { range: 1, mov: 1, vsCre: 0.30 },
      sub: { francotirador: { n: 'Francotirador', e: '🎯', d: '+1 alcance más e ignora 20% de defensa.', mods: { range: 1, certero: 0.20 } },
             rastreador: { n: 'Rastreador', e: '🐾', d: '+30% de daño a criaturas y +1 movimiento.', mods: { vsCre: 0.30, mov: 1 } } } },
    sanador: { n: 'Sanador', e: '✚', d: 'Cuenta como +2 puntos de Médico y se cura 5% por turno.', mods: { medico: 2, regen: 0.05 },
      sub: { medico_campo: { n: 'Médico de campaña', e: '⛑️', d: '+3 puntos de Médico.', mods: { medico: 3 } },
             custodio: { n: 'Custodio', e: '💠', d: '+3 defensa, aura +4% y +1 punto de Médico.', mods: { def: 3, aura: 0.04, medico: 1 } } } },
    asesino: { n: 'Asesino', e: '🗡️', d: 'El primer ataque del turno hace +50%, +1 movimiento, ignora 20% de defensa.', mods: { first: 0.50, mov: 1, certero: 0.20 },
      sub: { sombra: { n: 'Sombra', e: '🌑', d: 'Primer ataque +50% más y +1 movimiento.', mods: { first: 0.50, mov: 1 } },
             envenenador: { n: 'Envenenador', e: '☠️', d: 'Sus golpes envenenan (30% de su daño por turno, 3 turnos).', mods: { veneno: 0.30 } } } },
  };
  // clases de magia (nivel 6) — las invocaciones usan 'summons'
  Object.assign(CLASSES, {
    mago: { n: 'Mago', e: '🔮', d: '+30% de daño con báculo y varita y +1 alcance a distancia.', mods: { magic: 0.30, range: 1 },
      sub: { hechicero: { n: 'Hechicero', e: '🌩️', d: '+25% más de daño mágico e ignora 15% de defensa.', mods: { magic: 0.25, certero: 0.15 } },
             arcano: { n: 'Arcano', e: '🌀', d: '+1 alcance, +1 movimiento y se cura 8% por turno.', mods: { range: 1, mov: 1, regen: 0.08 } } } },
    invocador: { n: 'Invocador', e: '🐾', d: '+10% salud y +2 defensa. Invoca lobos u osos cerca de una ciudad (cuestan huesos).', mods: { hpPct: 0.10, def: 2 }, summons: ['lobo', 'oso'],
      sub: { domador: { n: 'Domador', e: '🦴', d: 'Sus invocaciones hacen +30% de daño.', mods: { sumDmg: 0.30 } },
             alfa: { n: 'Alfa', e: '🐺', d: 'Sus invocaciones tienen +35% de salud.', mods: { sumHp: 0.35 } } } },
    nigromante: { n: 'Nigromante', e: '💀', d: '+15% de daño mágico y +5% salud. Invoca esqueletos cerca de una ciudad (cuestan huesos).', mods: { magic: 0.15, hpPct: 0.05 }, summons: ['esqueleto'],
      sub: { senor: { n: 'Señor de huesos', e: '🦴', d: 'Sus esqueletos tienen +35% de salud.', mods: { sumHp: 0.35 } },
             maldito: { n: 'Maldito', e: '☠️', d: 'Sus esqueletos hacen +30% de daño y él +10% de daño mágico.', mods: { sumDmg: 0.30, magic: 0.10 } } } },
  });
  const CART = { e: '🛒', hp: 80, def: 2, mov: 6, cap: 150, cost: { cuero: 8, hueso: 8, hierro: 3 } };
  const HERO = { emb: ['👑', '🦅', '🐉', '🦁', '🔥', '⚜️', '🌟', '🛡️'], xp: 1.5, aura: 0.10, range: 2, wait: 3, loss: 2, pickTurn: 1 };
  const SUMMON = { max: 2, range: 2, cost: { lobo: { hueso: 4 }, oso: { hueso: 7 }, esqueleto: { hueso: 4 } } };
  function classMods(u) {
    const m = {};
    const add = o => { if (o) for (const k in o) m[k] = (m[k] || 0) + o[k]; };
    const c = u.cls && CLASSES[u.cls];
    if (c) { add(c.mods); if (u.sub && c.sub[u.sub]) add(c.sub[u.sub].mods); }
    return m;
  }

  // ---- edificios de ciudad (nivel máx. 2) ----
  const BUILDINGS = {
    herreria: { n: 'Herrería', e: '🔨', d: '+2 trabajos de forja/mejora por turno en esta ciudad (por nivel).',
      cost: [{ hierro: 6, cuero: 6, hueso: 4 }, { hierro: 10, acero: 4, cuero: 6 }] },
    cuartel:  { n: 'Cuartel', e: '🏕️', d: 'Reclutar cuesta 20% menos por nivel. Nivel 2: las unidades nuevas llegan a nivel 2.',
      cost: [{ cuero: 10, hueso: 8, hierro: 3 }, { hierro: 8, acero: 3, cuero: 10 }] },
    muralla:  { n: 'Muralla', e: '🧱', d: '+5 defensa por nivel a quien esté en la ciudad y +3 a las unidades pegadas a ella.',
      cost: [{ hierro: 8, hueso: 6 }, { acero: 6, hierro: 8 }] },
    atalaya:  { n: 'Atalaya', e: '🔭', d: '+2 casillas de visión por nivel alrededor de la ciudad.',
      cost: [{ cuero: 6, hueso: 6, hierro: 2 }, { hierro: 5, acero: 2, hueso: 6 }] },
  };
  const BUILD_ORDER = ['herreria', 'cuartel', 'muralla', 'atalaya'];
  const BUILD_MAX = 2;
  const ORDERS = { goto: { n: 'Ir a…', e: '📍' }, home: { n: 'Volver y depositar', e: '🏠' }, guard: { n: 'Vigilar', e: '🛡️' } };

  // ---- ajustes del mundo que elige el anfitrión ----
  const WORLD_OPTS = {
    mode:       { n: 'Modo de juego', def: 'normal', o: { normal: 'Normal', uno: 'Reto de una unidad: cada jugador (y bot) solo tiene 1 unidad y si cae queda eliminado' } },
    mapSize:    { n: 'Tamaño del mapa', def: 'normal', o: { pequeno: 'Pequeño (partidas más rápidas)', normal: 'Normal', grande: 'Grande', enorme: 'Enorme (partidas muy largas)' } },
    cities:     { n: 'Ciudades neutrales (aldeas)', def: 'normal', o: { pocas: 'Pocas', normal: 'Normal', muchas: 'Muchas', abundantes: 'Abundantes' } },
    biome:      { n: 'Bioma', def: 'azar', o: { azar: 'Mixto (al azar)', bosque: 'Solo bosque', pradera: 'Solo pradera', desierto: 'Solo desierto' } },
    fauna:      { n: 'Criaturas', def: 'normal', o: { pacifica: 'Más pacíficas', normal: 'Normal', agresiva: 'Más agresivas' } },
    hero:       { n: 'Protagonista (una unidad especial por jugador)', def: 'si', o: { si: 'Sí', no: 'No' } },
    breed:      { n: 'Crías (dos unidades juntas cerca de una ciudad)', def: 'cinco', o: { apagado: 'Desactivadas', cinco: 'Tras 5 turnos juntas', tres: 'Tras 3 turnos juntas' } },
    startUnits: { n: 'Unidades iniciales por jugador', def: 4, o: { 4: '4 (normal)', 8: '8', 14: '14 (máximo)' } },
    startLevel: { n: 'Nivel inicial de las unidades', def: 1, o: { 1: 'Nivel 1 (normal)', 3: 'Nivel 3', 6: 'Nivel 6', 10: 'Nivel 10' } },
    startArmor: { n: 'Armadura inicial', def: 'ninguna', o: { ninguna: 'Sin armadura', hierro: 'Armadura de hierro completa', acero: 'Armadura de acero completa' } },
  };

  const PACTS = { guerra: { n: 'Guerra', e: '⚔️' }, paz: { n: 'Paz', e: '🕊️' }, alianza: { n: 'Alianza', e: '🤝' } };

  const TERR = {
    g: { n: 'Pradera', c: 1, def: 0 },
    f: { n: 'Bosque', c: 2, def: 3 },
    h: { n: 'Colinas', c: 2, def: 5 },
    m: { n: 'Montaña', c: 99, def: 0 },
    w: { n: 'Agua', c: 99, def: 0 },
    d: { n: 'Desierto', c: 1, def: 0 },
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
    liche:     { n: 'Liche',     e: '🧙', hp: 230, dmg: 20, def: 10, mov: 3, agg: 6, max: 15, xp: 90,  boss: true, rng: 4, drops: { alma: [3, 5], acero: [2, 4], hierro: [3, 5] } },
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
    recipe, itemValue, itemName, tierName, RARITY, AFFIX, WEAPON_FX, ARMOR_FX, affixText, upgradeCost, ENCHANT_COST,
    CART, HERO, SUMMON, WORLD_OPTS, CLASS_LV, SUB_LV, CLASSES, classMods, BUILDINGS, BUILD_ORDER, BUILD_MAX, ORDERS,
    SEASON_LEN, SEASONS, seasonIdx, ELITE_NAMES, SITES, PERS, BOT_LEVELS, PACTS, TERR, CREATURES, DIRS, cheb, reach,
  };
});
