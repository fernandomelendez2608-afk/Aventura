/* Aventura de almas — datos y utilidades compartidas (servidor + celular) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SH = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SKILLS = {
    dano:     { n: 'Daño',         cap: 15, d: '+2 de daño por punto' },
    salud:    { n: 'Salud',        cap: 15, d: '+6 de salud máxima por punto' },
    movilidad:{ n: 'Movilidad',    cap: 2,  d: '+1 casilla de movimiento por punto (máx. 2)' },
    medico:   { n: 'Médico',       cap: 15, d: 'Al iniciar el turno cura a los aliados adyacentes un 4% de su salud por punto' },
    doble:    { n: 'Doble ataque', cap: 1,  d: 'Ataca dos veces por turno (el segundo golpe hace 60%). Solo se aprende una vez' },
    defensa:  { n: 'Defensa',      cap: 15, d: '+2 de defensa por punto' },
    general:  { n: 'General',      cap: 15, d: 'Aliados a 1 casilla ganan +2% de salud y defensa por punto (+1% a 2 casillas)' },
    alcance:  { n: 'Alcance',      cap: 2,  d: '+1 casilla de alcance de ataque por punto (solo armas a distancia: arcos, magia…)' },
    provocar: { n: 'Provocar',     cap: 2,  d: 'Las criaturas enemigas cercanas lo atacan a él en vez de a sus aliados (1 casilla; con 2 puntos, hasta 2 casillas)' },
    embestida:{ n: 'Embestida',    cap: 3,  d: 'Si se mueve 3 o más casillas antes de atacar: +12% de daño por punto; con 3 puntos además aturde al objetivo' },
    esquiva:  { n: 'Esquiva',      cap: 5,  d: '+5% de probabilidad de evitar por completo un ataque, por punto' },
    contra:   { n: 'Contraataque', cap: 2,  d: 'Si recibe un golpe cuerpo a cuerpo y sobrevive, responde con un golpe extra (50% / 70% de su daño) una vez por turno' },
    regen:    { n: 'Regeneración', cap: 7,  d: 'Al inicio de su turno recupera un 3% de su salud máxima por punto, sin médico ni ciudad' },
  };
  const SKILL_ORDER = ['dano', 'salud', 'defensa', 'movilidad', 'medico', 'doble', 'general', 'alcance', 'provocar', 'embestida', 'esquiva', 'contra', 'regen'];

  const MATS = {
    cuero: { n: 'Cuero', e: '🟫' },
    hueso: { n: 'Hueso', e: '🦴' },
    hierro: { n: 'Hierro', e: '⛓️' },
    acero: { n: 'Acero', e: '🔩' },
    alma: { n: 'Alma', e: '👻' },
    escama: { n: 'Escama de dragón', e: '🐉' },
  };
  // valor de referencia de cada material (para ayudar a fijar precios en el comercio)
  const MAT_VAL = { cuero: 1, hueso: 1, hierro: 1.5, acero: 3, alma: 4, escama: 8 };
  // producción pasiva de las ciudades por turno: terreno a 3 casillas + edificios (se acumula y se entrega al llegar a 1)
  const INCOME = { r: 3, f: { cuero: 0.10 }, g: { cuero: 0.03 }, h: { hierro: 0.09 }, m: { hierro: 0.09 }, d: { hueso: 0.08 }, base: { cuero: 0.4, hueso: 0.4 }, cap: { cuero: 0.3, hueso: 0.3, hierro: 0.3 },
    herreria: { hierro: 0.5 }, cuartel: { hueso: 0.4 }, atalaya: { cuero: 0.3 }, iglesia: { hueso: 0.3 }, rey: 2, mult: { normal: 1, bajo: 0.5, apagado: 0 } };
  const itemVal = it => it ? 12 + 8 * it.t + 6 * (it.fx ? it.fx.length : 0) : 0; // valor de referencia de un objeto en el comercio
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
  for (const id of GEM_IDS) for (let l = 1; l <= 3; l++) { MATS[id + l] = { n: GEMS[id].n + ' ' + GEM_LV[l - 1], e: GEMS[id].e, gem: id, lv: l }; MAT_ORDER.push(id + l); MAT_VAL[id + l] = [0, 5, 14, 40][l]; }
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

  function ptSeed(n) { let h = ((n | 0) ^ 0x9e3779b9) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; } // semilla de retrato
  const sexSeed = n => ((n >>> 5) & 1) ? 'F' : 'M'; // género a partir de una semilla
  const sexOf = u => u.sx || sexSeed(u.pt || ptSeed(u.id * 7 + 3)); // las unidades antiguas (sin género guardado) lo deducen de su retrato
  const DESIGN = { skin: 6, hair: 8, eye: 5, tun: 8, cape: 8, pant: 5, style: 8, build: 3, pose: 4, acc: ['parche', 'gafas', 'pendiente', 'bufanda', 'pintura', 'orejas', 'flor', 'cuernos'], maxAcc: 4, cost: { alma: 5 } };
  function cleanDesign(d) { // valida el diseño del protagonista que manda el cliente
    if (!d || typeof d !== 'object') return null;
    const n = (v, max) => Math.max(0, Math.min(max - 1, v | 0));
    const acc = Array.isArray(d.acc) ? [...new Set(d.acc.filter(a => DESIGN.acc.includes(a)))].slice(0, DESIGN.maxAcc) : [];
    return { sx: d.sx === 'F' ? 'F' : 'M', skin: n(d.skin, DESIGN.skin), hair: n(d.hair, DESIGN.hair), eye: n(d.eye, DESIGN.eye), tun: n(d.tun, DESIGN.tun), cape: n(d.cape, DESIGN.cape), pant: n(d.pant, DESIGN.pant), style: n(d.style, DESIGN.style), build: n(d.build, DESIGN.build), pose: n(d.pose, DESIGN.pose), beard: d.beard ? 1 : 0, scar: d.scar ? 1 : 0, brow: d.brow ? 1 : 0, acc };
  }
  const KINDS = {
    daga:      { n: 'Daga',        e: '🗡️', slot: 'arma',       w: true, base: 8,  range: 1, min: 1, pierce: 0.25, mov: 1, d: 'Ignora 25% de defensa, +1 movimiento' },
    espada:    { n: 'Espada',      e: '⚔️', slot: 'arma',       w: true, base: 9,  range: 1, min: 1, d: 'Arma cuerpo a cuerpo equilibrada' },
    hacha:     { n: 'Hacha',       e: '🪓', slot: 'arma',       w: true, base: 9,  range: 1, min: 1, d: 'Más daño que la espada. Una mano (admite escudo)' },
    katana:    { n: 'Katana',      e: '⛩️', slot: 'arma',       w: true, base: 8,  range: 1, min: 1, pierce: 0.2, d: 'Filo afilado: ignora 20% de defensa. Una mano' },
    hachabatalla: { n: 'Hacha de batalla', e: '⚒️', slot: 'arma', w: true, base: 10, range: 1, min: 1, pierce: 0.15, mov: -1, two: true, d: 'Golpe devastador, ignora 15% de defensa, pesada (-1 movimiento). Dos manos' },
    lanza:     { n: 'Lanza',       e: '🪝', slot: 'arma',       w: true, base: 9,  range: 2, min: 1, two: true, reach: true, d: 'Alcance 2 y sin penalización a quemarropa. Dos manos' },
    baston:    { n: 'Báculo',      e: '🪄', slot: 'arma',       w: true, magic: true, base: 8,  range: 3, min: 1, pierce: 0.2, two: true, d: 'Arma mágica: alcance 3, ignora 25% de defensa. Dos manos' },
    varita:    { n: 'Varita',      e: '✨', slot: 'arma',       w: true, magic: true, base: 7,  range: 2, min: 1, pierce: 0.2, d: 'Arma mágica: alcance 2, ignora 20% de defensa. Una mano (admite escudo)' },
    arco:      { n: 'Arco',        e: '🏹', slot: 'arma',       w: true, base: 9,  range: 3, min: 1, two: true, d: 'Alcance 3. Dos manos' },
    arcolargo: { n: 'Arco largo',  e: '🎯', slot: 'arma',       w: true, base: 9,  range: 5, min: 2, two: true, d: 'Alcance 5 (no dispara a casillas adyacentes). Dos manos' },
    ballesta:  { n: 'Ballesta',    e: '🔱', slot: 'arma',       w: true, base: 7, range: 4, min: 1, two: true, pierce: 0.15, single: true, d: 'Alcance 4, ignora 40% de defensa, un solo disparo por turno. Dos manos' },
    estoque:   { n: 'Estoque',    e: '🤺', slot: 'arma',       w: true, base: 8,  range: 1, min: 1, quick: true, d: 'Dos ataques por turno (el segundo hace 60%). Una mano (admite escudo)' },
    maza:      { n: 'Maza',        e: '🔨', slot: 'arma',       w: true, base: 9,  range: 1, min: 1, slow: 0.35, d: '35% de aturdir al objetivo (−2 de movimiento un turno). Una mano (admite escudo)' },
    bumeran:   { n: 'Bumerán',     e: '🪃', slot: 'arma',       w: true, base: 8,  range: 3, min: 1, d: 'Alcance 3. Una mano (admite escudo)' },
    latigo:    { n: 'Látigo',      e: '🪢', slot: 'arma',       w: true, base: 8,  range: 2, min: 1, reach: true, mov: 1, d: 'Alcance 2 sin penalización a quemarropa y +1 movimiento. Una mano' },
    guadana:   { n: 'Guadaña',     e: '🌾', slot: 'arma',       w: true, base: 10, range: 1, min: 1, two: true, exe: 0.30, d: '+30% de daño a enemigos por debajo de la mitad de salud. Dos manos' },
    orbe:      { n: 'Orbe',        e: '🔮', slot: 'arma',       w: true, base: 8,  range: 3, min: 1, pierce: 0.15, magic: true, d: 'Arma mágica: alcance 3, ignora 20% de defensa. Una mano (admite escudo)' },
    calavera:  { n: 'Calavera',    e: '💀', slot: 'arma',       w: true, magic: true, base: 8,  range: 3, min: 1, pierce: 0.2, necro: true, d: 'Arma mágica: alcance 3, ignora 20% de defensa. Una mano (admite escudo). Nigromante: +30% de daño, +1 alcance y esqueletos con +20% de salud' },
    baculosan: { n: 'Báculo del sanador', e: '✚', slot: 'arma', w: true, magic: true, base: 4, range: 3, min: 1, two: true, heal: 10, d: 'Hace poco daño a enemigos, pero en vez de herir a tus aliados los CURA a distancia (alcance 3, gasta un ataque). Dos manos. Sanador y puntos de Médico curan más' },
    silbato:   { n: 'Silbato',     e: '📯', slot: 'arma',       w: true, base: 3,  range: 4, min: 1, multi: 4, whistle: true, d: 'Alcance 4, poco daño, pero ataca 4 veces por turno. Una mano. Invocador: +35% de daño y sus invocaciones hacen +20% de daño' },
    escudo:    { n: 'Escudo',      e: '🛡️', slot: 'escudo',     def: 4, d: 'Solo con armas de una mano' },
    casco:     { n: 'Casco',       e: '⛑️', slot: 'casco',      def: 2 },
    guantes:   { n: 'Guantes',     e: '🧤', slot: 'guantes',    def: 1 },
    hombreras: { n: 'Hombreras',   e: '🦺', slot: 'hombreras',  def: 2 },
    pechera:   { n: 'Pechera',     e: '🥋', slot: 'pechera',    def: 4 },
    pantalones:{ n: 'Pantalones',  e: '👖', slot: 'pantalones', def: 3 },
    botas:     { n: 'Botas',       e: '🥾', slot: 'botas',      def: 1 },
    mochila:   { n: 'Mochila',     e: '🎒', slot: 'mochila',    def: 0, pack: true, d: 'Amplía el inventario de quien la lleva' },
    antorcha:  { n: 'Antorcha',    e: '🔦', slot: 'antorcha',   def: 0, torch: true, d: 'De noche ilumina: ves más lejos y las criaturas no reciben su bono nocturno contra ti ni contra los aliados cercanos' },
  };
  const WEAPON_KINDS = ['daga', 'espada', 'hacha', 'katana', 'hachabatalla', 'lanza', 'baston', 'varita', 'arco', 'arcolargo', 'ballesta', 'estoque', 'maza', 'bumeran', 'latigo', 'guadana', 'orbe', 'calavera', 'baculosan', 'silbato'];
  const GEAR_KINDS = ['escudo', 'casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas', 'mochila', 'antorcha'];
  const SLOTS = ['arma', 'escudo', 'casco', 'guantes', 'hombreras', 'pechera', 'pantalones', 'botas', 'mochila', 'antorcha'];
  const PACK = [0, 6, 10, 15, 21, 30]; // espacios extra según el material de la mochila
  const SLOT_NAMES = { arma: 'Arma', escudo: 'Escudo', casco: 'Casco', guantes: 'Guantes', hombreras: 'Hombreras', pechera: 'Pechera', pantalones: 'Pantalones', botas: 'Botas', mochila: 'Mochila', antorcha: 'Antorcha' };

  const COUNT = { daga: 1, espada: 3, hacha: 3, katana: 4, hachabatalla: 5, lanza: 3, baston: 4, varita: 2, arco: 2, arcolargo: 3, ballesta: 4, estoque: 2, maza: 3, bumeran: 2, latigo: 2, guadana: 4, orbe: 3, calavera: 3, baculosan: 4, silbato: 2, escudo: 3, casco: 2, guantes: 1, hombreras: 2, pechera: 4, pantalones: 3, botas: 2, mochila: 3 };
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
  // v1.81: destruir equipo devuelve los materiales de construcción, encantamientos, engarces y reforjas; las gemas engastadas se pierden
  function scrapRefund(it) {
    const r = {}, add = c => { for (const k in c) r[k] = (r[k] || 0) + c[k]; };
    add(recipe(it.k, it.t || 1));
    for (let i = 0; i < (it.fx || []).length; i++) add(ENCHANT_STEPS[i].cost);
    for (let i = 0; i < (it.so || 0); i++) add(SOCKET_STEPS[i].cost);
    for (let i = 0; i < (it.rf || 0); i++) add(REFORGE_COST);
    return r;
  }
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
    for (const slot of SLOTS) { if (slot === 'arma' || slot === 'mochila' || slot === 'antorcha') continue; const it = eq && eq[slot]; if (it && it.t >= 2) cnt[it.t] = (cnt[it.t] || 0) + 1; }
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
  // ---- día y noche (v1.72): 100 turnos de ciclo, los últimos 20 son de noche; las criaturas agresivas se vuelven más peligrosas ----
  const DN = { len: 100, night: 20, dmg: 1.25, def: 2, mov: 1 };
  const isNight = turn => (Math.max(0, turn - 1) % DN.len) >= DN.len - DN.night;
  const nightLeft = turn => isNight(turn) ? DN.len - ((Math.max(0, turn - 1)) % DN.len) : 0; // turnos de noche que quedan (contando este)
  const dayLeft = turn => isNight(turn) ? 0 : DN.len - DN.night - (Math.max(0, turn - 1) % DN.len);
  const torchR = it => it ? 1 + (it.t >= 3 ? 1 : 0) + (it.t >= 5 ? 1 : 0) : 0; // radio de luz (casillas) según el material
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
  const SITES = { cofre: { n: 'Cofre', e: '🎁' }, ruina: { n: 'Ruinas antiguas', e: '🏛️' }, tesoro: { n: 'Tesoro de mazmorra', e: '💎' }, trampa: { n: 'Trampa', e: '⚠️' }, tumba: { n: 'Tumba', e: '🪦' } };
  // ---- mazmorras (v1.29): zonas aparte del mapa, aisladas por muros; se entra y se sale por una puerta ----
  // tier 1-5: nivel de las criaturas, nivel recomendado, vida perdida en trampas (% de la vida máxima) y riqueza del tesoro
  // modo Laberinto: tamaño de cada piso (impar), salas intermedias, un jefe cada `boss` pisos, y lo que lleva cada vela al empezar
  const LAB = { w: 31, h: 21, gap: 1, rooms: 5, boss: 2, startUnits: 2, mats: { cuero: 10, hueso: 8 }, lastBoss: 'dragon' };
  const DUNGEON = {
    w: 22, h: 15, buf: 8, reset: 20, // tamaño de cada mazmorra, separación con el mapa y turnos hasta reabastecerse tras despejarla
    tiers: [
      { n: 'Cueva', e: '🟢', lv: [2, 4], rec: 3, trap: 0.10, rich: 1, pool: [['lobo', 3], ['serpiente', 3], ['murcielago', 3], ['arana', 2], ['goblin', 2]], boss: [['troll', 1]], bossLv: 5 },
      { n: 'Catacumba', e: '🔵', lv: [4, 7], rec: 6, trap: 0.14, rich: 2, pool: [['esqueleto', 3], ['zombi', 3], ['bandido', 2], ['goblin', 2], ['arana', 2], ['murcielago', 1]], boss: [['troll', 1], ['orco', 1]], bossLv: 8 },
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
  // intereses extra de los bots: mazmorras (dg), torneos (tn) y mercaderes (mc), de 0 a 1
  const BOT_X = { granjero: { dg: .1, tn: .3, mc: .9 }, conquistador: { dg: .2, tn: .6, mc: .2 }, equilibrado: { dg: .4, tn: .5, mc: .5 }, cazador: { dg: .9, tn: .4, mc: .3 },
    diplomatico: { dg: .2, tn: .3, mc: .8 }, defensor: { dg: .15, tn: .2, mc: .4 }, saqueador: { dg: .5, tn: .5, mc: .3 }, mercader: { dg: .35, tn: .5, mc: 1 }, cazajefes: { dg: .8, tn: .3, mc: .3 } };
  for (const k in BOT_X) Object.assign(PERS[k].b, BOT_X[k]);
  const BOT_LEVELS = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };
  // ---- clases (nivel 6) y especializaciones (nivel 12) ----
  const CLASS_LV = 6, SUB_LV = 12;
  const CLASSES = {
    guardian: { n: 'Guardián', e: '🛡️', d: '+10% salud, +3 defensa y aura de +3% a los aliados cercanos.', mods: { hpPct: 0.10, def: 3, aura: 0.03 },
      sub: { muralla: { n: 'Muralla', e: '🧱', d: '+2 defensa y devuelve 30% del daño cuerpo a cuerpo.', mods: { def: 2, espinas: 0.30 } },
             protector: { n: 'Protector', e: '💞', d: 'Cura 3% de su salud por turno y aura +4%.', mods: { regen: 0.03, aura: 0.04 } } } },
    duelista: { n: 'Duelista', e: '⚔️', d: '+10% de daño y +20% contra enemigos por debajo de la mitad de salud.', mods: { dmgPct: 0.10, execute: 0.20 },
      sub: { verdugo: { n: 'Verdugo', e: '🪓', d: '+30% contra enemigos heridos y +5% de daño.', mods: { execute: 0.30, dmgPct: 0.05 } },
             sanguinario: { n: 'Sanguinario', e: '🩸', d: 'Recupera 12% del daño que hace y +5% de daño.', mods: { vida: 0.12, dmgPct: 0.05 } } } },
    cazador: { n: 'Cazador', e: '🏹', d: '+1 alcance con armas a distancia, +1 movimiento, +20% de daño y +30% de daño a criaturas.', mods: { range: 1, mov: 1, vsCre: 0.30, dmgPct: 0.20 },
      sub: { francotirador: { n: 'Francotirador', e: '🎯', d: '+1 alcance más, +12% de daño e ignora 25% de defensa.', mods: { range: 1, certero: 0.25, dmgPct: 0.12 } },
             rastreador: { n: 'Rastreador', e: '🐾', d: '+30% de daño a criaturas, +1 movimiento y +28% de daño.', mods: { vsCre: 0.30, mov: 1, dmgPct: 0.28 } } } },
    sanador: { n: 'Sanador', e: '✚', d: 'Cuenta como +2 puntos de Médico y se cura 5% por turno.', mods: { medico: 2, regen: 0.05, heal: 0.30 },
      sub: { medico_campo: { n: 'Médico de campaña', e: '⛑️', d: '+3 puntos de Médico.', mods: { medico: 3, heal: 0.20 } },
             custodio: { n: 'Custodio', e: '💠', d: '+3 defensa, aura +4% y +1 punto de Médico.', mods: { def: 3, aura: 0.04, medico: 1, heal: 0.10 } } } },
    asesino: { n: 'Asesino', e: '🗡️', d: 'El primer ataque del turno hace +35%, +1 movimiento, ignora 15% de defensa.', mods: { first: 0.35, mov: 1, certero: 0.15 },
      sub: { sombra: { n: 'Sombra', e: '🌑', d: 'Primer ataque +15% más y +1 movimiento.', mods: { first: 0.15, mov: 1 } },
             envenenador: { n: 'Envenenador', e: '☠️', d: 'Sus golpes envenenan (55% de su daño por turno, 3 turnos).', mods: { veneno: 0.55 } } } },
  };
  // clases de magia (nivel 6) — las invocaciones usan 'summons'
  Object.assign(CLASSES, {
    mago: { n: 'Mago', e: '🔮', d: '+22% de daño con báculo y varita y +1 alcance a distancia.', mods: { magic: 0.22, range: 1 },
      sub: { hechicero: { n: 'Hechicero', e: '🌩️', d: '+12% más de daño mágico e ignora 15% de defensa.', mods: { magic: 0.12, certero: 0.15 } },
             arcano: { n: 'Arcano', e: '🌀', d: '+1 alcance, +1 movimiento, +15% de daño mágico y se cura 3% por turno.', mods: { range: 1, mov: 1, regen: 0.03, magic: 0.15 } } } },
    invocador: { n: 'Invocador', e: '🐾', d: '+10% salud y +2 defensa. Invoca lobos u osos cerca de una ciudad (cuestan huesos).', mods: { hpPct: 0.10, def: 2, silb: 0.35 }, summons: ['lobo', 'oso'],
      sub: { domador: { n: 'Domador', e: '🦴', d: 'Sus invocaciones hacen +30% de daño.', mods: { sumDmg: 0.30 } },
             alfa: { n: 'Alfa', e: '🐺', d: 'Sus invocaciones tienen +35% de salud.', mods: { sumHp: 0.35 } } } },
    nigromante: { n: 'Nigromante', e: '💀', d: '+25% de daño mágico y +10% salud. Invoca esqueletos cerca de una ciudad (cuestan huesos).', mods: { magic: 0.25, hpPct: 0.10, calav: 0.30 }, summons: ['esqueleto'],
      sub: { senor: { n: 'Señor de huesos', e: '🦴', d: 'Sus esqueletos tienen +35% de salud y él +15% de daño mágico.', mods: { sumHp: 0.35, magic: 0.15 } },
             maldito: { n: 'Maldito', e: '☠️', d: 'Sus esqueletos hacen +30% de daño y él +20% de daño mágico.', mods: { sumDmg: 0.30, magic: 0.20 } } } },
  });
  // clases de combate adicionales (v1.28)
  Object.assign(CLASSES, {
    berserker: { n: 'Berserker', e: '😡', d: '+15% de daño y +8% de salud, pero −2 de defensa.', mods: { dmgPct: 0.15, hpPct: 0.08, def: -2 },
      sub: { frenesi: { n: 'Frenesí', e: '💢', d: 'Recupera 10% del daño que hace y +6% de daño.', mods: { vida: 0.10, dmgPct: 0.06 } },
             titan: { n: 'Titán', e: '🗿', d: '+3% de salud, +5% de daño y +1 defensa.', mods: { hpPct: 0.03, dmgPct: 0.05, def: 1 } } } },
    paladin: { n: 'Paladín', e: '⚜️', d: '+8% de salud, +1 defensa, se cura 3% por turno y aura de +3%.', mods: { hpPct: 0.08, def: 1, regen: 0.03, aura: 0.03 },
      sub: { cruzado: { n: 'Cruzado', e: '✝️', d: '+5% de daño, +2 defensa y aura +2%.', mods: { dmgPct: 0.05, def: 2, aura: 0.02 } },
             inquebrantable: { n: 'Inquebrantable', e: '🏛️', d: '+2 defensa y devuelve 10% del daño cuerpo a cuerpo.', mods: { def: 2, espinas: 0.10 } } } },
    monje: { n: 'Monje', e: '🥋', d: '+1 movimiento, +8% de daño y se cura 3% por turno.', mods: { mov: 1, dmgPct: 0.08, regen: 0.03 },
      sub: { puno: { n: 'Puño de hierro', e: '👊', d: '+5% de daño e ignora 10% de defensa.', mods: { dmgPct: 0.05, certero: 0.10 } },
             zen: { n: 'Maestro zen', e: '☯️', d: 'Se cura 2% por turno, +1 defensa y +1 movimiento.', mods: { regen: 0.02, def: 1, mov: 1 } } } },
    bardo: { n: 'Bardo', e: '🎵', d: 'Aura de +6% a los aliados cercanos, +1 movimiento y cuenta como +1 de Médico.', mods: { aura: 0.06, mov: 1, medico: 1 },
      sub: { trovador: { n: 'Trovador', e: '🎶', d: 'Aura +6% más, +10% de salud y +2 defensa.', mods: { aura: 0.06, hpPct: 0.10, def: 2 } },
             juglar: { n: 'Juglar', e: '🃏', d: 'Aura +3%, +1 movimiento y +18% de daño.', mods: { aura: 0.03, mov: 1, dmgPct: 0.18 } } } },
    alquimista: { n: 'Alquimista', e: '⚗️', d: 'Sus golpes envenenan (15% de su daño por turno), cuenta como +1 de Médico y +5% de salud.', mods: { veneno: 0.15, medico: 1, hpPct: 0.05 },
      sub: { toxicologo: { n: 'Toxicólogo', e: '🧪', d: 'Veneno +35% de su daño por turno y +8% de daño.', mods: { veneno: 0.35, dmgPct: 0.08 } },
             boticario: { n: 'Boticario', e: '🌿', d: '+3 puntos de Médico, +3% de daño y se cura 4% por turno.', mods: { medico: 3, regen: 0.04, dmgPct: 0.03 } } } },
    elementalista: { n: 'Elementalista', e: '🌋', d: '+28% de daño con armas mágicas y sus golpes queman (35% de su daño por turno).', mods: { magic: 0.28, fuego: 0.35 },
      sub: { piromante: { n: 'Piromante', e: '🔥', d: 'Quemadura +55% y +15% de daño mágico.', mods: { fuego: 0.55, magic: 0.15 } },
             criomante: { n: 'Criomante', e: '❄️', d: '45% de ralentizar al objetivo y +15% de daño mágico.', mods: { hielo: 0.45, magic: 0.15 } } } },
  });
  // constructor: unidad auxiliar (no cuenta como unidad) que traza carreteras y estaciones de suministros
  const BUILDER = { e: '👷', hp: 50, def: 2, mov: 4, cost: { cuero: 6, hierro: 4, hueso: 2 }, road: { cuero: 1, hierro: 1 }, station: { hierro: 8, acero: 3, cuero: 6 }, roadCost: 0.5, near: 2 };
  const CART = { e: '🛒', hp: 80, def: 2, mov: 6, cap: 150, aura: 2, heal: 0.12, cost: { cuero: 8, hueso: 8, hierro: 3 } };
  const HERO = { emb: ['👑', '🦅', '🐉', '🦁', '🔥', '⚜️', '🌟', '🛡️'], xp: 1.5, aura: 0.10, range: 2, wait: 3, loss: 2, pickTurn: 1 };
  const SUMMON = { max: 2, range: 2, cost: { lobo: { hueso: 4 }, oso: { hueso: 7 }, esqueleto: { hueso: 4 } } };
  // vampirismo: el Conde Vampiro puede contagiar a las unidades que muerde; siguen siendo tuyas y ganan ventaja racial
  const VAMP = { by: ['conde'], chance: 0.25, mods: { vida: 0.20, dmgPct: 0.10, regen: 0.03 }, shield: 2, purify: { alma: 3 }, e: '🧛' };
  function classMods(u) {
    const m = {};
    const add = o => { if (o) for (const k in o) m[k] = (m[k] || 0) + o[k]; };
    if (u.vamp) add(VAMP.mods);
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
    taller:   { n: 'Taller del constructor', e: '🏗️', max: 2, d: 'Nv1: contrata un 👷 constructor (máx. 1 por ciudad) que traza carreteras (las unidades cruzan cada casilla de carretera por solo 0,5 de movimiento). Nv2: el constructor levanta 📦 estaciones de suministros: las ciudades con una estación cerca comparten el inventario.',
      cost: [{ hierro: 5, cuero: 6, hueso: 2 }, { hierro: 8, acero: 3, cuero: 8, hueso: 4 }] },
    asedio:   { n: 'Taller de asedio', e: '🛠️', max: 2, d: 'Nv1: construye 🐏 arietes (rompen murallas pegados a la ciudad). Nv2: también ☄️ catapultas (rompen murallas desde 3 casillas). Máx. 2 máquinas por ciudad. Solo con asedios activados.',
      cost: [{ hierro: 8, cuero: 8, hueso: 4 }, { hierro: 12, acero: 4, cuero: 8, hueso: 6 }] },
    iglesia:  { n: 'Iglesia', e: '⛪', max: 5, d: 'Por nivel: +2 defensa en la ciudad (+1 a 2 casillas), −8% al coste en huesos y almas (reclutar, resucitar, invocar). Nivel 5: un 👼 Ángel guardián protege la ciudad.',
      cost: [{ hierro: 6, hueso: 6, alma: 1 }, { hierro: 8, hueso: 8, alma: 2 }, { acero: 4, hierro: 8, hueso: 10, alma: 3 }, { acero: 6, hierro: 10, hueso: 12, alma: 4 }, { acero: 10, escama: 2, hueso: 16, alma: 6 }] },
  };
  const bMax = k => (BUILDINGS[k] && BUILDINGS[k].max) || BUILD_MAX;
  // iglesia: aura de defensa, descuento de huesos/almas y ángel guardián (solo daña criaturas)
  const CHURCH = { def: 2, disc: 0.08, angelLv: 5, range: 7 };
  const ANGEL = { n: 'Ángel guardián', names: ['Elizabeth', 'Nathaly'], e: '👼', hp: 400, dmg: 38, def: 16, mov: 4, rng: 2, attacks: 2, pierce: 0.3 };
  // ---- ciudad de 3×3 (v1.27): estar en ella (centro) o pegado a ella (anillo) da bonos ----
  // pvp: defensa contra jugadores; hordeDef / hordeAtk: defensa y ataque contra hordas que asaltan la ciudad [centro, anillo]
  // guarniciones (v1.73, Ciudadela): grupo de 4 soldados en una casilla, sin equipo, controlado por todos; mejoran junto a otras
  const LETGO = { alma: 5, acero: 1.5 }; // v1.81: «Dejar ir» una unidad viva: devuelve 1 alma cada 5 niveles y 1.5 de acero por nivel (mín. 1 de cada)
const GAR = { air: 1.75, n: 4, free: 2, cap: 6, perPlayer: 3, step: 0.15, near: 2, bonus: 0.10, maxNear: 4, mix: 0.05, maxMix: 3, e: '💂', name: 'Guarnición',
    types: { // por soldado: vida y daño; el daño total depende de cuántos quedan (4 → 1)
      esp: { n: 'Espadachines', e: '⚔️', hp: 40, dmg: 8, def: 3, mov: 3, range: 1, min: 1, reach: false, pierce: 0, kind: null, c: '#8a93a6', cost: { hierro: 4, cuero: 6 }, d: 'Resistentes y equilibrados: la primera línea. Cuerpo a cuerpo.' },
      lan: { n: 'Lanceros', e: '🔱', hp: 36, dmg: 8, def: 2, mov: 3, range: 2, min: 1, reach: true, pierce: 0, kind: 'lanza', c: '#a78b4e', cost: { hierro: 5, cuero: 5, hueso: 4 }, d: 'Golpean a 2 casillas sin penalización: perfectos detrás de los espadachines.' },
      arq: { n: 'Arqueros', e: '🏹', hp: 28, dmg: 8, def: 1, mov: 3, range: 3, min: 2, reach: false, pierce: 0, kind: 'arco', air: true, c: '#4f8f4f', cost: { cuero: 8, hueso: 6 }, d: 'Disparan a 3 casillas y hacen +75% de daño a criaturas voladoras. Frágiles: protégelos.' },
      mag: { n: 'Magos', e: '🔮', hp: 24, dmg: 9, def: 0, mov: 2, range: 3, min: 2, reach: false, pierce: 0.3, kind: 'varita', air: true, c: '#7a62d0', cost: { hierro: 3, hueso: 6, alma: 1 }, d: 'Magia a 3 casillas que ignora 30% de defensa y hace +75% de daño a criaturas voladoras. Los más frágiles.' },
    } };
  // la muralla de la Ciudadela tiene vida por casilla: las criaturas terrestres la rompen (las voladoras y trepadoras la cruzan)
  const WALL = { hp: 600, perLevel: 250, repair: { hierro: 4, hueso: 4 }, regen: 0.05, perTurn: 2 };
  const CITY_GUARD = { pvp: [8, 4], hordeDef: [10, 6], hordeAtk: [0.3, 0.2] };
  const BUILD_ORDER = ['herreria', 'cuartel', 'muralla', 'atalaya', 'iglesia', 'taller', 'asedio'];
  // mundo abierto fase 2: regiones por peligro (según la distancia al centro), jefes mundiales, protección de novato y gremios
  const WORLD = { regions: [{ n: 'Tierras seguras', e: '🌿', to: 0.22, lv: 0.3, loot: 1 }, { n: 'Tierras medias', e: '🌲', to: 0.52, lv: 0.65, loot: 1.25 }, { n: 'Tierras salvajes', e: '🔥', to: 9, lv: 1, loot: 1.6 }],
    prot: 24, wb: { first: 24, every: 48, stay: 72, hpMul: 2.5, dmgMul: 1.25, reward: { alma: 6, escama: 3, hierro: 10, acero: 4 } }, guild: { max: 8, dist: 12, def: 2 } };
  // asedios (opción del anfitrión): la muralla tiene vida, se abre una brecha al romperla y las ciudades rodeadas pasan hambre
  const SIEGE = { wall: [300, 800], regen: 0.1, hunger: 6, hungerHp: 0.08, maxPerCity: 2, tower: 14, towerRange: 2, besiege: { dist: 3, min: 2 }, repair: { hierro: 4, hueso: 3 },
    ram:  { n: 'Ariete', e: '🐏', lv: 1, hp: 140, def: 6, mov: 2, dmg: 14, min: 1, range: 1, wall: 90, cost: { hierro: 8, cuero: 6, hueso: 4 } },
    cata: { n: 'Catapulta', e: '☄️', lv: 2, hp: 70, def: 2, mov: 2, dmg: 26, min: 2, range: 3, wall: 70, cost: { hierro: 10, cuero: 8, hueso: 4, acero: 1 } } };
  const BUILD_MAX = 2;
  const ORDERS = { goto: { n: 'Ir a…', e: '📍' }, home: { n: 'Volver y depositar', e: '🏠' }, guard: { n: 'Vigilar', e: '🛡️' } };

  // ---- ajustes del mundo que elige el anfitrión ----
  const WORLD_OPTS = {
    mode:       { n: 'Modo de juego', def: 'normal', o: { normal: 'Normal', uno: 'Reto de una unidad: cada jugador (y bot) solo tiene 1 unidad y si cae queda eliminado', equipos: 'Por equipos: los jugadores se reparten al azar en equipos aliados (elige 2 o 5 equipos en el ajuste de abajo) y gana el último equipo en pie',
      mundo: 'Mundo abierto: mundo enorme y persistente para jugadores (sin bots). Se entra cuando quieras, no se recluta (solo crías), las ciudades sin tus unidades vuelven a ser neutrales y los monstruos salen de cualquier nivel',
      oleadas: 'Oleadas: cooperativo, todos aliados. Cada pocos turnos una oleada de criaturas ataca vuestras ciudades, cada vez más fuerte y con jefes; gana el grupo si resiste todas',
      ciudadela: 'Ciudadela: cooperativo. Una gran ciudad amurallada compartida por todos: defiéndela de oleadas de criaturas, mejórala entre oleadas y manda a tus unidades por escuadras',
      laberinto: 'Laberinto: sin mundo exterior; todos aliados bajan por los pisos de un laberinto (10–20) con una vela por piso en vez de ciudades y un jefe cada 2 pisos',
      historia: 'Historia: campaña cooperativa de 6 capítulos (todos los jugadores aliados) que termina contra el Dragón de Ceniza',
      rey: 'Reto del Rey Demonio: un jugador al azar es el Rey Demonio (solo recluta bestias) y los demás están aliados contra él' } },
    citRoam:    { n: 'Ciudadela: criaturas errantes entre oleadas', def: 'si', o: { si: 'Sí: merodean por el mundo (peligro y botín)', no: 'No: solo vienen en las oleadas' } },
    citDiff:    { n: 'Ciudadela: dificultad', def: 'normal', o: { normal: 'Normal (20 oleadas)', infierno: '🔥 Infierno: 100 oleadas, una cada 100 turnos, criaturas más fuertes y varios jefes' } },
    waveGap:    { n: 'Ciudadela: turnos entre oleadas (y hasta la primera)', def: 100, o: { 10: '10 turnos (muy intenso)', 25: '25 turnos', 50: '50 turnos', 100: '100 turnos (tiempo para explorar, recomendado)', 200: '200 turnos (partida muy larga)' } },
    victory:    { n: 'Tipo de final (modos Normal y Reto de una unidad)', def: 'ultimo', o: {
      ultimo: 'Último en pie (o alianza total)',
      tiempo: 'Por tiempo: a los 40 turnos gana quien tenga más puntos (si no pones otro límite)',
      dominio: 'Dominación: controla la mitad de las ciudades del mapa durante 4 turnos seguidos',
      jefes: 'Cazajefes: el primero en derrotar a 2 jefes (aparecen más a menudo)',
      campeon: 'Campeón: el primero que lleve una unidad a nivel 12',
      puntos: 'Carrera de puntos: el primero en llegar a 600 puntos' } },
    siege:      { n: 'Asedios (taller de asedio, murallas con vida, brechas y cercos)', def: 'si', o: { si: 'Activados: las murallas hay que romperlas con arietes y catapultas', no: 'Desactivados: se conquista como siempre' } },
    income:     { n: 'Producción de las ciudades (materiales por turno según terreno y edificios)', def: 'normal', o: { normal: 'Normal', bajo: 'Baja (la mitad)', apagado: 'Apagada: solo botín' } },
    events:     { n: 'Eventos del mundo', def: 'todo', o: { todo: 'Clima, torneos y mercaderes ambulantes', clima: 'Solo clima', calma: 'Nada: mundo tranquilo' } },
    floors:     { n: 'Pisos del laberinto (solo en el modo «Laberinto»)', def: '12', o: { 10: '10 pisos', 12: '12 pisos', 15: '15 pisos', 18: '18 pisos', 20: '20 pisos' } },
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
    gender:     { n: 'Crías: hace falta una pareja ♂ + ♀', def: 'si', o: { si: 'Sí: solo se emparejan un macho y una hembra (♂ + ♀)', no: 'No: cualquier pareja puede tener crías' } },
    dn:         { n: 'Día y noche (80 turnos de día, 20 de noche)', def: 'si', o: { si: 'Activado: de noche las criaturas son más fuertes y agresivas, ves menos; la antorcha 🔦 ayuda', no: 'Desactivado: siempre de día' } },
    breed:      { n: 'Crías (dos unidades juntas cerca de una ciudad)', def: 'cinco', o: { apagado: 'Desactivadas', cinco: 'Tras 5 turnos juntas', tres: 'Tras 3 turnos juntas' } },
    startUnits: { n: 'Unidades iniciales por jugador', def: 4, o: { 4: '4 (normal)', 8: '8', 14: '14 (máximo)' } },
    startLevel: { n: 'Nivel inicial de las unidades', def: 1, o: { 1: 'Nivel 1 (normal)', 3: 'Nivel 3', 6: 'Nivel 6', 10: 'Nivel 10' } },
    startArmor: { n: 'Armadura inicial', def: 'ninguna', o: { ninguna: 'Sin armadura', hierro: 'Armadura de hierro completa', acero: 'Armadura de acero completa' } },
  };

  // ---- modos rápidos del lobby: cada uno fija el modo, el reloj y los ajustes del mundo (lo que no nombra vuelve a su valor normal) ----
  const VICTORY = { dominio: { pct: 0.5, hold: 4 }, jefes: { n: 2 }, campeon: { lv: 12 }, puntos: { pts: 600 }, tiempo: { turns: 40 } };
  // modo Oleadas: total de oleadas, cada cuántos turnos llega una, y un jefe cada `boss` oleadas
  const WAVES = { total: 20, first: 3, every: 3, boss: 5, bosses: ['reylobo', 'minotauro', 'liche', 'dragon'] };
  // modo Ciudadela: mapa fijo con una gran ciudad amurallada; rect = interior (las murallas rodean ese rectángulo), gates = puertas (x, y en la muralla)
  // v1.68: defensas de la Ciudadela (se construyen con el almacén de la ciudad, fuera de la muralla)
  const DEFS = {
    torre:     { n: 'Torre de arqueros', e: '🏹', cost: { hueso: 10, hierro: 12 }, up: [{ hierro: 15, acero: 6 }, { acero: 12, alma: 3 }], d: 'Dispara a la criatura más cercana (alcance 5; nivel 3: alcance 6 y 2 disparos por turno).' },
    escarcha:  { n: 'Torre de escarcha', e: '❄️', cost: { hierro: 10, acero: 4, alma: 2 }, up: [{ acero: 8, alma: 2 }, { acero: 14, alma: 4 }], d: 'Congela a varias criaturas a 3 casillas: poco daño pero las ralentiza (nivel 3: ralentización doble).' },
    trampa:    { n: 'Trampa de pinchos', e: '🪤', cost: { hueso: 6, hierro: 4 }, up: [{ hierro: 8, hueso: 8 }, { acero: 5, hierro: 10 }], d: 'Daño fuerte al pisarla o pasar a su lado (3 cargas, se recarga al superar la oleada) y ralentiza.' },
    farola:    { n: 'Farola', e: '🏮', cost: { hueso: 3, hierro: 2, cuero: 2 }, up: [{ hierro: 4, hueso: 4 }, { hierro: 8, acero: 2 }], free: true, d: 'Ilumina un área (radio 3; nivel 2: 4; nivel 3: 5). Revela el terreno y, de noche, las criaturas pierden su bono nocturno contra quien esté en la luz. También se puede poner dentro de la muralla.' },
    barricada: { n: 'Barricada', e: '🪵', cost: { hueso: 8, cuero: 6 }, up: [{ hueso: 10, cuero: 8, hierro: 4 }, { hierro: 12, acero: 4 }], d: 'Bloquea el paso de las criaturas (tus unidades pasan). Tienen que destruirla; se repara al superar la oleada.' },
  };
  const CIT = { w: 96, h: 76, r: { x0: 35, y0: 28, x1: 60, y1: 47 }, plaza: { x: 47, y: 38 }, gates: [{ k: 'S', x: 54, y: 48 }, { k: 'N', x: 42, y: 27 }, { k: 'E', x: 61, y: 37 }],
    themes: { lobos: { n: 'Manada de lobos', e: '🐺', t: [['lgris', 'linv', 'lsomb'], ['lceniza', 'lespec', 'lhierro', 'linv', 'lsomb'], ['alfa', 'lceniza', 'lespec', 'lhierro', 'lsomb']] }, insectos: { n: 'Enjambre', e: '🪲', t: [['hormiga', 'avispa', 'mantis'], ['escarab', 'polilla', 'ciempies', 'mantis', 'avispa'], ['reina', 'escarab', 'ciempies', 'mantis', 'avispa', 'polilla']] }, muertos: { n: 'Legión de no-muertos', e: '💀', t: [['zombierr', 'esqguer', 'espectro'], ['necrofago', 'banshee', 'esqguer', 'zombierr', 'espectro'], ['cabmuerte', 'lichem', 'necrofago', 'banshee', 'esqguer']] },
      bestias: { n: 'Estampida de bestias', e: '🦣', t: [['ospardo', 'jabpiedra', 'uro', 'bufalo'], ['rino', 'uro', 'bufalo', 'jabpiedra', 'ospardo'], ['mamut', 'behemot', 'rino', 'bufalo', 'ospardo']] },
      draconidos: { n: 'Nido de dracónidos', e: '🐉', t: [['criaesm', 'wyvern', 'serpdraco', 'drake'], ['salamandra', 'drake', 'wyvern', 'dracoroca', 'serpdraco'], ['dracescarcha', 'dracoroca', 'salamandra', 'wyvern', 'drake']] },
      constructos: { n: 'Legión de piedra', e: '🗿', t: [['centinela', 'automata', 'gargola'], ['golvolc', 'automata', 'gargola', 'centinela', 'golhierro'], ['golhierro', 'colosocr', 'golvolc', 'gargola', 'automata']] },
      elementales: { n: 'Tormenta elemental', e: '🌪️', t: [['elfuego', 'elagua', 'elaire'], ['eltierra', 'elrayo', 'elhielo', 'elfuego', 'elagua'], ['eltierra', 'elrayo', 'elhielo', 'elaire', 'elfuego']] },
      felinos: { n: 'Cacería de felinos', e: '🐅', t: [['pantera', 'lince', 'jaguar'], ['leon', 'jaguar', 'pantera', 'lince', 'astral'], ['sable', 'leon', 'astral', 'pantera', 'jaguar']] },
      aves: { n: 'Bandada rapaz', e: '🦅', t: [['halcon', 'cuervo', 'buho'], ['aguila', 'buho', 'halcon', 'cuervo', 'cuervo', 'fenix'], ['roc', 'fenix', 'aguila', 'buho', 'halcon']] },
      reptiles: { n: 'Nido de reptiles', e: '🐊', t: [['sapo', 'camaleon', 'triton', 'constrictora'], ['basilisco', 'constrictora', 'sapo', 'triton', 'camaleon'], ['cocodrilo', 'basilisco', 'constrictora', 'triton', 'sapo']] },
      aracnidos: { n: 'Plaga de arañas', e: '🕷️', t: [['tejedora', 'viuda', 'nieblaar'], ['tarantula', 'escdunas', 'arcristal', 'viuda', 'tejedora', 'nieblaar'], ['tarantula', 'escdunas', 'arcristal', 'nieblaar', 'viuda']] },
      plantas: { n: 'Bosque vivo', e: '🌳', t: [['hongo', 'liana', 'musgo', 'florsolar'], ['plantacarn', 'hongo', 'liana', 'florsolar', 'musgo'], ['treant', 'plantacarn', 'liana', 'florsolar', 'hongo']] },
      demonios: { n: 'Horda infernal', e: '😈', t: [['diablillo', 'sabinf', 'sucubo'], ['cadenas', 'sucubo', 'sabinf', 'diablillo', 'bruto'], ['senorbr', 'bruto', 'cadenas', 'sucubo', 'sabinf']] },
      pesadilla: { n: 'Pesadilla', e: '🌑', t: [['ciervobr', 'cuervoecl', 'gatomed'], ['sabpes', 'tejsue', 'gatomed', 'cuervoecl', 'ciervobr'], ['torotin', 'sabpes', 'tejsue', 'gatomed', 'cuervoecl']] },
      aberracion: { n: 'Grieta del vacío', e: '👁️', t: [['ojo', 'susurrador', 'devsom'], ['mimico', 'espastral', 'ojo', 'susurrador', 'devsom', 'tentabis'], ['tentabis', 'mimico', 'espastral', 'ojo', 'devsom']] },
      slimes: { n: 'Marea de slimes', e: '🟢', t: [['slimev', 'slimeac', 'baba'], ['cubo', 'slimemag', 'lodo', 'baba', 'slimeac'], ['cubo', 'slimemag', 'lodo', 'baba', 'slimeac', 'slimev']] } },
    themeOrder: ['lobos', 'insectos', 'muertos', 'bestias', 'draconidos', 'constructos', 'elementales', 'felinos', 'aves', 'reptiles', 'aracnidos', 'plantas', 'demonios', 'pesadilla', 'aberracion', 'slimes'],
    waves: 20, first: 100, rest: 100, boss: 5, bosses: ['reylobo', 'minotauro', 'liche', 'dragon'], hp: 100, units: 999, raid: 5, startUnits: 4,
    base: 3, grow: 1.7, perPlayer: 0.35, maxEnemies: 140, hpPerWall: 50, repair: 4, spawnDist: 15, roam: { cap: 3, per: 4, max: 12, chance: 0.3, life: 120, minDist: 14 },
    arena: { x: 69, y: 32 }, market: { dy: 7, dx: [-10, -6, -2, 3, 10] }, // arena fuera de la puerta este; puestos del mercado en la calle sur
    lots: [{ k: 'cuartel', n: 'Cuartel', dx: -8, dy: -6 }, { k: 'taller', n: 'Taller del Constructor', dx: 0, dy: -7 }, { k: 'asedio', n: 'Taller de Asedio', dx: 9, dy: -6 }, { k: 'taberna', n: 'Taberna', dx: 5, dy: -7 },
      { k: 'herreria', n: 'Herrería', dx: -9, dy: -1 }, { k: 'iglesia', n: 'Iglesia', dx: -7, dy: 5 }, { k: 'establo', n: 'Establos', dx: 11, dy: 5 }] };
  // taberna (reclutas con rareza cada 30 turnos), viajeros del mundo exterior y torneo de la arena
  const BAR = { every: 30, n: 3, rar: [['Común', '#aab', 46], ['Poco común', '#4caf50', 28], ['Raro', '#3d8bff', 16], ['Épico', '#a050ff', 8], ['Legendario', '#ffc300', 2]],
    cost: [{ cuero: 8 }, { cuero: 12, hierro: 4 }, { hierro: 10, acero: 2 }, { acero: 8, alma: 3 }, { acero: 16, alma: 8, escama: 2 }] };
  const NPC = { cap: 9, every: 4, stay: 28, first: 8, kinds: { recluta: { e: '🧑', n: 'Viajero', w: 70 }, sanador: { e: '✚', n: 'Curandero', w: 16 }, maestro: { e: '📖', n: 'Maestro de armas', w: 14 } }, teach: { hierro: 6, alma: 1 } };
  const ARENA = { every: 12, first: 8, len: 3, rounds: 5 };
  const PRESETS = [
    { id: 'clasica',  e: '🏛️', n: 'Clásica',  d: 'La partida de siempre: turnos de 4 horas y sin límite de turnos.', cfg: { turnHours: 4, maxTurns: 0 } },
    { id: 'rapida',   e: '⚡', n: 'Rápida',   d: 'Para jugar en una tarde: mapa pequeño, 8 unidades de nivel 3, crías a los 3 turnos, turnos de 15 minutos y 30 turnos como máximo.', cfg: { turnHours: 0.25, maxTurns: 30, mapSize: 'pequeno', startUnits: '8', startLevel: '3', breed: 'tres' } },
    { id: 'epica',    e: '🐉', n: 'Épica',    d: 'Una campaña larga: mapa grande con muchas aldeas, criaturas agresivas, 8 unidades de nivel 3 con armadura de hierro y turnos de 8 horas.', cfg: { turnHours: 8, maxTurns: 0, mapSize: 'grande', cities: 'muchas', fauna: 'agresiva', startUnits: '8', startLevel: '3', startArmor: 'hierro' } },
    { id: 'reto',     e: '🎯', n: 'Reto',     d: 'Reto de una unidad: cada jugador (y bot) tiene una sola unidad y, si cae, queda eliminado. Mapa pequeño y turnos de 1 hora.', cfg: { turnHours: 1, maxTurns: 0, mode: 'uno', mapSize: 'pequeno' } },
    { id: 'equipos',  e: '🤝', n: 'Equipos',  d: 'Dos equipos al azar, aliados por dentro y enemigos entre sí. Gana el último equipo en pie. Turnos de 1 hora.', cfg: { turnHours: 1, maxTurns: 0, mode: 'equipos', teams: 'dos' } },
    { id: 'rey',      e: '👑', n: 'Rey Demonio', d: 'Un jugador al azar es el Rey Demonio (solo recluta bestias, con un jefe de protagonista) contra todos los demás, aliados. Turnos de 1 hora.', cfg: { turnHours: 1, maxTurns: 0, mode: 'rey' } },
    { id: 'historia', e: '📖', n: 'Historia', d: 'Campaña cooperativa de 6 capítulos contra el Dragón de Ceniza, con todos los jugadores aliados. Turnos de 1 hora.', cfg: { turnHours: 1, maxTurns: 0, mode: 'historia' } },
    { id: 'oleadas',  e: '🌊', n: 'Oleadas', d: 'Cooperativo: todos aliados defienden sus ciudades de 20 oleadas de criaturas cada vez más fuertes, con un jefe cada 5. Cada oleada superada da botín. Turnos de 1 hora.', cfg: { turnHours: 1, maxTurns: 0, mode: 'oleadas' } },
    { id: 'ciudadela', e: '🏰', n: 'Ciudadela', d: 'Cooperativo: una gran ciudad amurallada compartida por todos. Defiéndela de 20 oleadas, mejórala entre oleadas y manda a tus unidades por escuadras. Turnos de 1 hora.', cfg: { turnHours: 1, maxTurns: 0, mode: 'ciudadela' } },
    { id: 'laberinto', e: '🕯️', n: 'Laberinto', d: 'Cooperativo: todos aliados bajan por los pisos de un laberinto (12 por defecto, un jefe cada 2) con 2 unidades y una vela por piso en lugar de ciudades. Turnos de 1 hora.', cfg: { turnHours: 1, maxTurns: 0, mode: 'laberinto', floors: '12' } },
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
    intro: 'Hace mil años el Dragón de Ceniza devoraba el cielo, y dos ángeles descendieron a encadenarlo: Elizabeth, el Alba que sana, y Nathaly, la Vigía que nunca duerme. Desde entonces todo el reino las adora. En cada aldea hay un altar de dos velas, y los niños aprenden la plegaria: «Elizabeth, enciende el alba; Nathaly, guarda la noche». Las Guardianas prometieron volver cuando el volcán despertara y la fe de los vivos las llamara. Esta noche el volcán despertó. Del cráter cae ceniza, las criaturas enloquecen y los jefes antiguos —el Rey Lobo, el Liche y, sobre todos, el Dragón de Ceniza— vuelven a rondar. Ustedes son los últimos aventureros en pie. Aliados, o cenizas.',
    chapters: [
      { t: 'El eco de la ceniza', txt: 'Las bestias huyen del volcán y atacan sin miedo. Antes de pensar en dragones hay que aprender a sobrevivir: entre todos, derroten a 12 criaturas.',
        done: 'Las bestias retroceden. Un anciano de la aldea enciende las dos velas del altar y murmura: «Que Elizabeth los guíe y Nathaly los vigile. Doce... no está mal para empezar, pero lo que viene no tiene colmillos de lobo.»',
        goals: [{ k: 'kills', n: 12, txt: 'Derrotar criaturas (entre todos)' }], reward: { m: { cuero: 8, hueso: 8, hierro: 6 }, w: [60, 30, 9, 1, 0] } },
      { t: 'Tierras propias', txt: 'Un campamento no basta para resistir. Reclamen las ciudades abandonadas del mapa: necesitamos un refugio por cabeza y algunos más. En cada una sigue en pie el altar de las dos velas, esperando a quien vuelva a rezar.',
        done: 'Las murallas se alzan en cada rincón. Por primera vez en semanas, el humo que se ve en el horizonte es de chimeneas y no de ceniza, y en cada plaza vuelve a arder un altar de dos velas.',
        goals: [{ k: 'cities', extra: 3, txt: 'Ciudades del grupo (jugadores + 3)' }], reward: { m: { hierro: 12, acero: 4, cuero: 8 }, w: [50, 35, 12, 3, 0] } },
      { t: 'Peregrinos del alba', txt: 'Con las ciudades en pie llegan los peregrinos: familias enteras que caminan de aldea en aldea con una vela en la mano, rezando a Elizabeth y a Nathaly. Los caminos están infestados de bestias. Despejen las rutas: entre todos, derroten a 25 criaturas más.',
        done: 'Los peregrinos llegan a los altares y cantan hasta el amanecer. Una niña regala una vela a cada uno de ustedes: «Para que Nathaly los encuentre en la oscuridad».',
        goals: [{ k: 'kills', n: 25, txt: 'Derrotar criaturas en los caminos (entre todos)' }], reward: { m: { cuero: 10, hueso: 10, hierro: 8, alma: 2 }, w: [50, 35, 12, 3, 0] } },
      { t: 'Acero y leyenda', txt: 'Con palos y cuero no se derriba a un jefe. Que la forja no se apague: alguien debe llegar a nivel 8 y vestir equipo de acero o mejor.',
        done: 'El yunque canta y las armaduras brillan. Los herreros graban en cada hoja los nombres de Elizabeth y Nathaly, y los bardos ya inventan canciones sobre ustedes; todavía no saben que son demasiado optimistas.',
        goals: [{ k: 'level', n: 8, txt: 'Una unidad de nivel 8' }, { k: 'tier', n: 3, txt: 'Equipar algo de calidad Acero o mejor' }], reward: { m: { acero: 8, alma: 4 }, w: [30, 35, 25, 9, 1] } },
      { t: 'El refugio sagrado', txt: 'La ceniza apaga el ánimo de la gente, y sin fe no hay quien aguante. Todo el reino reza a dos nombres: Elizabeth, que sana al herido, y Nathaly, que vela al que duerme. Levanten una iglesia: que alguna de sus ciudades alcance un templo de nivel 3 y la fe vuelva a las murallas.',
        done: 'Las campanas suenan por primera vez desde que despertó el volcán. Los aldeanos lloran, ríen y vuelven a abrir las ventanas; en el templo, dos velas arden sin que nadie las encienda.',
        goals: [{ k: 'church', n: 3, txt: 'Una iglesia de nivel 3 en alguna ciudad' }], reward: { m: { alma: 6, hueso: 10, hierro: 8 }, w: [35, 35, 22, 7, 1] } },
      { t: 'Bajo la tierra', txt: 'Las criaturas salen de las grietas del volcán. Las crónicas dicen que las Guardianas sellaron esas cuevas hace mil años y que los sellos se están rompiendo. Hay mazmorras bajo el mapa: despejen al menos una (derroten a su jefe) y traigan lo que haya allí abajo.',
        done: 'El último eco del jefe se apaga bajo la roca. Han regresado con cofres, cicatrices y la certeza de que el Rey Lobo ya no tiene dónde esconderse.',
        goals: [{ k: 'dungeon', n: 1, txt: 'Despejar una mazmorra (derrotar a su jefe)' }], reward: { m: { acero: 8, alma: 6, escama: 1 }, w: [25, 35, 28, 10, 2] } },
      { t: 'El milagro de las Guardianas', txt: 'Los sacerdotes lo enseñan desde siempre: cuando la fe de los vivos sea tan alta como la montaña, una de las Guardianas bajará a responder. Eleven una iglesia hasta el nivel 5 y recen. Elizabeth o Nathaly acudirá.',
        done: 'Una luz dorada rompe la ceniza y una joven alada desciende ante el altar: rizos negros, ojos marrones y una sonrisa tranquila. «Oí sus plegarias», dice. Los aldeanos caen de rodillas; ya no es una leyenda. El ángel velará por la ciudad, pero el Dragón aún no ha caído.',
        goals: [{ k: 'church', n: 5, txt: 'Una iglesia de nivel 5 (el ángel desciende)' }], reward: { m: { alma: 10, acero: 8, escama: 1 }, w: [20, 30, 30, 15, 5] } },
      { t: 'El laberinto sellado', txt: 'Mientras el ángel vela la ciudad, bajo la montaña se rompe el sello que Elizabeth dejó sobre el Laberinto. Su guardián, el Minotauro, sale furioso a embestir todo lo que encuentra. Está en el mapa: acábenlo antes de que derribe las murallas.',
        done: 'El Minotauro cae de rodillas y se desploma. De su cuerno cuelga una cadena rota con la marca de las dos velas: alguien lo encadenó para que guardara el laberinto, y la ceniza lo enloqueció.', boss: 'minotauro', lv: [0, 7, 13],
        goals: [{ k: 'boss', t: 'minotauro', txt: 'Derrotar al Minotauro del Laberinto' }], reward: { m: { alma: 8, acero: 8, escama: 1 }, w: [20, 30, 30, 15, 5] } },
      { t: 'El rey de los lobos', txt: 'El aullido se oye desde las montañas: el Rey Lobo ha bajado a cazar. Está en el mapa. Derrótenlo antes de que su manada arrase las ciudades.',
        done: 'El Rey Lobo cae y su aullido se apaga. Alguien susurra «gracias, Elizabeth» mientras entre sus huesos aparece un colmillo con un símbolo: la marca del Liche.', boss: 'reylobo', lv: [-1, 5, 12],
        goals: [{ k: 'boss', t: 'reylobo', txt: 'Derrotar al Rey Lobo' }], reward: { m: { alma: 6, acero: 8 }, w: [20, 30, 30, 15, 5] } },
      { t: 'La Hidra de las Ciénagas', txt: 'Las ciénagas hierven y el agua de los pozos se vuelve negra. Una Hidra de mil cabezas bebe de las fuentes benditas de Nathaly y las envenena. Sin agua limpia no hay rezo ni cosecha: derrótenla.',
        done: 'La última cabeza de la Hidra se hunde en el pantano y el agua vuelve a correr clara. Los aldeanos bautizan la fuente con el nombre de Nathaly y dejan una vela flotando sobre ella.', boss: 'hidra', lv: [0, 8, 14],
        goals: [{ k: 'boss', t: 'hidra', txt: 'Derrotar a la Hidra de las Ciénagas' }], reward: { m: { alma: 8, acero: 8, escama: 2 }, w: [15, 30, 33, 17, 5] } },
      { t: 'La vigilia de las velas', txt: 'La fe no basta si los brazos tiemblan. Que un héroe del grupo alcance el nivel 12 y vista armadura de alma o mejor: la vigilia de esta noche se hace con las armas en la mano.',
        done: 'El héroe ofrece su espada ante el altar y las dos velas se alzan un instante, como si respondieran. Todo el reino lo ve y respira por primera vez en semanas.',
        goals: [{ k: 'level', n: 12, txt: 'Una unidad de nivel 12' }, { k: 'tier', n: 4, txt: 'Equipar algo de calidad Alma o mejor' }], reward: { m: { acero: 10, alma: 8 }, w: [10, 30, 35, 20, 5] } },
      { t: 'El Conde de la noche eterna', txt: 'Las velas de los altares se apagan solas, una a una, y los peregrinos se duermen y no despiertan. Un Conde Vampiro se alimenta de la fe de los vivos desde las sombras. Encuentren su guarida y acaben con él antes de que se apague la última vela.',
        done: 'El Conde se convierte en ceniza con el primer rayo del alba. En todos los altares las velas vuelven a encenderse solas: Elizabeth ha vuelto a encender el alba.', boss: 'conde', lv: [0, 9, 14],
        goals: [{ k: 'boss', t: 'conde', txt: 'Derrotar al Conde Vampiro' }], reward: { m: { alma: 10, acero: 8, escama: 2 }, w: [10, 25, 35, 22, 8] } },
      { t: 'El Coloso caído', txt: 'Entre la ceniza, las estatuas que el reino levantó en honor a las Guardianas se agrietan y se alzan, fundidas en un solo Coloso. Camina hacia la ciudad con los ojos vacíos: no es un enemigo, es una plegaria corrompida. Rómpanlo con respeto.',
        done: 'El Coloso se desploma y, entre los escombros, aparece intacto un pequeño altar de dos velas. Los soldados se quitan el casco en silencio: «Perdónanos, Elizabeth; perdónanos, Nathaly».', boss: 'coloso', lv: [1, 10, 15],
        goals: [{ k: 'boss', t: 'coloso', txt: 'Derrotar al Coloso de Piedra' }], reward: { m: { alma: 10, acero: 10, escama: 2 }, w: [8, 22, 35, 25, 10] } },
      { t: 'La noche del Liche', txt: 'Una niebla fría cubre el mapa. El Liche, el hereje que juró apagar las velas de las Guardianas, invoca a los muertos desde la distancia: sus hechizos alcanzan lejos. Acorten la distancia, rodéenlo y acaben con él.',
        done: 'El Liche se deshace en polvo con un último susurro: «El Dragón... ya despierta». El suelo tiembla bajo sus pies.', boss: 'liche', lv: [0, 6, 13],
        goals: [{ k: 'boss', t: 'liche', txt: 'Derrotar al Liche' }], reward: { m: { alma: 8, acero: 8, escama: 2 }, w: [10, 25, 35, 22, 8] } },
      { t: 'La víspera del Dragón', txt: 'El Liche tenía razón: el volcán ruge. El reino entero ha encendido una vela por cada soldado. Reclamen cada ciudad que puedan defender y que alguien alcance el nivel 15: la última batalla no admite ensayos.',
        done: 'Mil velas arden en las murallas. Elizabeth y Nathaly no pueden pelear por ustedes, pero cada llama es una plegaria que los acompaña. Al amanecer, el cielo se vuelve rojo.',
        goals: [{ k: 'cities', extra: 6, txt: 'Ciudades del grupo (jugadores + 6)' }, { k: 'level', n: 15, txt: 'Una unidad de nivel 15' }], reward: { m: { alma: 12, acero: 10, escama: 3 }, w: [5, 20, 35, 28, 12] } },
      { t: 'El Dragón de Ceniza', txt: 'El volcán estalla y el cielo se vuelve rojo. El Dragón de Ceniza, el mismo que Elizabeth y Nathaly encadenaron hace mil años, ha despertado. Es la última batalla: reúnan a todos, curen a los heridos y no den un paso atrás. En cada altar del reino, el pueblo reza por ustedes.',
        done: '', boss: 'dragon', lv: [1, 8, 15], goals: [{ k: 'boss', t: 'dragon', txt: 'Derrotar al Dragón de Ceniza' }], reward: null },
    ],
    outro: 'El Dragón de Ceniza cae con un rugido que sacude el mundo, y el volcán se apaga para siempre. Las aldeas encienden hogueras, los bardos —esta vez con razón— cantan su victoria, y todo el reino sabe sus nombres. Esa noche, en cada altar, las dos velas se encienden solas: Elizabeth enciende el alba y Nathaly guarda la noche. FIN.',
    lost: 'Nadie quedó en pie para encender las hogueras. La ceniza cubre el reino... pero en algún altar perdido todavía arden dos velas, y las leyendas dicen que otro grupo, algún día, volverá a intentarlo.',
  };
  // trueque en la ciudad: sobrante barato → material superior (con pérdida, para no vaciar la economía)
  const CONVERT = [
    { from: 'cuero', to: 'hierro', rate: 10 }, { from: 'hueso', to: 'hierro', rate: 10 },
    { from: 'hierro', to: 'acero', rate: 8 }, { from: 'acero', to: 'alma', rate: 6 }, { from: 'alma', to: 'escama', rate: 8 },
  ];
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
    W: { n: 'Muralla de la ciudadela', c: 99, def: 0 },
    O: { n: 'Puerta de la ciudadela', c: 1, def: 3 },
    Z: { n: 'Muralla (trepable)', c: 3, def: 0 }, // solo para criaturas que trepan (no existe en el mapa)
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
    // --- v1.65: bestiario de la Ciudadela (cit: solo aparecen en ese modo; ab = habilidad; ds = descripción) ---
    lgris:     { n: 'Lobo gris común', e: '🐺', hp: 34, dmg: 7, def: 1, mov: 4, agg: 3, max: 8, xp: 8, cit: true, fam: 'lobo', ab: 'manada', ds: 'Cazador ágil y coordinado. Embosca en manada: +10% de daño por cada lobo aliado a 2 casillas (hasta +30%).', drops: { cuero: [1, 2], hueso: [1, 2] } },
    linv:      { n: 'Lobo invernal', e: '🐺', hp: 46, dmg: 9, def: 3, mov: 4, agg: 3, max: 12, xp: 12, cit: true, fam: 'lobo', ab: 'escarcha', ds: 'Pelaje blanco y aliento helado. Aullido de escarcha: al atacar ralentiza a todos los enemigos a 2 casillas.', drops: { cuero: [1, 3], hueso: [1, 2] } },
    lsomb:     { n: 'Lobo sombrío', e: '🐺', hp: 44, dmg: 11, def: 2, mov: 5, agg: 4, max: 13, xp: 13, cit: true, fam: 'lobo', ab: 'sombra', ds: 'Se funde con la oscuridad. Paso umbrío: esquiva el 25% de los golpes que recibe.', drops: { cuero: [1, 3], hueso: [1, 2] } },
    lceniza:   { n: 'Lobo de ceniza', e: '🐺', hp: 58, dmg: 12, def: 4, mov: 4, agg: 4, max: 14, xp: 15, cit: true, fam: 'lobo', ab: 'brasas', ds: 'Habita cerca de volcanes. Sus garras dejan brasas: queman al objetivo durante 2 turnos.', drops: { hueso: [1, 3], hierro: [0, 1], cuero: [1, 2] } },
    lespec:    { n: 'Lobo espectral', e: '🐺', hp: 48, dmg: 12, def: 5, mov: 4, agg: 5, max: 14, xp: 16, cit: true, fam: 'lobo', ab: 'etereo', cross: 'g', ds: 'Espíritu feral. Etéreo: atraviesa las murallas de la Ciudadela sin usar las puertas.', drops: { hueso: [1, 3], hierro: [0, 1] }, soul: 0.08 },
    lhierro:   { n: 'Lobo colmillo de hierro', e: '🐺', hp: 80, dmg: 12, def: 10, mov: 3, agg: 3, max: 14, xp: 18, cit: true, fam: 'lobo', ab: 'hierro', ds: 'Su pelaje es tan duro como una cota de malla: los golpes ligeros (hasta 10 de daño) le hacen la mitad.', drops: { hierro: [1, 3], acero: [0, 1], cuero: [1, 2] } },
    alfa:      { n: 'Alfa sangriento', e: '🐺', hp: 150, dmg: 17, def: 8, mov: 4, agg: 5, max: 18, xp: 40, cit: true, fam: 'lobo', ab: 'furia', ds: 'Líder imponente. Furia de manada: todos los lobos a 6 casillas hacen +25% de daño mientras él viva.', drops: { cuero: [3, 5], acero: [1, 2], hueso: [2, 4] }, soul: 0.2 },
    mantis:    { n: 'Mantis cuchilla', e: '🦗', hp: 30, dmg: 14, def: 1, mov: 5, agg: 4, max: 12, xp: 13, cit: true, fam: 'insecto', ab: 'filo', pierce: 0.3, ds: 'Depredadora rápida con extremidades como espadas: ignora el 30% de la defensa.', drops: { hueso: [1, 2], cuero: [1, 1] } },
    escarab:   { n: 'Escarabajo blindado', e: '🪲', hp: 70, dmg: 8, def: 12, mov: 2, agg: 3, max: 14, xp: 15, cit: true, fam: 'insecto', ab: 'reflejo', ds: 'Caparazón reflectante: devuelve el 20% del daño que recibe en cuerpo a cuerpo.', drops: { hueso: [2, 3], hierro: [1, 1] } },
    avispa:    { n: 'Avispa aguijón real', e: '🐝', hp: 28, dmg: 9, def: 0, mov: 6, agg: 5, max: 10, xp: 11, cit: true, fam: 'insecto', ab: 'aguijon', ds: 'Su veneno es paralizante. Picadura letal: envenena; si el objetivo ya estaba envenenado, lo aturde 2 turnos.', drops: { hueso: [0, 1], cuero: [1, 1] } },
    hormiga:   { n: 'Hormiga obrera gigante', e: '🐜', hp: 44, dmg: 6, def: 4, mov: 3, agg: 3, max: 9, xp: 8, cit: true, fam: 'insecto', ds: 'Defiende los túneles con tenacidad. Aparece en grandes grupos.', drops: { hueso: [1, 2], cuero: [1, 2] } },
    polilla:   { n: 'Polilla lunar', e: '🦋', hp: 32, dmg: 5, def: 1, mov: 4, agg: 4, max: 11, xp: 11, cit: true, fam: 'insecto', ab: 'polvo', ds: 'Polvo onírico: al atacar adormece a los enemigos a 2 casillas (ralentiza 2 turnos).', drops: { cuero: [1, 2], hueso: [0, 1] }, soul: 0.04 },
    ciempies:  { n: 'Ciempiés de las cavernas', e: '🐛', hp: 52, dmg: 11, def: 4, mov: 5, agg: 4, max: 13, xp: 13, cit: true, fam: 'insecto', ab: 'trepa', cross: 'Z', ds: 'Veloz y segmentado: trepa las murallas (tarda más que por las puertas).', drops: { hueso: [1, 3], cuero: [1, 2] } },
    reina:     { n: 'Reina de la colmena', e: '👑', hp: 160, dmg: 12, def: 6, mov: 2, agg: 5, max: 18, xp: 45, cit: true, fam: 'insecto', ab: 'llamado', ds: 'Llamado del enjambre: cada 3 turnos invoca hasta 2 crías (máx. 4 vivas). Al caer, las crías desaparecen.', drops: { hueso: [3, 5], cuero: [2, 4], acero: [0, 1] }, soul: 0.2 },
    zombierr:  { n: 'Zombi errante', e: '🧟', hp: 90, dmg: 10, def: 4, mov: 2, agg: 7, max: 14, xp: 14, cit: true, fam: 'muerto', ds: 'Lento pero incansable: detecta la vida desde muy lejos (7 casillas).', drops: { hueso: [2, 4], cuero: [1, 1] }, soul: 0.05 },
    esqguer:   { n: 'Esqueleto guerrero', e: '💀', hp: 62, dmg: 12, def: 8, mov: 3, agg: 4, max: 14, xp: 17, cit: true, fam: 'muerto', ds: 'Restos animados con armadura oxidada. No siente dolor ni miedo.', drops: { hueso: [2, 4], hierro: [1, 2] }, soul: 0.06 },
    espectro:  { n: 'Espectro lúgubre', e: '👻', hp: 40, dmg: 11, def: 5, mov: 3, agg: 5, max: 12, xp: 15, cit: true, fam: 'muerto', ab: 'gelido', ds: 'Toque gélido: drena vida (se cura el 40% del daño) y ralentiza al objetivo.', drops: { hueso: [1, 3], hierro: [0, 1] }, soul: 0.12 },
    necrofago: { n: 'Necrófago de cripta', e: '🧟', hp: 68, dmg: 12, def: 4, mov: 4, agg: 4, max: 13, xp: 16, cit: true, fam: 'muerto', ab: 'devora', ds: 'Se fortalece al devorar: cura el 25% del daño que hace y gana +10% de daño por cada unidad que mata (hasta +50%).', drops: { hueso: [2, 4], cuero: [0, 1] }, soul: 0.05 },
    cabmuerte: { n: 'Caballero de la muerte', e: '⚔️', hp: 120, dmg: 17, def: 12, mov: 3, agg: 5, max: 18, xp: 30, cit: true, fam: 'muerto', ab: 'profano', ds: 'Hoja profanada: la unidad golpeada no puede curarse durante 2 turnos.', drops: { hierro: [2, 3], acero: [1, 2], hueso: [2, 3] }, soul: 0.1 },
    banshee:   { n: 'Banshee del pantano', e: '👻', hp: 44, dmg: 9, def: 4, mov: 3, agg: 5, max: 12, xp: 18, rng: 2, cit: true, fam: 'muerto', ab: 'alarido', ds: 'Alarido desgarrador: al atacar siembra el pánico a 4 casillas (−20% de daño y ralentiza 2 turnos).', drops: { hueso: [1, 3], hierro: [0, 1] }, soul: 0.15 },
    lichem:    { n: 'Liche menor', e: '🧙', hp: 80, dmg: 15, def: 6, mov: 3, agg: 5, max: 16, xp: 28, rng: 3, pierce: 0.4, cit: true, fam: 'muerto', ab: 'oscura', ds: 'Hechicero no-muerto: magia oscura a 3 casillas que ignora el 40% de la defensa.', drops: { alma: [1, 2], hueso: [2, 3], hierro: [0, 1] }, soul: 0.2 },
    ospardo: { n: 'Oso pardo de montaña', e: '🐻', hp: 110, dmg: 16, def: 5, mov: 3, agg: 4, max: 12, xp: 22, cit: true, fam: 'bestia', ds: 'Fuerza descomunal: sus zarpazos derriban árboles.', drops: { cuero: [3, 5], hueso: [2, 4] } },
    jabpiedra: { n: 'Jabalí colmillo de piedra', e: '🐗', hp: 85, dmg: 14, def: 8, mov: 4, agg: 4, max: 11, xp: 20, cit: true, fam: 'bestia', ab: 'embestida', pierce: 0.3, st: 2, ds: 'Embestida imparable: su carga atraviesa defensas (ignora 30%) y derriba al objetivo 2 turnos.', drops: { cuero: [2, 4], hueso: [2, 3], hierro: [0, 1] } },
    mamut: { n: 'Mamut de tundra', e: '🦣', hp: 180, dmg: 15, def: 9, mov: 2, agg: 3, max: 13, xp: 32, cit: true, fam: 'bestia', ab: 'pisoton', ar: { r: 2, s: 2, at: 'c' }, ds: 'Pisotón sísmico: cada golpe sacude el suelo y derriba (ralentiza 2 turnos) a todos a 2 casillas.', drops: { cuero: [4, 6], hueso: [3, 5] } },
    rino: { n: 'Rinoceronte acorazado', e: '🦏', hp: 130, dmg: 18, def: 13, mov: 3, agg: 4, max: 12, xp: 26, cit: true, fam: 'bestia', ab: 'romper', pierce: 0.25, ds: 'Piel gruesa y cuerno macizo: rompe formaciones (ignora 25% de la defensa).', drops: { cuero: [3, 5], hueso: [2, 3], hierro: [0, 1] } },
    uro: { n: 'Uro ancestral', e: '🐂', hp: 120, dmg: 15, def: 6, mov: 3, agg: 4, max: 12, xp: 22, cit: true, fam: 'bestia', ab: 'impredecible', rnd: [0.6, 1.6], ds: 'Gran resistencia y temperamento impredecible: su daño varía entre 60% y 160%.', drops: { cuero: [3, 5], hueso: [2, 4] } },
    bufalo: { n: 'Búfalo de tormenta', e: '🦬', hp: 100, dmg: 13, def: 5, mov: 4, agg: 4, max: 12, xp: 24, cit: true, fam: 'bestia', ab: 'descarga', ch: [1, 0.5], ds: 'Descarga de carga: al impactar libera un rayo que salta a otro enemigo cercano (50% del daño).', drops: { cuero: [3, 4], hueso: [1, 3] } },
    behemot: { n: 'Behemot de las cumbres', e: '🦍', hp: 260, dmg: 22, def: 14, mov: 2, agg: 6, max: 16, xp: 50, cit: true, fam: 'bestia', ds: 'Coloso territorial que domina los picos: detecta intrusos desde 6 casillas.', drops: { cuero: [4, 6], hueso: [4, 6], acero: [1, 2] } },
    dracoroca: { n: 'Draco de roca', e: '🐲', hp: 140, dmg: 17, def: 16, mov: 3, agg: 4, max: 14, xp: 30, cit: true, fam: 'draco', ab: 'mandibula', pierce: 0.2, ds: 'Sin alas, escamas grisáceas y mandíbula trituradora (ignora 20% de la defensa).', drops: { hueso: [2, 4], hierro: [1, 3], escama: [0, 1] } },
    wyvern: { n: 'Wyvern de acantilado', e: '🐉', hp: 90, dmg: 14, def: 5, mov: 6, agg: 5, max: 12, xp: 26, cit: true, fam: 'draco', ab: 'picada', cross: 'g', ps: { t: 3, pct: 0.25 }, ds: 'Ágil y voladora (cruza las murallas). Picada de cola: inyecta una toxina rápida.', drops: { cuero: [2, 3], hueso: [1, 2], escama: [0, 1] } },
    salamandra: { n: 'Salamandra de magma', e: '🦎', hp: 110, dmg: 15, def: 8, mov: 3, agg: 4, max: 12, xp: 26, cit: true, fam: 'draco', rng: 2, ab: 'manto', bn: { t: 2, pct: 0.25 }, th: { t: 2, pct: 0.2 }, ds: 'Escupe chispas a 2 casillas. Manto ígneo: quema a quienes la atacan cuerpo a cuerpo.', drops: { hueso: [1, 3], hierro: [1, 2], escama: [0, 1] } },
    criaesm: { n: 'Cría de dragón esmeralda', e: '🐉', hp: 60, dmg: 10, def: 3, mov: 4, agg: 4, max: 9, xp: 16, cit: true, fam: 'draco', rng: 2, ab: 'acido', ps: { t: 3, pct: 0.25 }, ds: 'Curiosa y astuta: exhala ráfagas de gas ácido a 2 casillas que envenenan.', drops: { cuero: [1, 2], hueso: [1, 2], escama: [0, 1] } },
    drake: { n: 'Drake de pantano', e: '🐊', hp: 130, dmg: 16, def: 8, mov: 4, agg: 5, max: 12, xp: 26, cit: true, fam: 'draco', ab: 'embosca', op: 1.6, ds: 'Camuflado en el lodo: su primer golpe contra cada objetivo hace +60% de daño.', drops: { cuero: [2, 4], hueso: [2, 3], escama: [0, 1] } },
    dracescarcha: { n: 'Dragón de escarcha', e: '🐉', hp: 320, dmg: 24, def: 14, mov: 3, agg: 6, max: 18, xp: 60, cit: true, fam: 'draco', rng: 3, ab: 'glaciar', ar: { r: 2, s: 2, at: 't' }, soul: 0.3, ds: 'Habita glaciares. Aliento glaciar (3 casillas): congela el terreno y ralentiza 2 turnos a los enemigos cerca del objetivo.', drops: { alma: [1, 2], hueso: [3, 5], escama: [1, 2] } },
    serpdraco: { n: 'Serpiente dracónica', e: '🐍', hp: 120, dmg: 17, def: 7, mov: 4, agg: 5, max: 12, xp: 26, cit: true, fam: 'draco', ab: 'abrasa', bn: { t: 3, pct: 0.25 }, ds: 'Larga, sin patas, con cresta ósea. Su mordida abrasadora quema 3 turnos.', drops: { cuero: [2, 3], hueso: [2, 3], escama: [0, 1] } },
    golvolc: { n: 'Gólem de piedra volcánica', e: '🗿', hp: 200, dmg: 17, def: 14, mov: 2, agg: 3, max: 14, xp: 34, cit: true, fam: 'constructo', ab: 'rocapiel', rd: 0.6, soul: 0.08, ds: 'Lento y masivo. Piel de roca: recibe solo el 60% del daño.', drops: { hierro: [2, 4], acero: [1, 2] } },
    automata: { n: 'Autómata de bronce', e: '🤖', hp: 90, dmg: 14, def: 9, mov: 3, agg: 3, max: 11, xp: 18, cit: true, fam: 'constructo', ab: 'metodico', pierce: 0.2, ds: 'Guardián articulado de antiguas ruinas: ataca con precisión metódica (ignora 20% de la defensa).', drops: { hierro: [1, 3], acero: [0, 1] } },
    golhierro: { n: 'Gólem de hierro', e: '🤖', hp: 220, dmg: 18, def: 20, mov: 2, agg: 3, max: 14, xp: 36, cit: true, fam: 'constructo', soul: 0.08, ds: 'Forjado para resistir asedios y proteger fortalezas: defensa enorme.', drops: { hierro: [3, 5], acero: [1, 3] } },
    centinela: { n: 'Centinela de arcilla', e: '🗿', hp: 70, dmg: 9, def: 8, mov: 2, agg: 2, max: 9, xp: 10, cit: true, fam: 'constructo', ds: 'Animado por runas simples: obedece al pie de la letra, solo ataca lo que tiene muy cerca.', drops: { hierro: [1, 2], hueso: [0, 1] } },
    gargola: { n: 'Gárgola animada', e: '🦇', hp: 80, dmg: 15, def: 8, mov: 5, agg: 5, max: 11, xp: 20, cit: true, fam: 'constructo', ab: 'caida', cross: 'g', op: 1.7, st: 1, ds: 'Vigila torres y fachadas; vuela (cruza las murallas). Caída pétrea: su primer golpe a cada objetivo hace +70% y lo aturde.', drops: { hierro: [1, 2], acero: [0, 1] } },
    colosocr: { n: 'Coloso de cristal', e: '💎', hp: 170, dmg: 17, def: 14, mov: 2, agg: 4, max: 14, xp: 36, cit: true, fam: 'constructo', ab: 'refrac', rr: 0.5, soul: 0.1, ds: 'Destellos cegadores. Refracción prismática: desvía el 50% del daño de los proyectiles y la magia.', drops: { hierro: [2, 3], acero: [1, 2], alma: [0, 1] } },
    elfuego: { n: 'Elemental de fuego', e: '🔥', hp: 70, dmg: 14, def: 3, mov: 4, agg: 5, max: 11, xp: 17, cit: true, fam: 'elemental', ab: 'quema', bn: { t: 2, pct: 0.3 }, soul: 0.05, ds: 'Cuerpo de llamas danzantes: quema todo lo que toca (2 turnos).', drops: { hueso: [0, 1], hierro: [0, 1] } },
    elagua: { n: 'Elemental de agua', e: '💧', hp: 85, dmg: 11, def: 5, mov: 4, agg: 4, max: 11, xp: 15, cit: true, fam: 'elemental', ab: 'fluido', rg: 0.08, soul: 0.05, ds: 'Fluido y adaptable: recupera el 8% de su vida cada turno.', drops: { hueso: [0, 1], cuero: [0, 1] } },
    eltierra: { n: 'Elemental de tierra', e: '⛰️', hp: 140, dmg: 14, def: 14, mov: 2, agg: 4, max: 12, xp: 24, cit: true, fam: 'elemental', ab: 'sismica', st: 1, pierce: 0.15, soul: 0.05, ds: 'Masa de rocas compacta: golpea con fuerza sísmica (aturde 1 turno, ignora 15% de la defensa).', drops: { hierro: [1, 3], hueso: [0, 1] } },
    elaire: { n: 'Elemental de aire', e: '🌪️', hp: 60, dmg: 10, def: 3, mov: 6, agg: 5, max: 11, xp: 16, cit: true, fam: 'elemental', ab: 'ciclon', cross: 'g', push: 2, st: 1, soul: 0.05, ds: 'Torbellino vivo; vuela (cruza las murallas). Ráfaga ciclónica: empuja 2 casillas al objetivo y lo ralentiza.', drops: { cuero: [0, 1] } },
    elrayo: { n: 'Elemental de rayo', e: '⚡', hp: 65, dmg: 12, def: 3, mov: 5, agg: 5, max: 11, xp: 17, cit: true, fam: 'elemental', rng: 2, ab: 'arco', ch: [2, 0.5], soul: 0.05, ds: 'Rápido y chispeante (2 casillas). Arco voltaico: la electricidad salta a hasta 2 enemigos más cercanos (50%).', drops: { hierro: [0, 1], hueso: [0, 1] } },
    elhielo: { n: 'Elemental de hielo', e: '❄️', hp: 100, dmg: 12, def: 8, mov: 3, agg: 4, max: 12, xp: 18, cit: true, fam: 'elemental', ab: 'enfria', au: { r: 2, s: 1 }, st: 1, soul: 0.05, ds: 'Núcleo cristalino rodeado de ventisca: enfría el ambiente (ralentiza a todos a 2 casillas en cada turno) y congela al golpear.', drops: { hueso: [0, 1], hierro: [0, 1] } },
    pantera: { n: 'Pantera de ébano', e: '🐈‍⬛', hp: 70, dmg: 15, def: 3, mov: 5, agg: 5, max: 11, xp: 20, cit: true, fam: 'felino', ab: 'acecho', op: 1.7, ds: 'Silenciosa y letal: acecha y su primer golpe a cada objetivo hace +70% de daño.', drops: { cuero: [2, 4], hueso: [1, 2] } },
    lince: { n: 'Lince de nieve', e: '🐆', hp: 60, dmg: 12, def: 2, mov: 6, agg: 5, max: 10, xp: 16, cit: true, fam: 'felino', ab: 'salto', cross: 'Z', op: 1.3, ds: 'Saltos prodigiosos: trepa las murallas (cuesta más que por las puertas) y su primer golpe hace +30%.', drops: { cuero: [2, 3], hueso: [1, 2] } },
    sable: { n: 'Tigre dientes de sable', e: '🐅', hp: 110, dmg: 18, def: 5, mov: 4, agg: 5, max: 13, xp: 28, cit: true, fam: 'felino', ab: 'zarpazo', ps: { t: 4, pct: 0.3 }, ds: 'Colmillos largos y mordida demoledora. Zarpazo desgarrador: provoca sangrado intenso (4 turnos).', drops: { cuero: [3, 5], hueso: [2, 4] } },
    leon: { n: 'León de la sabana', e: '🦁', hp: 120, dmg: 16, def: 6, mov: 4, agg: 5, max: 13, xp: 26, cit: true, fam: 'felino', ab: 'rugido', pk: { r: 3, pct: 0.1, max: 3 }, fr: { r: 2, t: 2 }, ds: 'Cazador social: +10% de daño por cada león cercano (hasta +30%). Su rugido intimida a todos a 2 casillas (−20% de daño).', drops: { cuero: [3, 5], hueso: [2, 3] } },
    astral: { n: 'Gato astral', e: '🐱', hp: 75, dmg: 14, def: 4, mov: 5, agg: 5, max: 12, xp: 24, cit: true, fam: 'felino', ab: 'dimensional', tp: 3, soul: 0.1, ds: 'Felino místico de pelaje estrellado. Salto dimensional: cada 3 turnos se teletransporta junto a su presa.', drops: { alma: [0, 1], hueso: [1, 2] } },
    jaguar: { n: 'Jaguar de selva', e: '🐆', hp: 90, dmg: 15, def: 4, mov: 5, agg: 5, max: 12, xp: 22, cit: true, fam: 'felino', ab: 'emboscada', cross: 'Z', op: 1.5, dd: 0.15, ds: 'Nadador y trepador (trepa murallas): ataca con emboscadas rápidas (+50% el primer golpe) y esquiva el 15%.', drops: { cuero: [2, 4], hueso: [1, 3] } },
    halcon: { n: 'Halcón de guerra', e: '🦅', hp: 45, dmg: 10, def: 1, mov: 7, agg: 5, max: 9, xp: 13, cit: true, fam: 'ave', ab: 'picada', cross: 'g', pn: 1, ds: 'Veloz en picada (vuela, cruza murallas). Hostiga y ciega: la unidad golpeada hace −20% de daño 1 turno.', drops: { cuero: [1, 1], hueso: [0, 1] } },
    buho: { n: 'Búho sombrío', e: '🦉', hp: 60, dmg: 13, def: 3, mov: 5, agg: 5, max: 11, xp: 18, cit: true, fam: 'ave', ab: 'nocturna', cross: 'g', crit: { sure: 'f', dg: true, p: 0.25 }, ds: 'Vuelo silencioso (cruza murallas). Caza nocturna: crítico garantizado (×1.5) contra quien esté en bosque o mazmorra; en campo abierto, 25%.', drops: { cuero: [1, 2], hueso: [1, 2] } },
    aguila: { n: 'Águila de tormenta', e: '🦅', hp: 80, dmg: 14, def: 4, mov: 6, agg: 5, max: 12, xp: 22, cit: true, fam: 'ave', ab: 'trueno', cross: 'g', ar: { r: 2, s: 1, at: 'c' }, ds: 'Anida en cimas; vuela. Trueno en las alas: al atacar, el estruendo ralentiza 1 turno a todos a 2 casillas.', drops: { cuero: [2, 3], hueso: [1, 2] } },
    cuervo: { n: 'Cuervo carroñero', e: '🐦‍⬛', hp: 35, dmg: 8, def: 1, mov: 6, agg: 5, max: 9, xp: 10, cit: true, fam: 'ave', ab: 'bandada', cross: 'g', pk: { r: 3, pct: 0.1, max: 4 }, ds: 'Astuto y oportunista (vuela). Se reúne en bandadas: +10% de daño por cada cuervo cercano (hasta +40%).', drops: { cuero: [0, 1], hueso: [0, 1] } },
    fenix: { n: 'Fénix menor', e: '🔥', hp: 90, dmg: 14, def: 4, mov: 5, agg: 5, max: 12, xp: 28, cit: true, fam: 'ave', ab: 'resurgir', cross: 'g', bn: { t: 2, pct: 0.25 }, rv: 0.5, soul: 0.3, ds: 'Plumaje ardiente; vuela y quema 2 turnos. Resurgir de cenizas: revive una vez con la mitad de vida si no lo rematas.', drops: { alma: [1, 2], hueso: [0, 1] } },
    roc: { n: 'Roc joven', e: '🦅', hp: 200, dmg: 20, def: 6, mov: 5, agg: 5, max: 15, xp: 45, cit: true, fam: 'ave', ab: 'levanta', cross: 'g', push: 3, st: 1, ds: 'Rapaz gigantesca; vuela. Levanta a su presa y la suelta: empuja 3 casillas y la aturde.', drops: { cuero: [4, 6], hueso: [3, 5], escama: [0, 1] } },
    basilisco: { n: 'Basilisco de ciénaga', e: '🦎', hp: 110, dmg: 14, def: 8, mov: 3, agg: 5, max: 12, xp: 26, cit: true, fam: 'reptil', ab: 'mirada', au: { r: 2, s: 1 }, st: 2, ds: 'Mirada petrificante: ralentiza a quien esté a 2 casillas cada turno y endurece (ralentiza 2 turnos) a quien muerde.', drops: { hueso: [2, 3], escama: [0, 1], hierro: [0, 1] } },
    constrictora: { n: 'Serpiente constrictora', e: '🐍', hp: 85, dmg: 11, def: 4, mov: 4, agg: 4, max: 11, xp: 18, cit: true, fam: 'reptil', ab: 'constriccion', cr: { pct: 0.25, max: 4 }, st: 1, ds: 'Envuelve y asfixia: si ataca al mismo objetivo turnos seguidos, +25% de daño por turno (hasta +100%) y lo ralentiza.', drops: { cuero: [2, 3], hueso: [1, 2] } },
    camaleon: { n: 'Lagarto camaleón gigante', e: '🦎', hp: 65, dmg: 12, def: 3, mov: 4, agg: 4, max: 10, xp: 14, cit: true, fam: 'reptil', ab: 'camuflaje', dd: 0.3, ds: 'Cambia de color y pasa desapercibido: esquiva el 30% de los golpes.', drops: { cuero: [1, 3], hueso: [1, 1] } },
    sapo: { n: 'Sapo venenoso', e: '🐸', hp: 55, dmg: 9, def: 3, mov: 3, agg: 3, max: 10, xp: 12, cit: true, fam: 'reptil', ab: 'pieltoxica', ps: { t: 3, pct: 0.2 }, th: { t: 3, pct: 0.2, tm: 'Su piel tóxica te envenena.' }, ds: 'Segrega toxinas: envenena al contacto (a quien lo golpea cuerpo a cuerpo y a quien muerde).', drops: { cuero: [1, 2], hueso: [0, 1] } },
    cocodrilo: { n: 'Cocodrilo blindado', e: '🐊', hp: 130, dmg: 17, def: 12, mov: 3, agg: 4, max: 13, xp: 28, cit: true, fam: 'reptil', ab: 'giro', cr: { pct: 0.3, max: 2 }, st: 1, ds: 'Mandíbula aplastante y giro mortal: si repite sobre el mismo objetivo hace +30% (hasta +60%) y lo inmoviliza.', drops: { cuero: [3, 5], hueso: [2, 4], escama: [0, 1] } },
    triton: { n: 'Tritón de abismo', e: '🦎', hp: 55, dmg: 11, def: 3, mov: 6, agg: 5, max: 10, xp: 13, cit: true, fam: 'reptil', ab: 'escurridizo', dd: 0.2, ds: 'Anfibio rápido y escurridizo: esquiva el 20% de los golpes.', drops: { cuero: [1, 2], hueso: [0, 1] } },
    tejedora: { n: 'Araña tejedora', e: '🕷️', hp: 60, dmg: 9, def: 3, mov: 3, agg: 5, max: 10, xp: 14, cit: true, fam: 'aracnido', ab: 'red', st: 2, ar: { r: 1, s: 1, at: 't' }, ds: 'Crea redes densas: cada mordida atrapa al objetivo (ralentiza 2 turnos) y ralentiza 1 turno a los cercanos.', drops: { cuero: [1, 2], hueso: [1, 2] } },
    viuda: { n: 'Viuda de sombras', e: '🕷️', hp: 40, dmg: 10, def: 1, mov: 5, agg: 5, max: 9, xp: 15, cit: true, fam: 'aracnido', ab: 'venenoletal', ps: { t: 4, pct: 0.35 }, ds: 'Pequeña, ágil y de mordida sumamente venenosa (veneno fuerte, 4 turnos).', drops: { hueso: [0, 1], cuero: [0, 1] } },
    tarantula: { n: 'Tarántula de cueva', e: '🕷️', hp: 100, dmg: 14, def: 7, mov: 3, agg: 4, max: 11, xp: 20, cit: true, fam: 'aracnido', ab: 'embestida2', op: 1.4, ds: 'Peluda y robusta: defiende su madriguera con embestidas (+40% el primer golpe).', drops: { cuero: [2, 3], hueso: [2, 3] } },
    arcristal: { n: 'Araña de cristal', e: '🕷️', hp: 55, dmg: 12, def: 5, mov: 4, agg: 4, max: 10, xp: 16, cit: true, fam: 'aracnido', ab: 'translucida', dd: 0.25, ps: { t: 3, pct: 0.2 }, soul: 0.06, ds: 'Casi translúcida: esquiva el 25% de los golpes y su veneno cristalino dura 3 turnos.', drops: { alma: [0, 1], hierro: [0, 1] } },
    escdunas: { n: 'Escorpión de dunas', e: '🦂', hp: 80, dmg: 13, def: 8, mov: 4, agg: 4, max: 11, xp: 19, cit: true, fam: 'aracnido', ab: 'aguijonp', ps: { t: 3, pct: 0.3 }, st: 1, ds: 'Pinzas para sujetar (aturde 1 turno) y aguijón ponzoñoso de veneno rápido (3 turnos).', drops: { hueso: [1, 3], hierro: [0, 1] } },
    nieblaar: { n: 'Tejedora de niebla', e: '🕸️', hp: 55, dmg: 11, def: 3, mov: 4, agg: 5, max: 10, xp: 16, cit: true, fam: 'aracnido', ab: 'hilos', op: 1.5, st: 1, ds: 'Hilos invisibles que amortiguan sonidos: su primer golpe a cada objetivo hace +50% y lo atrapa (ralentiza 1 turno).', drops: { cuero: [1, 2], hueso: [1, 2] } },
    treant: { n: 'Treant joven', e: '🌳', hp: 170, dmg: 16, def: 10, mov: 2, agg: 4, max: 13, xp: 30, cit: true, fam: 'planta', ab: 'corteza', rd: 0.85, rg: 0.04, ds: 'Árbol caminante de corteza gruesa (recibe 85% del daño) y ramas como mazos. Regenera 4% de vida por turno.', drops: { cuero: [3, 5], hueso: [2, 4] } },
    hongo: { n: 'Hongo espora', e: '🍄', hp: 70, dmg: 8, def: 4, mov: 2, agg: 3, max: 10, xp: 14, cit: true, fam: 'planta', ab: 'esporas', sp: { r: 2, t: 3, pct: 0.25 }, ps: { t: 3, pct: 0.2 }, ds: 'Nube de esporas: al ser golpeado libera una nube que envenena y confunde (−20% de daño) a todos a 2 casillas.', drops: { cuero: [0, 1], hueso: [0, 1] } },
    plantacarn: { n: 'Planta carnívora', e: '🪴', hp: 90, dmg: 19, def: 4, mov: 3, agg: 5, max: 11, xp: 22, cit: true, fam: 'planta', ab: 'emboscada', amb: true, op: 1.8, st: 1, ds: 'Permanece inmóvil hasta que una presa se acerca a 3 casillas (si nadie llega en 20 turnos, se marchita); entonces ataca con +80% el primer golpe y atrapa.', drops: { cuero: [1, 3], hueso: [1, 2] } },
    liana: { n: 'Liana estranguladora', e: '🌿', hp: 80, dmg: 10, def: 5, mov: 3, agg: 5, max: 10, xp: 16, cit: true, fam: 'planta', ab: 'apresa', st: 3, ds: 'Raíces y tallos móviles que apresan tobillos: la unidad golpeada queda ralentizada 3 turnos.', drops: { cuero: [1, 3], hueso: [0, 1] } },
    florsolar: { n: 'Flor solar', e: '🌻', hp: 75, dmg: 10, def: 4, mov: 2, agg: 5, max: 10, xp: 16, cit: true, fam: 'planta', rng: 3, ab: 'destello', fr: { r: 3, t: 2 }, ds: 'Concentra calor y luz a 3 casillas. Destello solar: ciega (−20% de daño, 2 turnos) a todos a 3 casillas del objetivo.', drops: { cuero: [0, 1], hueso: [0, 1] } },
    musgo: { n: 'Musgo viviente', e: '🌱', hp: 120, dmg: 7, def: 6, mov: 2, agg: 4, max: 11, xp: 14, cit: true, fam: 'planta', ab: 'humedad', au: { r: 2, s: 1 }, ds: 'Tapiz orgánico que absorbe humedad: ralentiza a todos a 2 casillas en cada turno.', drops: { cuero: [1, 2], hueso: [0, 1] } },
    diablillo: { n: 'Diablillo de ceniza', e: '😈', hp: 40, dmg: 10, def: 2, mov: 6, agg: 5, max: 9, xp: 12, cit: true, fam: 'demonio', rng: 3, ab: 'brasas', bn: { t: 2, pct: 0.3 }, soul: 0.04, ds: 'Pequeño, burlón y rapidísimo: arroja brasas desde 3 casillas que queman 2 turnos.', drops: { hueso: [0, 1], hierro: [0, 1] } },
    sabinf: { n: 'Sabueso infernal', e: '🐕‍🦺', hp: 90, dmg: 15, def: 5, mov: 5, agg: 5, max: 12, xp: 24, cit: true, fam: 'demonio', ab: 'azufre', au: { r: 1, bn: 0.3 }, bn: { t: 2, pct: 0.25 }, soul: 0.06, ds: 'Pelaje negro y ojos incandescentes. Rastro de azufre: quema cada turno a todos a 1 casilla y su mordida quema 2 turnos.', drops: { hueso: [1, 3], hierro: [0, 1] } },
    cadenas: { n: 'Demonio de cadenas', e: '⛓️', hp: 120, dmg: 15, def: 8, mov: 3, agg: 5, max: 13, xp: 28, cit: true, fam: 'demonio', rng: 2, ab: 'cadenas', pull: 2, st: 2, soul: 0.08, ds: 'Envuelto en eslabones candentes que usa como látigos (2 casillas): arrastra a su presa hasta él y la ralentiza 2 turnos.', drops: { hierro: [2, 3], hueso: [1, 3] } },
    sucubo: { n: 'Súcubo sombrío', e: '💋', hp: 85, dmg: 12, def: 4, mov: 4, agg: 5, max: 12, xp: 24, cit: true, fam: 'demonio', ab: 'encanto', cf: 0.4, pn: 2, soul: 0.1, ds: 'Seductor y astuto. Encanto oscuro: 40% de confundir la voluntad del objetivo (pierde su ataque el siguiente turno) y −20% de daño.', drops: { alma: [0, 1], hueso: [1, 2] } },
    bruto: { n: 'Bruto abisal', e: '👹', hp: 190, dmg: 20, def: 9, mov: 3, agg: 5, max: 14, xp: 34, cit: true, fam: 'demonio', ab: 'embestida', op: 1.5, st: 1, ds: 'Mole musculosa con cuernos retorcidos: embiste con fuerza brutal (+50% el primer golpe a cada objetivo) y derriba.', drops: { hueso: [3, 5], hierro: [1, 3] } },
    senorbr: { n: 'Señor de las brasas', e: '🔥', hp: 220, dmg: 19, def: 11, mov: 3, agg: 6, max: 16, xp: 50, cit: true, fam: 'demonio', ab: 'sofocante', au: { r: 2, dw: 2, bn: 0.2 }, soul: 0.25, ds: 'Comandante demoníaco envuelto en humo. Aura sofocante: reduce un 25% la defensa y quema a todos a 2 casillas cada turno.', drops: { alma: [1, 2], hierro: [2, 4], acero: [1, 2] } },
    sabpes: { n: 'Sabueso de pesadilla', e: '🐺', hp: 85, dmg: 14, def: 5, mov: 5, agg: 5, max: 12, xp: 24, cit: true, fam: 'sombra', ab: 'terror', au: { r: 3, pn: 1 }, soul: 0.08, ds: 'Bestia esquelética con crin de humo. Mirada de terror: infunde miedo (−20% de daño) a todos a 3 casillas en cada turno.', drops: { hueso: [2, 4], alma: [0, 1] } },
    cuervoecl: { n: 'Cuervo de eclipse', e: '🐦‍⬛', hp: 45, dmg: 11, def: 2, mov: 6, agg: 5, max: 10, xp: 14, cit: true, fam: 'sombra', ab: 'eclipse', cross: 'g', dd: 0.25, ds: 'Plumaje negro absoluto; vuela (cruza murallas) y esquiva el 25% de los golpes.', drops: { cuero: [0, 1], hueso: [0, 1] } },
    ciervobr: { n: 'Ciervo de la bruma', e: '🦌', hp: 70, dmg: 10, def: 4, mov: 6, agg: 3, max: 10, xp: 13, cit: true, fam: 'sombra', ab: 'bruma', dd: 0.35, ds: 'Elegante y silencioso: se desvanece al acercarse una amenaza (esquiva el 35% de los golpes).', drops: { cuero: [2, 3], hueso: [1, 2] } },
    gatomed: { n: 'Gato de medianoche', e: '🐈‍⬛', hp: 70, dmg: 14, def: 3, mov: 6, agg: 5, max: 11, xp: 20, cit: true, fam: 'sombra', ab: 'saltosombra', tp: 3, op: 1.4, dd: 0.15, soul: 0.05, ds: 'Ojos amarillos brillantes. Salto de sombra: se teletransporta junto a su presa cada 3 turnos; primer golpe +40%; esquiva el 15%.', drops: { cuero: [1, 3], alma: [0, 1] } },
    torotin: { n: 'Toro de tinieblas', e: '🐂', hp: 160, dmg: 17, def: 8, mov: 3, agg: 5, max: 13, xp: 28, cit: true, fam: 'sombra', ab: 'tinieblas', op: 1.5, au: { r: 1, s: 1 }, ds: 'Astas negras y aliento frío: ralentiza a todos a 1 casilla cada turno y embiste con +50% el primer golpe.', drops: { cuero: [3, 5], hueso: [2, 4] } },
    tejsue: { n: 'Tejedora de sueños', e: '🕸️', hp: 65, dmg: 10, def: 3, mov: 4, agg: 5, max: 11, xp: 20, cit: true, fam: 'sombra', ab: 'onirico', st: 2, pn: 1, cf: 0.3, soul: 0.08, ds: 'Arácnida etérea. Hilo onírico: atrapa (ralentiza 2 turnos), fatiga (−20% de daño) y 30% de hacerle perder el ataque.', drops: { alma: [0, 1], cuero: [0, 1] } },
    ojo: { n: 'Ojo errante', e: '👁️', hp: 70, dmg: 13, def: 3, mov: 3, agg: 5, max: 11, xp: 22, cit: true, fam: 'aberracion', rng: 4, ab: 'psiquico', cross: 'g', pierce: 0.5, soul: 0.1, ds: 'Esfera flotante (cruza murallas) con un gran ojo que lanza rayos psíquicos a 4 casillas, ignorando el 50% de la defensa.', drops: { alma: [0, 1], hueso: [0, 1] } },
    devsom: { n: 'Devorador de sombras', e: '🌑', hp: 100, dmg: 13, def: 5, mov: 4, agg: 5, max: 12, xp: 22, cit: true, fam: 'aberracion', ab: 'devorar', ls: 0.5, soul: 0.1, ds: 'Silueta amorfa que se alimenta de luz y calor: se cura el 50% del daño que hace.', drops: { alma: [0, 1], hueso: [1, 2] } },
    tentabis: { n: 'Tentáculo del abismo', e: '🦑', hp: 110, dmg: 16, def: 6, mov: 2, agg: 5, max: 12, xp: 24, cit: true, fam: 'aberracion', rng: 3, ab: 'arrastre', amb: true, pull: 3, st: 2, soul: 0.1, ds: 'Brota de grietas oscuras (inmóvil hasta que algo se acerca a 3 casillas; se marchita en 20 turnos): arrastra a su presa 3 casillas y la ralentiza.', drops: { alma: [0, 1], hueso: [1, 3] } },
    mimico: { n: 'Mímico de cofres', e: '📦', hp: 100, dmg: 16, def: 8, mov: 3, agg: 5, max: 11, xp: 24, cit: true, fam: 'aberracion', ab: 'camuflaje', amb: true, op: 2.2, ds: 'Adopta la forma de objetos valiosos (inmóvil hasta que algo se acerca; se marchita en 20 turnos). Camuflaje engañoso: primer golpe +120%.', drops: { hierro: [1, 3], acero: [0, 1], alma: [0, 1] } },
    susurrador: { n: 'Susurrador del vacío', e: '👁️', hp: 60, dmg: 9, def: 3, mov: 3, agg: 5, max: 11, xp: 20, cit: true, fam: 'aberracion', rng: 3, ab: 'eco', fr: { r: 3, t: 2 }, cf: 0.4, soul: 0.15, ds: 'Murmura ideas inquietantes a 3 casillas. Eco mental: desorienta (−20% de daño a todos a 3 casillas) y 40% de hacer perder el ataque.', drops: { alma: [0, 2] } },
    espastral: { n: 'Espectro astral', e: '🌌', hp: 80, dmg: 13, def: 4, mov: 5, agg: 5, max: 12, xp: 22, cit: true, fam: 'aberracion', ab: 'cambiante', cross: 'g', tp: 4, dd: 0.3, soul: 0.15, ds: 'Forma cambiante que desafía la física: cruza murallas, se teletransporta cada 4 turnos y esquiva el 30%.', drops: { alma: [0, 1] } },
    slimev: { n: 'Slime verde común', e: '🟢', hp: 50, dmg: 7, def: 2, mov: 3, agg: 3, max: 8, xp: 8, cit: true, fam: 'slime', ds: 'Masa gelatinosa básica: rebota para atacar.', drops: { cuero: [0, 1] } },
    cubo: { n: 'Cubo gelatinoso', e: '🧊', hp: 130, dmg: 12, def: 6, mov: 2, agg: 4, max: 11, xp: 20, cit: true, fam: 'slime', ab: 'engullir', dd: 0.15, st: 2, ps: { t: 4, pct: 0.2 }, ds: 'Transparente (esquiva el 15%). Engullir: atrapa (ralentiza 2 turnos) y disuelve lentamente (veneno ácido 4 turnos).', drops: { hierro: [0, 2], hueso: [0, 1] } },
    slimeac: { n: 'Slime ácido', e: '🟡', hp: 80, dmg: 9, def: 4, mov: 3, agg: 4, max: 10, xp: 14, cit: true, fam: 'slime', ab: 'corroe', dwh: 3, ps: { t: 2, pct: 0.15 }, ds: 'Burbujeante y corrosivo: cada golpe reduce un 25% la defensa de la unidad 3 turnos.', drops: { hierro: [0, 1], cuero: [0, 1] } },
    baba: { n: 'Baba dividida', e: '🟣', hp: 95, dmg: 10, def: 3, mov: 3, agg: 4, max: 10, xp: 14, cit: true, fam: 'slime', ab: 'mitosis', mt: true, ds: 'Masa inestable: al recibir un golpe fuerte (18% de su vida o más) se divide en dos más pequeñas (hasta 2 veces).', drops: { cuero: [0, 1], hueso: [0, 1] } },
    slimemag: { n: 'Slime de magma', e: '🔴', hp: 110, dmg: 13, def: 7, mov: 2, agg: 4, max: 11, xp: 20, cit: true, fam: 'slime', ab: 'magma', au: { r: 1, bn: 0.25 }, bn: { t: 2, pct: 0.25 }, ds: 'Núcleo de roca fundida: quema el suelo (a todos a 1 casilla cada turno) y su golpe quema 2 turnos.', drops: { hierro: [1, 2], hueso: [0, 1] } },
    lodo: { n: 'Amalgama de lodo', e: '🟤', hp: 130, dmg: 12, def: 5, mov: 3, agg: 4, max: 12, xp: 18, cit: true, fam: 'slime', rng: 2, ab: 'brazos', rd: 0.9, rg: 0.03, st: 1, ds: 'Criatura de pantano que adopta brazos o tentáculos (ataca a 2 casillas): recibe 90% del daño, regenera 3% por turno y ralentiza.', drops: { cuero: [1, 2], hueso: [1, 2] } },
  };

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  /**
   * Dijkstra limitado por puntos de movimiento.
   * env: { w, h, terr(x,y)->char, occ(x,y)->0 libre|1 aliado (se puede cruzar)|2 bloqueado, stop(x,y)->bool }
   * Devuelve Map(key=y*w+x -> {c: costo, p: previo, end: se puede terminar ahí})
   */
  const ROAD_COST = 0.5;
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
        const tcc = env.road && env.road(nx, ny) ? Math.min(tc.c, ROAD_COST) : tc.c;
        const o = env.occ(nx, ny);
        if (o === 2) continue;
        const nc = c + tcc;
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
    CIT, DEFS, GAR, LETGO, WALL, SKILLS, SKILL_ORDER, MATS, MAT_ORDER, TIER_NAMES, WM, AM, KINDS, WEAPON_KINDS, GEAR_KINDS, SLOTS, SLOT_NAMES, PACK,
    recipe, scrapRefund, itemValue, MAX_TIER, ENCHANT_STEPS, MAX_FX, REFORGE_COST, SET_BONUS, armorSet, itemName, tierName, RARITY, AFFIX, WEAPON_FX, ARMOR_FX, affixText, upgradeCost, ENCHANT_COST,
    ptSeed, sexSeed, sexOf, DESIGN, cleanDesign, BAR, NPC, ARENA, WORLD, WAVES, LAB, SIEGE, CART, HERO, KING, BOSS_IDS, DUNGEON, TEAM_E, STORY, CONVERT, VAMP, SUMMON, WORLD_OPTS, PRESETS, VICTORY, GEMS, GEM_IDS, GEM_LV, gemOf, gemFx, gemText, SOCKETS_BY_R, MAX_SOCKETS, SOCKET_STEPS, GEM_UP, CLASS_LV, SUB_LV, CLASSES, classMods, BUILDER, ROAD_COST, MAT_VAL, itemVal, INCOME, BUILDINGS, bMax, CHURCH, ANGEL, CITY_GUARD, BUILD_ORDER, BUILD_MAX, ORDERS,
    SEASON_LEN, SEASONS, seasonIdx, DN, isNight, nightLeft, dayLeft, torchR, WEATHER, WEATHER_ORDER, TOURN, MERCH, ELITE_NAMES, SITES, PERS, BOT_LEVELS, PACTS, TERR, CREATURES, DIRS, cheb, reach,
  };
});
