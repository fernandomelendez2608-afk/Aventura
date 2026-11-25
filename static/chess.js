/* Motor de ajedrez: reglas completas (enroque, al paso, promoción, jaque mate, tablas) y una IA sencilla.
   Sin dependencias. Sirve en el navegador (window.Chess) y en Node (require) para las pruebas. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Chess = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  var WK = 1, WQ = 2, BK = 4, BQ = 8;
  var DP = 1, EP = 2, CK = 3, CQ = 4; // banderas de jugada
  var START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  var KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  var KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var DG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  var ST = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var FILES = "abcdefgh";

  // casilla 0 = a8, 63 = h1. Piezas: 1..6 blancas, -1..-6 negras.
  function sqName(sq) { return FILES[sq & 7] + (8 - (sq >> 3)); }
  function sqFrom(name) { return (8 - Number(name[1])) * 8 + FILES.indexOf(name[0]); }

  function fromFEN(fen) {
    var parts = fen.trim().split(/\s+/), rows = parts[0].split("/"), b = new Int8Array(64);
    var map = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
    for (var r = 0; r < 8; r++) {
      var f = 0;
      for (var i = 0; i < rows[r].length; i++) {
        var ch = rows[r][i];
        if (ch >= "1" && ch <= "8") f += Number(ch);
        else { var lo = ch.toLowerCase(); b[r * 8 + f] = ch === lo ? -map[lo] : map[lo]; f++; }
      }
    }
    var cs = parts[2] || "-", c = 0;
    if (cs.indexOf("K") >= 0) c |= WK;
    if (cs.indexOf("Q") >= 0) c |= WQ;
    if (cs.indexOf("k") >= 0) c |= BK;
    if (cs.indexOf("q") >= 0) c |= BQ;
    return {
      board: b, turn: parts[1] === "b" ? -1 : 1, castle: c,
      ep: parts[3] && parts[3] !== "-" ? sqFrom(parts[3]) : -1,
      half: Number(parts[4] || 0), full: Number(parts[5] || 1)
    };
  }

  function toFEN(s) {
    var letters = " pnbrqk", out = [];
    for (var r = 0; r < 8; r++) {
      var row = "", empty = 0;
      for (var f = 0; f < 8; f++) {
        var p = s.board[r * 8 + f];
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        var ch = letters[Math.abs(p)];
        row += p > 0 ? ch.toUpperCase() : ch;
      }
      if (empty) row += empty;
      out.push(row);
    }
    var cs = (s.castle & WK ? "K" : "") + (s.castle & WQ ? "Q" : "") + (s.castle & BK ? "k" : "") + (s.castle & BQ ? "q" : "");
    return out.join("/") + " " + (s.turn === 1 ? "w" : "b") + " " + (cs || "-") + " " +
      (s.ep >= 0 ? sqName(s.ep) : "-") + " " + s.half + " " + s.full;
  }

  function attacked(b, sq, by) {
    var r = sq >> 3, f = sq & 7, i, rr, ff, p;
    var pr = r + (by === 1 ? 1 : -1);
    if (pr >= 0 && pr < 8) {
      if (f > 0 && b[pr * 8 + f - 1] === by * P) return true;
      if (f < 7 && b[pr * 8 + f + 1] === by * P) return true;
    }
    for (i = 0; i < 8; i++) {
      rr = r + KN[i][0]; ff = f + KN[i][1];
      if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && b[rr * 8 + ff] === by * N) return true;
      rr = r + KG[i][0]; ff = f + KG[i][1];
      if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && b[rr * 8 + ff] === by * K) return true;
    }
    for (i = 0; i < 4; i++) {
      rr = r + DG[i][0]; ff = f + DG[i][1];
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        p = b[rr * 8 + ff];
        if (p) { if (p === by * B || p === by * Q) return true; break; }
        rr += DG[i][0]; ff += DG[i][1];
      }
      rr = r + ST[i][0]; ff = f + ST[i][1];
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        p = b[rr * 8 + ff];
        if (p) { if (p === by * R || p === by * Q) return true; break; }
        rr += ST[i][0]; ff += ST[i][1];
      }
    }
    return false;
  }

  function mv(f, t, p, c, e) { return { f: f, t: t, p: p, c: c, e: e }; }

  function pseudo(s) {
    var b = s.board, t = s.turn, out = [], sq, p, ty, r, f, i, rr, ff, to, q, d, pt;
    var PROMOS = [Q, R, B, N];
    for (sq = 0; sq < 64; sq++) {
      p = b[sq];
      if (!p || (p > 0) !== (t > 0)) continue;
      ty = p * t; r = sq >> 3; f = sq & 7;
      if (ty === P) {
        var dr = -t, startR = t === 1 ? 6 : 1, lastR = t === 1 ? 0 : 7;
        rr = r + dr;
        if (rr < 0 || rr > 7) continue;
        to = rr * 8 + f;
        if (!b[to]) {
          if (rr === lastR) { for (pt = 0; pt < 4; pt++) out.push(mv(sq, to, PROMOS[pt], 0, 0)); }
          else {
            out.push(mv(sq, to, 0, 0, 0));
            if (r === startR && !b[(r + 2 * dr) * 8 + f]) out.push(mv(sq, (r + 2 * dr) * 8 + f, 0, 0, DP));
          }
        }
        for (d = -1; d <= 1; d += 2) {
          ff = f + d;
          if (ff < 0 || ff > 7) continue;
          to = rr * 8 + ff; q = b[to];
          if (q && (q > 0) !== (t > 0)) {
            if (rr === lastR) { for (pt = 0; pt < 4; pt++) out.push(mv(sq, to, PROMOS[pt], q, 0)); }
            else out.push(mv(sq, to, 0, q, 0));
          } else if (!q && to === s.ep) {
            out.push(mv(sq, to, 0, -t * P, EP));
          }
        }
      } else if (ty === N || ty === K) {
        var offs = ty === N ? KN : KG;
        for (i = 0; i < 8; i++) {
          rr = r + offs[i][0]; ff = f + offs[i][1];
          if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
          to = rr * 8 + ff; q = b[to];
          if (!q || (q > 0) !== (t > 0)) out.push(mv(sq, to, 0, q, 0));
        }
        if (ty === K && sq === (t === 1 ? 60 : 4) && !attacked(b, sq, -t)) {
          if ((s.castle & (t === 1 ? WK : BK)) && !b[sq + 1] && !b[sq + 2] && b[sq + 3] === t * R &&
              !attacked(b, sq + 1, -t) && !attacked(b, sq + 2, -t)) out.push(mv(sq, sq + 2, 0, 0, CK));
          if ((s.castle & (t === 1 ? WQ : BQ)) && !b[sq - 1] && !b[sq - 2] && !b[sq - 3] && b[sq - 4] === t * R &&
              !attacked(b, sq - 1, -t) && !attacked(b, sq - 2, -t)) out.push(mv(sq, sq - 2, 0, 0, CQ));
        }
      } else {
        var dirs = ty === B ? DG : ty === R ? ST : DG.concat(ST);
        for (i = 0; i < dirs.length; i++) {
          rr = r + dirs[i][0]; ff = f + dirs[i][1];
          while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
            to = rr * 8 + ff; q = b[to];
            if (!q) out.push(mv(sq, to, 0, 0, 0));
            else { if ((q > 0) !== (t > 0)) out.push(mv(sq, to, 0, q, 0)); break; }
            rr += dirs[i][0]; ff += dirs[i][1];
          }
        }
      }
    }
    return out;
  }

  function make(s, m) {
    var b = new Int8Array(s.board), t = s.turn, p = b[m.f], ty = p * t;
    b[m.f] = 0;
    b[m.t] = m.p ? t * m.p : p;
    if (m.e === EP) b[m.t + (t === 1 ? 8 : -8)] = 0;
    else if (m.e === CK) { if (t === 1) { b[63] = 0; b[61] = R; } else { b[7] = 0; b[5] = -R; } }
    else if (m.e === CQ) { if (t === 1) { b[56] = 0; b[59] = R; } else { b[0] = 0; b[3] = -R; } }
    var c = s.castle;
    if (ty === K) c &= t === 1 ? ~(WK | WQ) : ~(BK | BQ);
    if (m.f === 63 || m.t === 63) c &= ~WK;
    if (m.f === 56 || m.t === 56) c &= ~WQ;
    if (m.f === 7 || m.t === 7) c &= ~BK;
    if (m.f === 0 || m.t === 0) c &= ~BQ;
    return {
      board: b, turn: -t, castle: c, ep: m.e === DP ? (m.f + m.t) >> 1 : -1,
      half: (ty === P || m.c) ? 0 : s.half + 1, full: s.full + (t === -1 ? 1 : 0)
    };
  }

  function findKing(b, color) {
    for (var i = 0; i < 64; i++) if (b[i] === color * K) return i;
    return -1;
  }

  function inCheck(s) {
    var k = findKing(s.board, s.turn);
    return k >= 0 && attacked(s.board, k, -s.turn);
  }

  function legal(s) {
    var ps = pseudo(s), out = [], t = s.turn;
    for (var i = 0; i < ps.length; i++) {
      var s2 = make(s, ps[i]);
      var k = findKing(s2.board, t);
      if (k < 0 || !attacked(s2.board, k, -t)) out.push(ps[i]);
    }
    return out;
  }

  function perft(s, d) {
    if (d === 0) return 1;
    var ms = legal(s);
    if (d === 1) return ms.length;
    var n = 0;
    for (var i = 0; i < ms.length; i++) n += perft(make(s, ms[i]), d - 1);
    return n;
  }

  function insufficient(b) {
    var minors = 0, bishopColors = {}, knights = 0;
    for (var i = 0; i < 64; i++) {
      var ty = Math.abs(b[i]);
      if (ty === P || ty === R || ty === Q) return false;
      if (ty === N) { minors++; knights++; }
      if (ty === B) { minors++; bishopColors[((i >> 3) + (i & 7)) & 1] = true; }
    }
    if (minors <= 1) return true;
    return knights === 0 && Object.keys(bishopColors).length === 1;
  }

  function epCapturable(s) {
    if (s.ep < 0) return false;
    var r = s.ep >> 3, f = s.ep & 7, pr = r + (s.turn === 1 ? 1 : -1), b = s.board;
    return (f > 0 && b[pr * 8 + f - 1] === s.turn * P) || (f < 7 && b[pr * 8 + f + 1] === s.turn * P);
  }

  function positionKey(s) {
    var parts = toFEN(s).split(" ");
    return parts[0] + " " + parts[1] + " " + parts[2] + " " + (epCapturable(s) ? parts[3] : "-");
  }

  // estado: { over, result: 'mate'|'stalemate'|'insufficient'|'fifty'|null, winner: 1|-1|0, check }
  function status(s) {
    var ms = legal(s), chk = inCheck(s);
    if (!ms.length) return chk ? { over: true, result: "mate", winner: -s.turn, check: true }
                               : { over: true, result: "stalemate", winner: 0, check: false };
    if (insufficient(s.board)) return { over: true, result: "insufficient", winner: 0, check: chk };
    if (s.half >= 100) return { over: true, result: "fifty", winner: 0, check: chk };
    return { over: false, result: null, winner: 0, check: chk };
  }

  var LETTERS = {
    en: { 2: "N", 3: "B", 4: "R", 5: "Q", 6: "K" },
    es: { 2: "C", 3: "A", 4: "T", 5: "D", 6: "R" }
  };

  function san(s, m, lang) {
    var L = LETTERS[lang || "en"], b = s.board, ty = Math.abs(b[m.f]), str = "";
    if (m.e === CK) str = "O-O";
    else if (m.e === CQ) str = "O-O-O";
    else {
      var cap = !!m.c || m.e === EP;
      if (ty === P) { if (cap) str += FILES[m.f & 7]; }
      else {
        str += L[ty];
        var others = legal(s).filter(function (o) { return o.t === m.t && o.f !== m.f && Math.abs(b[o.f]) === ty; });
        if (others.length) {
          var sameFile = others.some(function (o) { return (o.f & 7) === (m.f & 7); });
          var sameRank = others.some(function (o) { return (o.f >> 3) === (m.f >> 3); });
          if (!sameFile) str += FILES[m.f & 7];
          else if (!sameRank) str += (8 - (m.f >> 3));
          else str += FILES[m.f & 7] + (8 - (m.f >> 3));
        }
      }
      if (cap) str += "x";
      str += sqName(m.t);
      if (m.p) str += "=" + L[m.p];
    }
    var s2 = make(s, m);
    if (inCheck(s2)) str += legal(s2).length ? "+" : "#";
    return str;
  }

  // ------------------------------------------------------------------ IA
  var VAL = [0, 100, 320, 330, 500, 900, 0];
  var PST = [null,
    [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  ];
  var MATE = 100000, INF = 1000000;

  function evaluate(s) {
    var b = s.board, sc = 0;
    for (var i = 0; i < 64; i++) {
      var p = b[i];
      if (!p) continue;
      var ty = p > 0 ? p : -p;
      if (p > 0) sc += VAL[ty] + PST[ty][i]; else sc -= VAL[ty] + PST[ty][i ^ 56];
    }
    return s.turn === 1 ? sc : -sc;
  }

  function order(ms, b) {
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], sc = 0;
      if (m.c) sc += 10 * VAL[Math.abs(m.c)] - VAL[Math.abs(b[m.f])] / 10 + 1000;
      if (m.p) sc += VAL[m.p] + 500;
      m.o = sc;
    }
    ms.sort(function (a, c) { return c.o - a.o; });
  }

  function quiesce(s, alpha, beta, ctx, qd) {
    var stand = evaluate(s);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd >= 4) return stand;
    var ms = legal(s).filter(function (m) { return m.c || m.p; });
    order(ms, s.board);
    for (var i = 0; i < ms.length; i++) {
      if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.stop = true;
      if (ctx.stop) return 0;
      var v = -quiesce(make(s, ms[i]), -beta, -alpha, ctx, qd + 1);
      if (ctx.stop) return 0;
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function negamax(s, depth, alpha, beta, ply, ctx) {
    if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.stop = true;
    if (ctx.stop) return 0;
    if (depth <= 0) return quiesce(s, alpha, beta, ctx, 0);
    var ms = legal(s);
    if (!ms.length) return inCheck(s) ? -MATE + ply : 0;
    if (s.half >= 100 || insufficient(s.board)) return 0;
    order(ms, s.board);
    var best = -INF;
    for (var i = 0; i < ms.length; i++) {
      var v = -negamax(make(s, ms[i]), depth - 1, -beta, -alpha, ply + 1, ctx);
      if (ctx.stop) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  /* nivel 1 = fácil, 2 = medio, 3 = difícil */
  function bestMove(s, level) {
    var ms = legal(s);
    if (!ms.length) return null;
    level = level || 2;
    if (level === 1 && Math.random() < 0.3) return { move: ms[Math.floor(Math.random() * ms.length)], score: 0, depth: 0 };
    var maxDepth = level === 1 ? 1 : level === 2 ? 2 : 4;
    var ctx = { nodes: 0, stop: false, deadline: Date.now() + (level === 3 ? 1500 : 700) };
    var scored = null, doneDepth = 0;
    var margin = level === 1 ? 60 : level === 2 ? 8 : 0;
    order(ms, s.board);
    for (var d = 1; d <= maxDepth; d++) {
      var cur = [], alpha = -INF;
      for (var i = 0; i < ms.length; i++) {
        var lo = Math.max(alpha - margin - 1, -INF); // ventana ampliada: lo que supere lo+1 es valor exacto
        var v = -negamax(make(s, ms[i]), d - 1, -INF, -lo, 1, ctx);
        if (ctx.stop) break;
        cur.push({ m: ms[i], v: v });
        if (v > alpha) alpha = v;
      }
      if (ctx.stop) break;
      scored = cur; doneDepth = d;
      cur.sort(function (a, b) { return b.v - a.v; });
      ms = cur.map(function (x) { return x.m; });
      if (cur[0].v > MATE - 50) break; // mate encontrado
    }
    if (!scored) scored = [{ m: ms[0], v: 0 }];
    scored.sort(function (a, b) { return b.v - a.v; });
    var top = scored[0].v;
    var pool = scored.filter(function (x) { return x.v >= top - margin; });
    var pick = pool[Math.floor(Math.random() * pool.length)];
    return { move: pick.m, score: pick.v, depth: doneDepth };
  }

  return {
    START: START, P: P, N: N, B: B, R: R, Q: Q, K: K,
    fromFEN: fromFEN, toFEN: toFEN, legalMoves: legal, make: make, inCheck: inCheck, status: status,
    san: san, perft: perft, bestMove: bestMove, sqName: sqName, sqFrom: sqFrom, positionKey: positionKey
  };
});
