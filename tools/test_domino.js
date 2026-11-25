// Pruebas del dominó. Uso: node tools/test_domino.js
const D = require("../static/domino.js");
let fails = 0;
const eq = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); if (!ok) fails++; console.log((ok ? "ok   " : "FALLA") + " " + n + (ok ? "" : `  obtuvo ${JSON.stringify(g)}, esperaba ${JSON.stringify(w)}`)); };

eq("28 fichas distintas", new Set(D.deck().map(String)).size, 28);
eq("suma de puntos total = 168", D.deck().reduce((s, t) => s + D.pips(t), 0), 168);

// reparto: 4 manos de 7 sin repetir; abre quien tiene el 6-6
let r = D.newRound(null);
eq("reparto 4x7", r.hands.map(h => h.length), [7, 7, 7, 7]);
eq("todas distintas", new Set(r.hands.flat().map(String)).size, 28);
eq("abre quien tiene 6-6", r.hands[r.turn].some(t => t[0] === 6 && t[1] === 6), true);
eq("primera jugada: solo el 6-6", D.legal(r, r.turn).length, 1);
let r2 = D.newRound(2);
eq("mano siguiente: abre el ganador con cualquier ficha", [r2.turn, D.legal(r2, 2).length], [2, 7]);

// colocación y orientación de la cadena
let s = { hands: [[[6, 6], [6, 2], [3, 4]], [[2, 5]], [[5, 1]], [[1, 0]]], chain: [], turn: 0, starter: 0, mustDouble6: true, passes: 0, over: false, winner: -1, reason: "", points: 0, log: [] };
s = D.play(s, 0, 0, "S"); eq("sale el 6-6", s.chain, [[6, 6]]);
eq("siguiente asiento", s.turn, 1);
let bad = false; try { D.play(s, 1, 0, "L"); } catch (e) { bad = true; } eq("2-5 no cabe en 6", bad, true);
eq("el asiento 1 debe pasar", [D.legal(s, 1).length], [0]);
s = D.pass(s, 1); eq("pasa", [s.turn, s.passes], [2, 1]);
s = D.pass(s, 2); s = D.pass(s, 3);
s = D.play(s, 0, 0, "R"); // 6-2 a la derecha
eq("6-2 a la derecha orientado 6|2", s.chain, [[6, 6], [6, 2]]);
eq("extremos", D.ends(s.chain), [6, 2]);
s = D.play(s, 1, 0, "R"); eq("2-5 a la derecha", s.chain[2], [2, 5]);

// dominó: gana quien se queda sin fichas y suma todos los puntos
let w = { hands: [[[6, 6]], [[1, 2], [3, 3]], [[0, 1]], [[4, 5]]], chain: [[6, 1]], turn: 0, starter: 0, mustDouble6: false, passes: 0, over: false, winner: -1, reason: "", points: 0, log: [] };
w = D.play(w, 0, 0, "L"); eq("domino", [w.over, w.winner, w.reason, w.points], [true, 0, "domino", 3 + 6 + 1 + 9]);

// tranca: la pareja con la mano más baja se lleva todo
let t = { hands: [[[1, 1]], [[5, 5]], [[0, 2]], [[6, 5]]], chain: [[3, 4], [4, 3]], turn: 0, starter: 0, mustDouble6: false, passes: 0, over: false, winner: -1, reason: "", points: 0, log: [] };
for (let k = 0; k < 4; k++) t = D.pass(t, t.turn);
eq("tranca: gana la pareja 0-2 con la mano más baja", [t.over, t.reason, t.winner, t.points], [true, "tranca", 0, 2 + 10 + 2 + 11]);
let t2 = { ...t, over: false, passes: 0, turn: 0, hands: [[[1, 1]], [[1, 1]], [[6, 6]], [[6, 5]]], reason: "", winner: -1 };
for (let k = 0; k < 4; k++) t2 = D.pass(t2, t2.turn);
eq("tranca empatada entre parejas: 0 puntos", [t2.reason, t2.points], ["tranca-empate", 0]);

// partidas completas con IA: nunca ilegal, siempre termina, fichas conservadas
let rounds = 0, domino = 0, tranca = 0, steps = 0;
for (let g = 0; g < 400; g++) {
  let st = D.newRound(g % 3 ? g % 4 : null);
  while (!st.over) {
    const m = D.bot(st, st.turn);
    st = m ? D.play(st, st.turn, m.i, m.side) : D.pass(st, st.turn);
    if (++steps > 1e6) throw new Error("bucle");
    const total = st.chain.length + st.hands.reduce((n, h) => n + h.length, 0);
    if (total !== 28) { fails++; console.log("FALLA fichas perdidas"); break; }
    const c = st.chain; for (let i = 0; i + 1 < c.length; i++) if (c[i][1] !== c[i + 1][0]) { fails++; console.log("FALLA cadena rota"); i = 99; }
  }
  rounds++; st.reason === "domino" ? domino++ : tranca++;
}
eq("400 manos con IA terminadas (" + domino + " dominó, " + tranca + " tranca)", rounds, 400);
console.log(fails ? `\n${fails} FALLAS` : "\nTodo bien");
process.exit(fails ? 1 : 0);
