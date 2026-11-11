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
    escama: { n: 'Escama de dragón', e: '🐉' },
  };
  const MAT_ORDER = ['cuero', 'hueso', 'hierro', 'acero', 'alma', 'escama'];
  // ---- gemas: 6 clases × 3 calidades; se guardan como materiales (rubi1, rubi2, rubi3…) y se engastan en objetos con engarces ----
  // w = efecto en un arma, a = efecto en una armadura (f = efecto de AFFIX, v = valor por calidad)
  const GEMS = {
    rubi:     { n: 'Rubí',     e: '🔴', w: { f: 'afilado', v: [3, 6, 10] },        a: { f: 'vigor',   v: [0.04, 0.08, 0.13] } },
    zafiro:   { n: 'Zafiro',   e: '🔵', w: { f: 'certero', v: [0.1, 0.18, 0.28] }, a: { f: 'dureza',  v: [3, 5, 8] } },
    esmeralda:{ n: 'Esmeralda',e: '🟢', w: { f: 'veneno',  v: [0.15, 0.25, 0.4] }, a: { f: 'regen',   v: [0.04, 0.07, 0.1] } },
    topacio:  { n: 'Topacio',  e: '🟡', w: { f: 'critico', v: [0.08, 0.14, 0.2] }, a: { f: 'bloqueo', v: [0.06, 0.1, 0.15] } },
    amatista: { n: 'Amatista', e: '🟣', w: { f: 'vida',    v: [0.1, 0.18, 0.28] }, a: { f: 'espinas', v: [0.15, 0.3, 0.45] } },
    diamante: { n: 'Diamante', e: '⚪', w: { f: 'bestias', v: [0.1, 0.2, 0.35] },  a: { f: 'erudito', v: [0.1, 0.2, 0.35] } },
  };
  const GEM_IDS = Object.keys(GEMS), GEM_LV = ['astillado', 'normal', 'perfecto'];
  for (const id of GEM_IDS) for (let l = 1; l <= 3; l++) { MATS[id + l] = { n: GEMS[id].n + ' ' + GEM_LV[l - 1], e: GEMS[id].e, gem: id, lv: l }; MAT_ORDER.push(id + l); }
  const gemOf = key => MATS[key] && MATS[key].gem ? MATS[key] : null;
  // efecto de una gema en un objeto: { f, v }
  const gemFx = (key, weapon) => { const m = gemOf(key); if (!m) return null; const d = GEMS[m.gem][weapon ? 'w' : 'a']; return { f: d.f, v: d.v[m.lv - 1] }; };
  const gemText = (key, weapon) => { const m = gemOf(key), fx = gemFx(key, weapon); return fx ? m.e + ' ' + m.n + ': ' + AFFIX[fx.f].e + ' ' + AFFIX[fx.f].d(fx.v) : key; };
  // engarces: los objetos raros salen con algunos; los demás se perforan en la forja (calidad mínima y coste por engarce)
  const SOCKETS_BY_R = [0, 1, 1, 2, 2, 3], MAX_SOCKETS = 3;
  const SOCKET_STEPS = [{ cost: { acero: 2 }, tier: 2 }, { cost: { acero: 3, alma: 2 }, tier: 3 }, { cost: { acero: 4, alma: 4 }, tier: 4 }];
  const GEM_UP = 3; // 3 gemas iguales → 1 de la calidad siguiente

  const TIER_NAMES = [null, 'Cuero', 'Hierro', 'Acero', 'Alma', 'Dracónico'];
  const MAX_TIER = 5;
  const WM = [0, 1, 1.5, 2.1, 3.0, 4.1];   // multiplicador de daño de armas
  const AM = [0, 1, 1.7, 2.6, 3.8, 5.3];   // multiplicador de defensa de armaduras

  const KINDS = {
    daga:      { n: 'Daga',        e: '🗡️', slot: 'arma',       w: true, base: 4,  range: 1, min: 1, pierce: 0.25, mov: 1, d: 'Ignora 25% de defensa, +1 movimiento' },
    espada:    { n: 'Espada',      e: '⚔️', slot: 'arma',       w: true, base: 7,  range: 1, min: 1, d: 'Arma cuerpo a cuerpo equilibrada' },
    hacha:     { n: 'Hacha',       e: '🪓', slot: 'arma',       w: true, base: 8,  range: 1, min: 1, d: 'Más daño que la espada. Una mano (admite escudo)' },
    katana:    { n: 'Katana',      e: '⛩️', slot: 'arma',       w: true, base: 9,  range: 1, min: 1, pierce: 0.2, d: 'Filo afilado: ignora 20% de defensa. Una mano' },
    hachabatalla: { n: 'Hacha de batalla', e: '⚒️', slot: 'arma', w: true, base: 13, range: 1, min: 1, pierce: 0.15, mov: -1, two: true, d: 'Golpe devastador, ignora 15% de defensa, pesada (-1 movimiento). Dos manos' },
    lanza:     { n: 'Lanza',       e: '🪝', slot: 'arma',       w: true, base: 8,  range: 2, min: 1, two: true, reach: true, d: 'Alcance 2 y sin penalización a quemarropa. Dos manos' },
    baston:    { n: 'Báculo',      e: '🪄', slot: 'arma',       w: true, magic: true, base: 9,  range: 3, min: 1, pierce: 0.25, two: true, d: 'Arma mágica: alcance 3, ignora 25% de defensa. Dos manos' },
    varita:    { n: 'Varita',      e: '✨', slot: 'arma',       w: true, magic: true, base: 6,  range: 2, min: 1, pierce: 0.2, d: 'Arma mágica: alcance 2, ignora 20% de defensa. Una mano (admite escudo)' },
    arco:      { n: 'Arco',        e: '🏹', slot: 'arma',       w: true, base: 5,  range: 3, min: 1, two: true, d: 'Alcance 3. Dos manos' },
    arcolargo: { n: 'Arco largo',  e: '🎯', slot: 'arma',       w: true, base: 6,  range: 5, min: 2, two: true, d: 'Alcance 5 (no dispara a casillas adyacentes). Dos manos' },
    ballesta:  { n: 'Ballesta',    e: '🔱', slot: 'arma',       w: true, base: 10, range: 4, min: 1, two: true, pierce: 0.4, single: true, d: 'Alcance 4, ignora 40% de defensa, un solo disparo por turno. Dos manos' },
    estoque:   { n: 'Estoque',    e: '🤺', slot: 'arma',       w: true, base: 5,  range: 1, min: 1, quick: true, d: 'Dos ataques por turno (el segundo hace 60%). Una mano (admite escudo)' },
    maza:      { n: 'Maza',        e: '🔨', slot: 'arma',       w: true, base: 8,  range: 1, min: 1, slow: 0.35, d: '35% de aturdir al objetivo (−2 de movimiento un turno). Una mano (admite escudo)' },
    bumeran:   { n: 'Bumerán',     e: '🪃', slot: 'arma',       w: true, base: 5,  range: 3, min: 1, d: 'Alcance 3. Una mano (admite escudo)' },
    latigo:    { n: 'Látigo',      e: '🪢', slot: 'arma',       w: true, base: 5,  range: 2, min: 1, reach: true, mov: 1, d: 'Alcance 2 sin penalización a quemarropa y +1 movimiento. Una mano' },
    guadana:   { n: 'Guadaña',     e: '🌾', slot: 'arma',       w: true, base: 10, range: 1, min: 1, two: true, exe: 0.30, d: '+30% de daño a enemigos por debajo de la mitad de salud. Dos manos' },
    orbe:      { n: 'Orbe',        e: '🔮', slot: 'arma',       w: true, base: 6,  range: 3, min: 1, pierce: 0.2, magic: true, d: 'Arma mágica: alcance 3, ignora 20% de defensa. Una mano (admite escudo)' },
    escudo:    { n: 'Escudo',      e: '🛡️', slot: 'escudo',     def: 4, d: 'Solo con armas de una mano' },
    casco:     { n: 'Casco',       e: '⛑️', slot: 'casco',      def: 2 },
    guantes:   { n: 'Guantes',     e: '🧤', slot: 'guantes',    def: 1 },
    hombreras: { n: 'Hombreras',   e: '🦺', slot: 'hombreras',  def: 2 },
    pechera:   { n: 'Pechera',     e: '🥋', slot: 'pechera',    def: 4 },
    pantalones:{ n: 'Pantalones',  e: '👖', slot: 'pantalones', def: 3 },
    botas:     { n: 'Botas',       e: '🥾', slot: 'botas',      def: 1 },
  };
  const WEAPON_KINDS = ['daga', 'espada', 'hacha', 'katana', 'hachabatalla', 'lanza', 'baston', 'varita', 'arco', 'arcolargo', 'ballesta', 'estoque', 'maza', 'bumeran', 'latigo', 'guadana', 'orbe'];
  const GEAR_KINDS = ['escudo', 'casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas'];
  const SLOTS = ['arma', 'escudo', 'casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas'];
  const SLOT_NAMES = { arma: 'Arma', escudo: 'Escudo', casco: 'Casco', guantes: 'Guantes', hombreras: 'Hombreras', pechera: 'Pechera', pantalones: 'Pantalones', botas: 'Botas' };

  const COUNT = { daga: 1, espada: 3, hacha: 3, katana: 4, hachabatalla: 5, lanza: 3, baston: 4, varita: 2, arco: 2, arcolargo: 3, ballesta: 4, estoque: 2, maza: 3, bumeran: 2, latigo: 2, guadana: 4, orbe: 3, escudo: 3, casco: 2, guantes: 1, hombreras: 2, pechera: 4, pantalones: 3, botas: 2 };
  function recipe(kind, t) {
    const weapon = !!KINDS[kind].w;
    if (t === 5) return { escama: Math.max(1, Math.ceil(COUNT[kind] / 2)), alma: COUNT[kind] }; // dracónico: escamas de dragón + almas
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
  // la rareza es el nº de efectos: 0 Común (gris), 1 Poco común (verde), 2 Raro (azul), 3 Épico (morado), 4 Legendario (amarillo), 5 Mítico (rojo)
  const RARITY = [{ n: 'Común', e: '⚪' }, { n: 'Poco común', e: '🟢' }, { n: 'Raro', e: '🔵' }, { n: 'Épico', e: '🟣' }, { n: 'Legendario', e: '🟡' }, { n: 'Mítico', e: '🔴' }];
  const MAX_FX = 5;
  const pc = v => Math.round(v * 100) + '%';
  // v = valor según la rareza (nº de efectos del objeto): [1, 2, 3, 4, 5]
  const AFFIX = {
    vida:    { n: 'Robo de vida', e: '🩸', w: true,  v: [0.2, 0.3, 0.4, 0.5, 0.6], d: v => `recupera ${pc(v)} del daño que hace` },
    veneno:  { n: 'Veneno',       e: '☠️', w: true,  v: [0.2, 0.3, 0.4, 0.5, 0.6], d: v => `envenena 3 turnos (${pc(v)} de su daño por turno)` },
    afilado: { n: 'Afilado',      e: '🗡️', w: true,  v: [4, 6, 9, 13, 18],          d: v => `+${v} de daño` },
    certero: { n: 'Certero',      e: '🎯', w: true,  v: [0.2, 0.3, 0.4, 0.5, 0.6], d: v => `ignora ${pc(v)} más de defensa` },
    fuego:   { n: 'Fuego',        e: '🔥', w: true,  v: [0.35, 0.5, 0.7, 0.9, 1.2], d: v => `quema 2 turnos (${pc(v)} de su daño por turno)` },
    hielo:   { n: 'Hielo',        e: '❄️', w: true,  v: [0.5, 0.7, 1, 1, 1], d: v => `${pc(v)} de probabilidad de ralentizar al enemigo (−2 movimiento un turno)` },
    critico: { n: 'Crítico',      e: '💥', w: true,  v: [0.15, 0.22, 0.3, 0.38, 0.45], d: v => `${pc(v)} de probabilidad de golpe crítico (×1,8 de daño)` },
    ejecutor:{ n: 'Ejecutor',     e: '💀', w: true,  v: [0.2, 0.3, 0.45, 0.6, 0.8], d: v => `+${pc(v)} de daño contra enemigos bajo la mitad de salud` },
    bestias: { n: 'Cazabestias',  e: '🐺', w: true,  v: [0.15, 0.25, 0.4, 0.55, 0.75], d: v => `+${pc(v)} de daño contra criaturas` },
    regen:   { n: 'Regeneración', e: '🌿', w: false, v: [0.08, 0.12, 0.16, 0.2, 0.25], d: v => `cura ${pc(v)} de la salud al empezar el turno` },
    espinas: { n: 'Espinas',      e: '🌵', w: false, v: [0.25, 0.4, 0.55, 0.7, 0.9], d: v => `devuelve ${pc(v)} del daño cuerpo a cuerpo` },
    dureza:  { n: 'Dureza',       e: '🧱', w: false, v: [4, 6, 9, 13, 18],          d: v => `+${v} de defensa` },
    agil:    { n: 'Ágil',         e: '💨', w: false, v: [1, 1, 2, 2, 3],          d: v => `+${v} de movimiento` },
    vigor:   { n: 'Vigor',        e: '💪', w: false, v: [0.08, 0.12, 0.18, 0.25, 0.35], d: v => `+${pc(v)} de salud máxima` },
    erudito: { n: 'Erudito',      e: '📚', w: false, v: [0.15, 0.25, 0.4, 0.55, 0.75], d: v => `+${pc(v)} de experiencia ganada` },
    bloqueo: { n: 'Bloqueo',      e: '🛡️', w: false, v: [0.12, 0.18, 0.25, 0.32, 0.4], d: v => `${pc(v)} de probabilidad de reducir a la mitad un golpe recibido` },
  };
  const WEAPON_FX = Object.keys(AFFIX).filter(k => AFFIX[k].w);
  const ARMOR_FX = Object.keys(AFFIX).filter(k => !AFFIX[k].w);
  const affixText = (f, r) => AFFIX[f] ? AFFIX[f].e + ' ' + AFFIX[f].n + ': ' + AFFIX[f].d(AFFIX[f].v[Math.min(5, Math.max(1, r || 1)) - 1]) : f;
  function itemName(it) {
    let s = KINDS[it.k].n + ' de ' + tierName(it.k, it.t);
    if (it.fx && it.fx.length) s += ' ' + it.fx.map(f => AFFIX[f] ? AFFIX[f].e : '').join('');
    if (it.so) { let g = ''; for (let i = 0; i < it.so; i++) g += (it.gm && it.gm[i]) ? (gemOf(it.gm[i]) || { e: '◆' }).e : '◇'; s += ' ' + g; }
    return (it.r >= 1 && RARITY[it.r] ? RARITY[it.r].e + ' ' : '') + s;
  }
  function upgradeCost(kind, newTier) { // mejorar de calidad cuesta menos que forjar de cero
    const r = recipe(kind, newTier), o = {};
    for (const m in r) o[m] = Math.max(1, Math.ceil(r[m] * 0.6));
    return o;
  }
  // coste de añadir el efecto nº (n+1) a un objeto que ya tiene n efectos, y calidad mínima que exige
  const ENCHANT_STEPS = [{ cost: { alma: 3 }, tier: 1 }, { cost: { alma: 3 }, tier: 1 }, { cost: { alma: 4 }, tier: 3 }, { cost: { alma: 6, escama: 2 }, tier: 4 }, { cost: { alma: 9, escama: 4 }, tier: 5 }];
  const ENCHANT_COST = ENCHANT_STEPS[0].cost;
  const REFORGE_COST = { alma: 2 };      // cambiar un efecto por otro al azar
  // ---- sets de armadura: piezas de la misma calidad (de las 7 ranuras de defensa) ----
  const SET_BONUS = {
    2: { n: 'Set de Hierro',     3: { hpPct: 0.05 }, 6: { def: 3 } },
    3: { n: 'Set de Acero',      3: { hpPct: 0.08 }, 6: { def: 5, regen: 0.04 } },
    4: { n: 'Set de Alma',       3: { hpPct: 0.10 }, 6: { def: 6, regen: 0.06 } },
    5: { n: 'Set Dracónico',     3: { hpPct: 0.12 }, 6: { def: 8, regen: 0.05, espinas: 0.15 } },
  };
  function armorSet(eq) {
    const cnt = {};
    for (const slot of SLOTS) { if (slot === 'arma') continue; const it = eq && eq[slot]; if (it && it.t >= 2) cnt[it.t] = (cnt[it.t] || 0) + 1; }
    let t = 0; for (const k in cnt) if (cnt[k] >= 3 && +k > t) t = +k;
    if (!t) return null;
    const n = cnt[t], def = SET_BONUS[t], b = {}, txt = [];
    for (const th of [3, 6]) if (n >= th) { for (const k in def[th]) b[k] = (b[k] || 0) + def[th][k]; txt.push(`${th} piezas: ` + Object.keys(def[th]).map(k => ({ hpPct: `+${Math.round(def[th][k] * 100)}% salud`, def: `+${def[th][k]} defensa`, regen: `cura ${Math.round(def[th][k] * 100)}%/turno`, espinas: `espinas ${Math.round(def[th][k] * 100)}%` })[k]).join(', ')); }
    return { t, n, name: def.n, b, txt };
  }


  // ---- estaciones ----
  const SEASON_LEN = 12;
  const SEASONS = [
    { k: 'primavera', n: 'Primavera', e: '🌸', lead: 'la primavera', d: 'Aparecen más animales para cazar.' },
    { k: 'verano',    n: 'Verano',    e: '☀️', lead: 'el verano',    d: 'Días tranquilos, sin cambios.' },
    { k: 'otono',     n: 'Otoño',     e: '🍂', lead: 'el otoño',     d: 'Cosecha: las criaturas sueltan un 25% más de botín.' },
    { k: 'invierno',  n: 'Invierno',  e: '❄️', lead: 'el invierno',  d: 'Criaturas más agresivas (+15% de daño, ven más lejos) y hordas más frecuentes.' },
  ];
  const seasonIdx = turn => Math.floor(Math.max(0, turn - 1) / SEASON_LEN) % 4;
  // ---- clima (v1.26): cambia cada 2-4 turnos según la estación y afecta al combate ----
  // rng: daño de armas a distancia (×(1−rng)); mag: bonus de baston/varita; mov: movimiento; fire: si el fuego quema; crit: si hay críticos; rngR: alcance máximo a distancia
  const WEATHER = {
    sol:      { n: 'Despejado', e: '☀️', d: 'Sin efectos.', w: [4, 5, 3, 1], rng: 0, mag: 0, mov: 0, fire: true, crit: true, rngR: 0 },
    lluvia:   { n: 'Lluvia',    e: '🌧️', d: 'Las armas a distancia hacen −25% de daño y el fuego no quema.', w: [4, 1, 4, 2], rng: 0.25, mag: 0, mov: 0, fire: false, crit: true, rngR: 0 },
    tormenta: { n: 'Tormenta',  e: '⛈️', d: '−1 de movimiento, distancia −35% de daño, pero la magia (bastones y varitas) hace +25%.', w: [1, 3, 1, 0], rng: 0.35, mag: 0.25, mov: 1, fire: false, crit: true, rngR: 0 },
    niebla:   { n: 'Niebla',    e: '🌫️', d: 'Sin golpes críticos y las armas a distancia alcanzan 1 casilla menos.', w: [1, 0, 3, 2], rng: 0, mag: 0, mov: 0, fire: true, crit: false, rngR: 1 },
    nieve:    { n: 'Ventisca',  e: '🌨️', d: '−1 de movimiento y el hielo ralentiza siempre.', w: [0, 0, 0, 5], rng: 0, mag: 0, mov: 1, fire: true, crit: true, rngR: 0, ice: true },
  };
  const WEATHER_ORDER = Object.keys(WEATHER);
  // ---- torneos y mercaderes (v1.26) ----
  const TOURN = { first: 10, every: 18, len: 4, radius: 1, minTurn: 6 };
  const MERCH = { every: 8, offset: 4, stay: 7, max: 3 };
  const ELITE_NAMES = ['Colmillo Rojo', 'Garra Negra', 'Ojo de Ceniza', 'Sombra Hueca', 'Rompehuesos', 'Furia Gris', 'Aliento Frío', 'Cuerno Roto', 'Mordisco Sangriento', 'Espina Venenosa', 'Lomo de Hierro', 'Paso Silente', 'Voz del Abismo', 'Cráneo Ardiente'];
  const SITES = { cofre: { n: 'Cofre', e: '🎁' }, ruina: { n: 'Ruinas antiguas', e: '🏛️' }, tesoro: { n: 'Tesoro de mazmorra', e: '💎' }, trampa: { n: 'Trampa', e: '⚠️' } };
  // ---- mazmorras (v1.29): zonas aparte del mapa, aisladas por muros; se entra y se sale por una puerta ----
  // tier 1-5: nivel de las criaturas, nivel recomendado, vida perdida en trampas (% de la vida máxima) y riqueza del tesoro
  const DUNGEON = {
    w: 22, h: 15, buf: 8, reset: 20, // tamaño de cada mazmorra, separación con el mapa y turnos hasta reabastecerse tras despejarla
    tiers: [
      { n: 'Cueva', e: '🟢', lv: [2, 4], rec: 3, trap: 0.10, rich: 1, pool: [['lobo', 3], ['serpiente', 3], ['murcielago', 3], ['arana', 2], ['goblin', 2]], boss: [['troll', 1]], bossLv: 6 },
      { n: 'Catacumba', e: '🔵', lv: [4, 7], rec: 6, trap: 0.14, rich: 2, pool: [['esqueleto', 3], ['zombi', 3], ['bandido', 2], ['goblin', 2], ['arana', 2], ['murcielago', 1]], boss: [['troll', 1], ['orco', 1]], bossLv: 9 },
      { n: 'Mazmorra profunda', e: '🟣', lv: [7, 10], rec: 9, trap: 0.18, rich: 3, pool: [['orco', 3], ['fantasma', 2], ['escorpion', 2], ['zombi', 2], ['bandido', 2], ['esqueleto', 2]], boss: [['minotauro', 1], ['conde', 1]], bossLv: 5 },
      { n: 'Abismo', e: '🟠', lv: [10, 13], rec: 12, trap: 0.22, rich: 4, pool: [['troll', 3], ['golem', 3], ['fantasma', 2], ['orco', 2], ['bandido', 2]], boss: [['hidra', 1], ['liche', 1], ['reylobo', 1]], bossLv: 8 },
      { n: 'Infierno', e: '🔴', lv: [13, 15], rec: 15, trap: 0.28, rich: 5, pool: [['golem', 3], ['troll', 3], ['fantasma', 2], ['orco', 2]], boss: [['dragon', 1], ['coloso', 1]], bossLv: 11 },
    ],
  };

  // ---- bots y diplomacia ----
  // b = parámetros de comportamiento: rec (reclutas extra), order (construcción), al ('recent' | 'always' | turno desde el que ataca),
  // need (exigencia para atacar jugadores), cNeed (para criaturas), cVal/bVal (valor de criaturas/jefes), nCity (ciudades libres),
  // cityVal/uVal (ciudades/unidades enemigas), paz/ali (probabilidad de aceptar)
  const PERS = {
    granjero:     { n: 'Granjero',     e: '🌾', d: 'Caza, recolecta y construye. Solo pelea contra jugadores si lo atacan.',
      b: { rec: 2, order: ['cuartel', 'herreria', 'muralla', 'atalaya'], al: 'recent', need: 1, cNeed: 0.85, cVal: 1.3, bVal: 1, nCity: 40, cityVal: 46, uVal: 1, paz: 1, ali: 0.5 } },
    conquistador: { n: 'Conquistador', e: '⚔️', d: 'Agresivo desde el primer turno: busca ciudades y jugadores débiles.',
      b: { rec: 1, order: ['herreria', 'cuartel', 'muralla', 'atalaya'], al: 'always', need: 0.85, cNeed: 1, cVal: 0.8, bVal: 1, nCity: 34, cityVal: 60, uVal: 1.3, paz: 0.2, ali: 0.1 } },
    equilibrado:  { n: 'Equilibrado',  e: '⚖️', d: 'Cuida su economía y ataca cuando se siente fuerte.',
      b: { rec: 0, order: ['muralla', 'cuartel', 'herreria', 'atalaya'], al: 40, need: 1, cNeed: 1, cVal: 1, bVal: 1, nCity: 34, cityVal: 46, uVal: 1, paz: 0.6, ali: 0.3 } },
    cazador:      { n: 'Cazador',      e: '🏹', d: 'Vive de cazar criaturas y subir de nivel. Rara vez ataca a otros jugadores.',
      b: { rec: 1, order: ['cuartel', 'herreria', 'atalaya', 'muralla'], al: 'recent', need: 1.1, cNeed: 0.7, cVal: 1.6, bVal: 1.1, nCity: 34, cityVal: 46, uVal: 1, paz: 0.8, ali: 0.4 } },
    diplomatico:  { n: 'Diplomático',  e: '🕊️', d: 'Busca paz y alianzas con todos. Solo pelea si lo atacan.',
      b: { rec: 1, order: ['muralla', 'atalaya', 'cuartel', 'herreria'], al: 'recent', need: 1.2, cNeed: 1, cVal: 1, bVal: 1, nCity: 38, cityVal: 46, uVal: 1, paz: 1, ali: 0.9 } },
    defensor:     { n: 'Defensor',     e: '🛡️', d: 'Se atrinchera: murallas primero y mucho ejército en casa. Contraataca a quien lo ataque.',
      b: { rec: 2, order: ['muralla', 'atalaya', 'cuartel', 'herreria'], al: 'recent', need: 1.3, cNeed: 1.15, cVal: 0.9, bVal: 0.8, nCity: 34, cityVal: 46, uVal: 1, paz: 0.9, ali: 0.5 } },
    saqueador:    { n: 'Saqueador',    e: '🗡️', d: 'Oportunista: tras un tiempo ataca solo a los más débiles y a unidades sueltas.',
      b: { rec: 1, order: ['herreria', 'cuartel', 'atalaya', 'muralla'], al: 15, need: 0.7, cNeed: 1, cVal: 0.9, bVal: 0.9, nCity: 34, cityVal: 50, uVal: 1.5, paz: 0.3, ali: 0.15 } },
    mercader:     { n: 'Forjador',     e: '🔨', d: 'Obsesionado con el equipo: herrería y encantamientos. Pelea cuando ya está bien armado.',
      b: { rec: 1, order: ['herreria', 'herreria', 'cuartel', 'muralla'], al: 60, need: 0.9, cNeed: 0.95, cVal: 1.1, bVal: 1, nCity: 36, cityVal: 46, uVal: 1, paz: 0.7, ali: 0.4 } },
    cazajefes:    { n: 'Cazajefes',    e: '🐉', d: 'Su meta son los jefes del mapa (Rey Lobo, Liche, Dragón). Ignora a los demás salvo que lo ataquen.',
      b: { rec: 2, order: ['cuartel', 'herreria', 'muralla', 'atalaya'], al: 'recent', need: 1.1, cNeed: 0.8, cVal: 1.1, bVal: 2.2, nCity: 34, cityVal: 46, uVal: 1, paz: 0.7, ali: 0.35 } },
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
  // clases de combate adicionales (v1.28)
  Object.assign(CLASSES, {
    berserker: { n: 'Berserker', e: '😡', d: '+25% de daño y +10% de salud, pero −2 de defensa.', mods: { dmgPct: 0.25, hpPct: 0.10, def: -2 },
      sub: { frenesi: { n: 'Frenesí', e: '💢', d: 'Recupera 15% del daño que hace y +10% de daño.', mods: { vida: 0.15, dmgPct: 0.10 } },
             titan: { n: 'Titán', e: '🗿', d: '+20% de salud, +10% de daño y +2 defensa.', mods: { hpPct: 0.20, dmgPct: 0.10, def: 2 } } } },
    paladin: { n: 'Paladín', e: '⚜️', d: '+10% de salud, +3 defensa, se cura 5% por turno y aura de +3%.', mods: { hpPct: 0.10, def: 3, regen: 0.05, aura: 0.03 },
      sub: { cruzado: { n: 'Cruzado', e: '✝️', d: '+15% de daño, +2 defensa y aura +2%.', mods: { dmgPct: 0.15, def: 2, aura: 0.02 } },
             inquebrantable: { n: 'Inquebrantable', e: '🏛️', d: '+5 defensa y devuelve 20% del daño cuerpo a cuerpo.', mods: { def: 5, espinas: 0.20 } } } },
    monje: { n: 'Monje', e: '🥋', d: '+1 movimiento, +15% de daño y se cura 5% por turno.', mods: { mov: 1, dmgPct: 0.15, regen: 0.05 },
      sub: { puno: { n: 'Puño de hierro', e: '👊', d: '+15% de daño e ignora 15% de defensa.', mods: { dmgPct: 0.15, certero: 0.15 } },
             zen: { n: 'Maestro zen', e: '☯️', d: 'Se cura 12% por turno, +3 defensa y +1 movimiento.', mods: { regen: 0.12, def: 3, mov: 1 } } } },
    bardo: { n: 'Bardo', e: '🎵', d: 'Aura de +6% a los aliados cercanos, +1 movimiento y cuenta como +1 de Médico.', mods: { aura: 0.06, mov: 1, medico: 1 },
      sub: { trovador: { n: 'Trovador', e: '🎶', d: 'Aura +6% más.', mods: { aura: 0.06 } },
             juglar: { n: 'Juglar', e: '🃏', d: 'Aura +3%, +1 movimiento y +10% de daño.', mods: { aura: 0.03, mov: 1, dmgPct: 0.10 } } } },
    alquimista: { n: 'Alquimista', e: '⚗️', d: 'Sus golpes envenenan (15% de su daño por turno), cuenta como +1 de Médico y +5% de salud.', mods: { veneno: 0.15, medico: 1, hpPct: 0.05 },
      sub: { toxicologo: { n: 'Toxicólogo', e: '🧪', d: 'Veneno +35% de su daño por turno.', mods: { veneno: 0.35 } },
             boticario: { n: 'Boticario', e: '🌿', d: '+3 puntos de Médico y se cura 6% por turno.', mods: { medico: 3, regen: 0.06 } } } },
    elementalista: { n: 'Elementalista', e: '🌋', d: '+20% de daño con armas mágicas y sus golpes queman (25% de su daño por turno).', mods: { magic: 0.20, fuego: 0.25 },
      sub: { piromante: { n: 'Piromante', e: '🔥', d: 'Quemadura +35% y +10% de daño mágico.', mods: { fuego: 0.35, magic: 0.10 } },
             criomante: { n: 'Criomante', e: '❄️', d: '35% de ralentizar al objetivo y +10% de daño mágico.', mods: { hielo: 0.35, magic: 0.10 } } } },
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
  // ---- ciudad de 3×3 (v1.27): estar en ella (centro) o pegado a ella (anillo) da bonos ----
  // pvp: defensa contra jugadores; hordeDef / hordeAtk: defensa y ataque contra hordas que asaltan la ciudad [centro, anillo]
  const CITY_GUARD = { pvp: [8, 4], hordeDef: [10, 6], hordeAtk: [0.3, 0.2] };
  const BUILD_ORDER = ['herreria', 'cuartel', 'muralla', 'atalaya'];
  const BUILD_MAX = 2;
  const ORDERS = { goto: { n: 'Ir a…', e: '📍' }, home: { n: 'Volver y depositar', e: '🏠' }, guard: { n: 'Vigilar', e: '🛡️' } };

  // ---- ajustes del mundo que elige el anfitrión ----
  const WORLD_OPTS = {
    mode:       { n: 'Modo de juego', def: 'normal', o: { normal: 'Normal', uno: 'Reto de una unidad: cada jugador (y bot) solo tiene 1 unidad y si cae queda eliminado', equipos: 'Por equipos: los jugadores se reparten al azar en equipos aliados (elige 2 o 5 equipos en el ajuste de abajo) y gana el último equipo en pie',
      mundo: 'Mundo abierto: mundo enorme y persistente para jugadores (sin bots). Se entra cuando quieras, no se recluta (solo crías), las ciudades sin tus unidades vuelven a ser neutrales y los monstruos salen de cualquier nivel',
      historia: 'Historia: campaña cooperativa de 6 capítulos (todos los jugadores aliados) que termina contra el Dragón de Ceniza',
      rey: 'Reto del Rey Demonio: un jugador al azar es el Rey Demonio (solo recluta bestias) y los demás están aliados contra él' } },
    victory:    { n: 'Tipo de final (modos Normal y Reto de una unidad)', def: 'ultimo', o: {
      ultimo: 'Último en pie (o alianza total)',
      tiempo: 'Por tiempo: a los 40 turnos gana quien tenga más puntos (si no pones otro límite)',
      dominio: 'Dominación: controla la mitad de las ciudades del mapa durante 4 turnos seguidos',
      jefes: 'Cazajefes: el primero en derrotar a 2 jefes (aparecen más a menudo)',
      campeon: 'Campeón: el primero que lleve una unidad a nivel 12',
      puntos: 'Carrera de puntos: el primero en llegar a 600 puntos' } },
    events:     { n: 'Eventos del mundo', def: 'todo', o: { todo: 'Clima, torneos y mercaderes ambulantes', clima: 'Solo clima', calma: 'Nada: mundo tranquilo' } },
    teams:      { n: 'Equipos (solo en el modo «Por equipos»)', def: 'dos', o: { dos: '2 equipos', cinco: '5 equipos' } },
    worldSize:  { n: 'Tamaño del mundo (solo Mundo abierto)', def: 'enorme', o: { grande: 'Grande (120 × 120)', enorme: 'Enorme (160 × 160)', gigante: 'Gigante (220 × 220)' } },
    decay:      { n: 'Ciudades sin tus unidades vuelven a ser neutrales (solo Mundo abierto)', def: '24', o: { '12': 'Tras 12 turnos', '24': 'Tras 24 turnos', '48': 'Tras 48 turnos', '96': 'Tras 96 turnos' } },
    mapSize:    { n: 'Tamaño del mapa', def: 'normal', o: { pequeno: 'Pequeño (partidas más rápidas)', normal: 'Normal', grande: 'Grande', enorme: 'Enorme (partidas muy largas)' } },
    cities:     { n: 'Ciudades neutrales (aldeas)', def: 'normal', o: { pocas: 'Pocas', normal: 'Normal', muchas: 'Muchas', abundantes: 'Abundantes' } },
    biome:      { n: 'Bioma', def: 'azar', o: { azar: 'Mixto (al azar)', bosque: 'Solo bosque', pradera: 'Solo pradera', desierto: 'Solo desierto' } },
    fauna:      { n: 'Criaturas', def: 'normal', o: { pacifica: 'Más pacíficas', normal: 'Normal', agresiva: 'Más agresivas' } },
    bossRegen:  { n: 'Recuperación de los jefes', def: 'lenta', o: { lenta: 'Lenta (3% por turno)', normal: 'Normal (10% por turno, como las demás criaturas)', ninguna: 'Ninguna' } },
    botChat:    { n: 'Los bots hablan en el chat', def: 'si', o: { si: 'Sí', no: 'No' } },
    hero:       { n: 'Protagonista (una unidad especial por jugador)', def: 'si', o: { si: 'Sí', no: 'No' } },
    breed:      { n: 'Crías (dos unidades juntas cerca de una ciudad)', def: 'cinco', o: { apagado: 'Desactivadas', cinco: 'Tras 5 turnos juntas', tres: 'Tras 3 turnos juntas' } },
    startUnits: { n: 'Unidades iniciales por jugador', def: 4, o: { 4: '4 (normal)', 8: '8', 14: '14 (máximo)' } },
    startLevel: { n: 'Nivel inicial de las unidades', def: 1, o: { 1: 'Nivel 1 (normal)', 3: 'Nivel 3', 6: 'Nivel 6', 10: 'Nivel 10' } },
    startArmor: { n: 'Armadura inicial', def: 'ninguna', o: { ninguna: 'Sin armadura', hierro: 'Armadura de hierro completa', acero: 'Armadura de acero completa' } },
  };

  // ---- modos rápidos del lobby: cada uno fija el modo, el reloj y los ajustes del mundo (lo que no nombra vuelve a su valor normal) ----
  const VICTORY = { dominio: { pct: 0.5, hold: 4 }, jefes: { n: 2 }, campeon: { lv: 12 }, puntos: { pts: 600 }, tiempo: { turns: 40 } };
  const PRESETS = [
    { id: 'clasica',  e: '🏛️', n: 'Clásica',  d: 'La partida de siempre: turnos de 4 horas y sin límite de turnos.', cfg: { turnHours: 4, maxTurns: 0 } },
    { id: 'rapida',   e: '⚡', n: 'Rápida',   d: 'Para jugar en una tarde: mapa pequeño, 8 unidades de nivel 3, crías a los 3 turnos, turnos de 15 minutos y 30 turnos como máximo.', cfg: { turnHours: 0.25, maxTurns: 30, mapSize: 'pequeno', startUnits: '8', startLevel: '3', breed: 'tres' } },
    { id: 'epica',    e: '🐉', n: 'Épica',    d: 'Una campaña larga: mapa grande con muchas aldeas, criaturas agresivas, 8 unidades de nivel 3 con armadura de hierro y turnos de 8 horas.', cfg: { turnHours: 8, maxTurns: 0, mapSize: 'grande', cities: 'muchas', fauna: 'agresiva', startUnits: '8', startLevel: '3', startArmor: 'hierro' } },
    { id: 'reto',     e: '🎯', n: 'Reto',     d: 'Reto de una unidad: cada jugador (y bot) tiene una sola unidad y, si cae, queda eliminado. Mapa pequeño y turnos de 1 hora.', cfg: { turnHours: 1, maxTurns: 0, mode: 'uno', mapSize: 'pequeno' } },
    { id: 'equipos',  e: '🤝', n: 'Equipos',  d: 'Dos equipos al azar, aliados por dentro y enemigos entre sí. Gana el último equipo en pie. Turnos de 1 hora.', cfg: { turnHours: 1, maxTurns: 0, mode: 'equipos', teams: 'dos' } },
    { id: 'rey',      e: '👑', n: 'Rey Demonio', d: 'Un jugador al azar es el Rey Demonio (solo recluta bestias, con un jefe de protagonista) contra todos los demás, aliados. Turnos de 1 hora.', cfg: { turnHours: 1, maxTurns: 0, mode: 'rey' } },
    { id: 'historia', e: '📖', n: 'Historia', d: 'Campaña cooperativa de 6 capítulos contra el Dragón de Ceniza, con todos los jugadores aliados. Turnos de 1 hora.', cfg: { turnHours: 1, maxTurns: 0, mode: 'historia' } },
    { id: 'mundo',    e: '🌍', n: 'Mundo abierto', d: 'Mundo enorme y siempre abierto para jugadores (sin bots): se entra cuando se quiera, no se recluta y las ciudades abandonadas vuelven a ser neutrales. Turnos de 1 hora.', cfg: { turnHours: 1, maxTurns: 0, mode: 'mundo', worldSize: 'enorme', decay: '24' } },
  ];

  // Reto del Rey Demonio: bestias que puede reclutar (coste base; la mejora de cuartel lo reduce)
  const BOSS_IDS = () => Object.keys(CREATURES).filter(k => CREATURES[k].boss);
  const KING = {
    beasts: {
      lobo:      { cost: { hueso: 2, cuero: 2 } },
      oso:       { cost: { hueso: 3, cuero: 3 } },
      goblin:    { cost: { hierro: 2, cuero: 2 } },
      esqueleto: { cost: { hueso: 5, hierro: 1 } },
      orco:      { cost: { hierro: 4, cuero: 3, hueso: 2 } },
      troll:     { cost: { hierro: 6, acero: 2, hueso: 3 } },
      arana:     { cost: { hueso: 3, cuero: 3 } },
      zombi:     { cost: { hueso: 4, cuero: 2 } },
      golem:     { cost: { hierro: 8, acero: 3, hueso: 2 } },
    },
    start: ['lobo', 'lobo', 'oso', 'oso', 'goblin', 'esqueleto'], n: 6, lv: 3,
    heroes: ['reylobo', 'liche', 'dragon', 'minotauro', 'hidra', 'coloso', 'conde'], boss: { hp: 0.5, dmg: 0.6 }, // protagonista del Rey: un jefe al azar (con la mitad de vida y 60% del daño de un jefe salvaje)
  };
  const TEAM_E = ['🔶', '🔷', '🟩', '🟪', '🟫']; // marcas de equipo
  // ---- Modo Historia: campaña cooperativa en una sola partida; cada capítulo tiene objetivos y al cumplirlos se pasa al siguiente ----
  const STORY = {
    title: 'La Ceniza del Dragón',
    intro: 'Durante generaciones estas tierras vivieron en paz a la sombra de un volcán dormido. Esta noche el volcán despertó. Del cráter cae ceniza, las criaturas enloquecen y los jefes antiguos —el Rey Lobo, el Liche y, sobre todos, el Dragón de Ceniza— vuelven a rondar. Ustedes son los últimos aventureros en pie. Aliados, o cenizas.',
    chapters: [
      { t: 'El eco de la ceniza', txt: 'Las bestias huyen del volcán y atacan sin miedo. Antes de pensar en dragones hay que aprender a sobrevivir: entre todos, derroten a 12 criaturas.',
        done: 'Las bestias retroceden. Un anciano de la aldea murmura: «Doce... no está mal para empezar. Pero lo que viene no tiene colmillos de lobo.»',
        goals: [{ k: 'kills', n: 12, txt: 'Derrotar criaturas (entre todos)' }], reward: { m: { cuero: 8, hueso: 8, hierro: 6 }, w: [60, 30, 9, 1, 0] } },
      { t: 'Tierras propias', txt: 'Un campamento no basta para resistir. Reclamen las ciudades abandonadas del mapa: necesitamos un refugio por cabeza y algunos más.',
        done: 'Las murallas se alzan en cada rincón. Por primera vez en semanas, el humo que se ve en el horizonte es de chimeneas y no de ceniza.',
        goals: [{ k: 'cities', extra: 3, txt: 'Ciudades del grupo (jugadores + 3)' }], reward: { m: { hierro: 12, acero: 4, cuero: 8 }, w: [50, 35, 12, 3, 0] } },
      { t: 'Acero y leyenda', txt: 'Con palos y cuero no se derriba a un jefe. Que la forja no se apague: alguien debe llegar a nivel 8 y vestir equipo de acero o mejor.',
        done: 'El yunque canta y las armaduras brillan. Los bardos ya inventan canciones sobre ustedes; todavía no saben que son demasiado optimistas.',
        goals: [{ k: 'level', n: 8, txt: 'Una unidad de nivel 8' }, { k: 'tier', n: 3, txt: 'Equipar algo de calidad Acero o mejor' }], reward: { m: { acero: 8, alma: 4 }, w: [30, 35, 25, 9, 1] } },
      { t: 'El rey de los lobos', txt: 'El aullido se oye desde las montañas: el Rey Lobo ha bajado a cazar. Está en el mapa. Derrótenlo antes de que su manada arrase las ciudades.',
        done: 'El Rey Lobo cae y su aullido se apaga. Entre sus huesos aparece un colmillo con un símbolo: la marca del Liche.', boss: 'reylobo', lv: [-1, 5, 12],
        goals: [{ k: 'boss', t: 'reylobo', txt: 'Derrotar al Rey Lobo' }], reward: { m: { alma: 6, acero: 8 }, w: [20, 30, 30, 15, 5] } },
      { t: 'La noche del Liche', txt: 'Una niebla fría cubre el mapa. El Liche invoca a los muertos desde la distancia: sus hechizos alcanzan lejos. Acorten la distancia, rodéenlo y acaben con él.',
        done: 'El Liche se deshace en polvo con un último susurro: «El Dragón... ya despierta». El suelo tiembla bajo sus pies.', boss: 'liche', lv: [0, 6, 13],
        goals: [{ k: 'boss', t: 'liche', txt: 'Derrotar al Liche' }], reward: { m: { alma: 8, acero: 8, escama: 2 }, w: [10, 25, 35, 22, 8] } },
      { t: 'El Dragón de Ceniza', txt: 'El volcán estalla y el cielo se vuelve rojo. El Dragón de Ceniza ha despertado. Es la última batalla: reúnan a todos, curen a los heridos y no den un paso atrás.',
        done: '', boss: 'dragon', lv: [1, 8, 15], goals: [{ k: 'boss', t: 'dragon', txt: 'Derrotar al Dragón de Ceniza' }], reward: null },
    ],
    outro: 'El Dragón de Ceniza cae con un rugido que sacude el mundo, y el volcán se apaga para siempre. Las aldeas encienden hogueras, los bardos —esta vez con razón— cantan su victoria, y todo el reino sabe sus nombres. FIN.',
    lost: 'Nadie quedó en pie para encender las hogueras. La ceniza cubre el reino... pero las leyendas dicen que otro grupo, algún día, volverá a intentarlo.',
  };
  const PACTS = { guerra: { n: 'Guerra', e: '⚔️' }, paz: { n: 'Paz', e: '🕊️' }, alianza: { n: 'Alianza', e: '🤝' } };

  const TERR = {
    g: { n: 'Pradera', c: 1, def: 0 },
    f: { n: 'Bosque', c: 2, def: 3 },
    h: { n: 'Colinas', c: 2, def: 5 },
    m: { n: 'Montaña', c: 99, def: 0 },
    w: { n: 'Agua', c: 99, def: 0 },
    d: { n: 'Desierto', c: 1, def: 0 },
    r: { n: 'Suelo de mazmorra', c: 1, def: 0 },
    k: { n: 'Muro de mazmorra', c: 99, def: 0 },
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
    // --- v1.29: criaturas nuevas (pacíficas: agg 0, solo se defienden si las atacas) ---
    conejo:    { n: 'Conejo',    e: '🐇', hp: 12,  dmg: 2,  def: 0,  mov: 4, agg: 0, max: 3,  xp: 3,  drops: { cuero: [1, 1], hueso: [0, 1] } },
    cabra:     { n: 'Cabra montés', e: '🐐', hp: 30, dmg: 7, def: 1,  mov: 3, agg: 0, max: 5,  xp: 6,  drops: { cuero: [1, 2], hueso: [1, 1] } },
    toro:      { n: 'Toro',      e: '🐂', hp: 70,  dmg: 14, def: 2,  mov: 3, agg: 0, max: 7,  xp: 13, drops: { cuero: [3, 5], hueso: [2, 3] } },
    tortuga:   { n: 'Tortuga gigante', e: '🐢', hp: 55, dmg: 4, def: 12, mov: 1, agg: 0, max: 8, xp: 11, drops: { hueso: [3, 5], cuero: [1, 2] } },
    // --- agresivas ---
    murcielago:{ n: 'Murciélago', e: '🦇', hp: 18, dmg: 6,  def: 0,  mov: 5, agg: 3, max: 6,  xp: 6,  drops: { cuero: [1, 1], hueso: [0, 1] } },
    serpiente: { n: 'Serpiente', e: '🐍', hp: 24,  dmg: 9,  def: 0,  mov: 3, agg: 2, max: 7,  xp: 8,  drops: { cuero: [1, 2], hueso: [1, 1] } },
    arana:     { n: 'Araña gigante', e: '🕷️', hp: 40, dmg: 9, def: 2, mov: 3, agg: 3, max: 8,  xp: 11, drops: { cuero: [1, 2], hueso: [1, 2] }, soul: 0.03 },
    escorpion: { n: 'Escorpión', e: '🦂', hp: 46,  dmg: 12, def: 6,  mov: 3, agg: 3, max: 9,  xp: 14, drops: { hueso: [2, 3], cuero: [1, 2], hierro: [0, 1] }, soul: 0.03 },
    bandido:   { n: 'Bandido',   e: '🥷', hp: 50,  dmg: 11, def: 5,  mov: 3, agg: 4, max: 9,  xp: 15, drops: { hierro: [1, 2], cuero: [1, 2], acero: [0, 1] }, soul: 0.03 },
    zombi:     { n: 'Zombi',     e: '🧟', hp: 65,  dmg: 9,  def: 3,  mov: 2, agg: 3, max: 9,  xp: 13, drops: { hueso: [2, 4], cuero: [1, 1] }, soul: 0.05 },
    fantasma:  { n: 'Fantasma',  e: '👻', hp: 35,  dmg: 10, def: 6,  mov: 3, agg: 4, max: 10, xp: 16, rng: 2, drops: { hueso: [1, 3], hierro: [0, 1] }, soul: 0.12 },
    golem:     { n: 'Gólem de piedra', e: '🗿', hp: 150, dmg: 15, def: 16, mov: 2, agg: 3, max: 11, xp: 28, drops: { hierro: [2, 4], acero: [1, 3] }, soul: 0.08 },
    reylobo:   { n: 'Rey Lobo',  e: '🐺', hp: 220, dmg: 20, def: 12, mov: 4, agg: 5, max: 15, xp: 70,  boss: true, drops: { acero: [3, 5], cuero: [4, 6], alma: [2, 3] } },
    liche:     { n: 'Liche',     e: '🧙', hp: 230, dmg: 20, def: 10, mov: 3, agg: 6, max: 15, xp: 90,  boss: true, rng: 4, drops: { alma: [3, 5], acero: [2, 4], hierro: [3, 5] } },
    dragon:    { n: 'Dragón de Ceniza', e: '🐉', hp: 480, dmg: 34, def: 20, mov: 3, agg: 6, max: 15, xp: 160, boss: true, rng: 2, drops: { alma: [5, 8], acero: [4, 6], escama: [2, 3] } },
    // --- jefes nuevos (v1.29) ---
    minotauro: { n: 'Minotauro del Laberinto', e: '🐃', hp: 300, dmg: 26, def: 14, mov: 3, agg: 5, max: 15, xp: 110, boss: true, drops: { acero: [3, 5], hierro: [3, 5], cuero: [3, 5], alma: [2, 3] } },
    hidra:     { n: 'Hidra de las Ciénagas', e: '🐲', hp: 380, dmg: 24, def: 14, mov: 3, agg: 6, max: 15, xp: 130, boss: true, rng: 2, drops: { alma: [3, 5], acero: [3, 5], escama: [1, 2] } },
    coloso:    { n: 'Coloso de Piedra', e: '⛰️', hp: 560, dmg: 30, def: 26, mov: 2, agg: 5, max: 15, xp: 150, boss: true, drops: { acero: [5, 8], hierro: [4, 6], alma: [3, 4] } },
    conde:     { n: 'Conde Vampiro', e: '🧛', hp: 260, dmg: 24, def: 11, mov: 4, agg: 6, max: 15, xp: 100, boss: true, drops: { alma: [4, 6], acero: [2, 4], hueso: [4, 6] } },
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
    recipe, itemValue, MAX_TIER, ENCHANT_STEPS, MAX_FX, REFORGE_COST, SET_BONUS, armorSet, itemName, tierName, RARITY, AFFIX, WEAPON_FX, ARMOR_FX, affixText, upgradeCost, ENCHANT_COST,
    CART, HERO, KING, BOSS_IDS, DUNGEON, TEAM_E, STORY, SUMMON, WORLD_OPTS, PRESETS, VICTORY, GEMS, GEM_IDS, GEM_LV, gemOf, gemFx, gemText, SOCKETS_BY_R, MAX_SOCKETS, SOCKET_STEPS, GEM_UP, CLASS_LV, SUB_LV, CLASSES, classMods, BUILDINGS, CITY_GUARD, BUILD_ORDER, BUILD_MAX, ORDERS,
    SEASON_LEN, SEASONS, seasonIdx, WEATHER, WEATHER_ORDER, TOURN, MERCH, ELITE_NAMES, SITES, PERS, BOT_LEVELS, PACTS, TERR, CREATURES, DIRS, cheb, reach,
  };
});
