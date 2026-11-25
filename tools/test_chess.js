// Pruebas del motor de ajedrez. Uso: node tools/test_chess.js
const C = require("../static/chess.js");
let fails = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? "ok   " : "FALLA") + " " + name + (ok ? "" : `  obtuvo ${JSON.stringify(got)}, esperaba ${JSON.stringify(want)}`));
}

// perft: números de referencia publicados (chessprogramming.org) para validar todas las reglas
const PERFT = [
  ["inicial", C.START, [20, 400, 8902, 197281]],
  ["kiwipete (enroques, clavadas)", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
  ["pos.3 (al paso)", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
  ["pos.4 (promociones)", "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
  ["pos.5", "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379]],
  ["pos.6", "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10", [46, 2079, 89890]],
];
for (const [name, fen, want] of PERFT) {
  const s = C.fromFEN(fen);
  eq("perft " + name, want.map((_, i) => C.perft(s, i + 1)), want);
}

// FEN ida y vuelta
eq("FEN ida y vuelta", C.toFEN(C.fromFEN(C.START)), C.START);

// estados de la partida
const st = (fen) => C.status(C.fromFEN(fen));
eq("mate del loco", st("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3").result, "mate");
eq("mate: ganan las negras", st("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3").winner, -1);
eq("rey ahogado", st("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").result, "stalemate");
eq("material insuficiente (R vs R)", st("8/8/4k3/8/8/3K4/8/8 w - - 0 1").result, "insufficient");
eq("material insuficiente (R+A vs R)", st("8/8/4k3/8/8/3KB3/8/8 w - - 0 1").result, "insufficient");
eq("R+T vs R sigue", st("8/8/4k3/8/8/3KR3/8/8 w - - 0 1").over, false);
eq("regla de 50 movimientos", st("4k3/8/8/8/8/8/4P3/4K3 w - - 100 80").result, "fifty");
eq("jaque", st("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1").check, true);

// notación (en español)
function play(fen, sans) {
  let s = C.fromFEN(fen), out = [];
  for (const wanted of sans) {
    const ms = C.legalMoves(s);
    const m = ms.find((x) => C.san(s, x, "en") === wanted);
    if (!m) { out.push("ILEGAL:" + wanted); break; }
    out.push(C.san(s, m, "es"));
    s = C.make(s, m);
  }
  return { out, s };
}
eq("notación en español", play(C.START, ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "O-O"]).out.slice(0, 7),
  ["e4", "e5", "Cf3", "Cc6", "Ab5", "a6", "O-O"]);
eq("enroque corto", play(C.START, ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"]).out.pop(), "O-O");
eq("captura al paso", play(C.START, ["e4", "a6", "e5", "d5", "exd6"]).out.pop(), "exd6");
eq("mate del pastor (#)", play(C.START, ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]).out.pop(), "Dxf7#");
eq("desambiguación de torres", play("4k3/8/8/8/8/8/8/R4RK1 w - - 0 1", ["Rad1"]).out, ["Tad1"]);
eq("promoción con captura", play("1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1", ["axb8=Q+"]).out, ["axb8=D+"]);

// IA
const t0 = Date.now();
let r = C.bestMove(C.fromFEN("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1"), 2);
eq("IA encuentra mate en 1 (Ta8#)", C.san(C.fromFEN("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1"), r.move, "es"), "Ta8#");
const hang = C.fromFEN("rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"); // la dama negra ataca g4/f2
r = C.bestMove(hang, 3);
eq("IA (difícil) devuelve jugada legal", C.legalMoves(hang).some((m) => m.f === r.move.f && m.t === r.move.t), true);
const mid = C.fromFEN("r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R w KQ - 0 8");
for (const lvl of [1, 2, 3]) {
  const t = Date.now();
  const x = C.bestMove(mid, lvl);
  const ms = Date.now() - t;
  eq(`IA nivel ${lvl} tarda < 2,3 s en medio juego (${ms} ms, prof. ${x.depth})`, ms < 2300, true);
}

// partida completa IA vs IA (nivel 1 y 2) sin errores ni jugadas ilegales
let s = C.fromFEN(C.START), plies = 0, bad = null;
while (plies < 160) {
  const stt = C.status(s);
  if (stt.over) break;
  const x = C.bestMove(s, plies % 2 ? 1 : 2);
  if (!C.legalMoves(s).some((m) => m.f === x.move.f && m.t === x.move.t && m.p === x.move.p)) { bad = plies; break; }
  s = C.make(s, x.move); plies++;
}
eq("partida IA vs IA sin jugadas ilegales (" + plies + " jugadas)", bad, null);

console.log(fails ? `\n${fails} FALLAS` : "\nTodo bien");
process.exit(fails ? 1 : 0);
