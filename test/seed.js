'use strict';
// Hace las pruebas reproducibles: Math.random pasa a ser un generador con semilla fija (ADA_SEED, por defecto 12345).
// Con ADA_RANDOM=1 se vuelve al azar real (útil para cazar fallos raros: ADA_SEED=7 node test/features4.js).
if (!process.env.ADA_RANDOM) {
  let a = (+process.env.ADA_SEED || 12345) | 0;
  Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
