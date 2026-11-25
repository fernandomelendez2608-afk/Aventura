/* Motor de dominó doble-seis, 4 jugadores en parejas (asientos 0 y 2 contra 1 y 3), 7 fichas cada uno, sin pozo.
   Sirve en el navegador (window.Domino) y en Node para las pruebas. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Domino = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var TARGET = 100;

  function deck() {
    var d = [];
    for (var a = 0; a <= 6; a++) for (var b = a; b <= 6; b++) d.push([a, b]);
    return d;
  }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor((rnd || Math.random)() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pips(t) { return t[0] + t[1]; }
  function sum(hand) { return hand.reduce(function (s, t) { return s + pips(t); }, 0); }

  /* starter: asiento que abre. null = el que tenga el 6-6 (primera mano). */
  function newRound(starter, rnd) {
    var d = shuffle(deck(), rnd), hands = [0, 1, 2, 3].map(function (i) { return d.slice(i * 7, i * 7 + 7); });
    var first = null;
    if (starter === null || starter === undefined) {
      for (var s = 0; s < 4; s++) hands[s].forEach(function (t) { if (t[0] === 6 && t[1] === 6) first = s; });
    } else first = starter;
    return { hands: hands, chain: [], turn: first, starter: first, mustDouble6: starter === null || starter === undefined,
             passes: 0, over: false, winner: -1, reason: "", points: 0, log: [] };
  }

  function ends(chain) { return chain.length ? [chain[0][0], chain[chain.length - 1][1]] : null; }

  /* jugadas legales del asiento: [{i, side:'S'|'L'|'R'}] */
  function legal(state, seat) {
    var hand = state.hands[seat], out = [], e = ends(state.chain);
    for (var i = 0; i < hand.length; i++) {
      var t = hand[i];
      if (!e) {
        if (state.mustDouble6 && !(t[0] === 6 && t[1] === 6)) continue;
        out.push({ i: i, side: "S" });
      } else {
        if (t[0] === e[0] || t[1] === e[0]) out.push({ i: i, side: "L" });
        if (t[0] === e[1] || t[1] === e[1]) out.push({ i: i, side: "R" });
      }
    }
    return out;
  }

  function copy(s) {
    return { hands: s.hands.map(function (h) { return h.slice(); }), chain: s.chain.slice(), turn: s.turn,
             starter: s.starter, mustDouble6: s.mustDouble6, passes: s.passes, over: s.over, winner: s.winner,
             reason: s.reason, points: s.points, log: s.log.slice() };
  }

  function finish(s, winner, reason) {
    s.over = true; s.winner = winner; s.reason = reason;
    s.points = s.hands.reduce(function (n, h) { return n + sum(h); }, 0);
  }

  function play(state, seat, i, side) {
    var s = copy(state);
    if (s.over || s.turn !== seat) throw new Error("no es su turno");
    var ok = legal(s, seat).some(function (m) { return m.i === i && m.side === side; });
    if (!ok) throw new Error("jugada ilegal");
    var t = s.hands[seat].splice(i, 1)[0], e = ends(s.chain);
    if (side === "S") s.chain.push([t[0], t[1]]);
    else if (side === "L") s.chain.unshift(t[1] === e[0] ? [t[0], t[1]] : [t[1], t[0]]);
    else s.chain.push(t[0] === e[1] ? [t[0], t[1]] : [t[1], t[0]]);
    s.mustDouble6 = false; s.passes = 0;
    s.log.push({ seat: seat, tile: t, side: side });
    if (!s.hands[seat].length) finish(s, seat, "domino");
    else s.turn = (seat + 1) % 4;
    return s;
  }

  function pass(state, seat) {
    var s = copy(state);
    if (s.over || s.turn !== seat || legal(s, seat).length) throw new Error("no puede pasar");
    s.passes++; s.log.push({ seat: seat, pass: true });
    if (s.passes >= 4) {
      var sums = s.hands.map(sum), min = Math.min.apply(null, sums);
      var low = [0, 1, 2, 3].filter(function (k) { return sums[k] === min; });
      var teams = {}; low.forEach(function (k) { teams[k % 2] = true; });
      if (Object.keys(teams).length > 1) { finish(s, -1, "tranca-empate"); s.points = 0; }
      else finish(s, low[0], "tranca");
    } else s.turn = (seat + 1) % 4;
    return s;
  }

  /* IA: prefiere dobles y fichas pesadas, y conservar números que le sirven */
  function bot(state, seat, rnd) {
    var moves = legal(state, seat);
    if (!moves.length) return null;
    var hand = state.hands[seat], best = null, bestV = -1e9;
    moves.forEach(function (m) {
      var t = hand[m.i], v = pips(t) + (t[0] === t[1] ? 6 : 0) + (rnd || Math.random)() * 2;
      var newEnd;
      if (m.side === "S") newEnd = t[0];
      else {
        var e = ends(state.chain);
        if (m.side === "L") newEnd = t[1] === e[0] ? t[0] : t[1];
        else newEnd = t[0] === e[1] ? t[1] : t[0];
      }
      hand.forEach(function (o, k) { if (k !== m.i && (o[0] === newEnd || o[1] === newEnd)) v += 3; });
      if (v > bestV) { bestV = v; best = m; }
    });
    return best;
  }

  return { TARGET: TARGET, deck: deck, shuffle: shuffle, newRound: newRound, legal: legal, play: play,
           pass: pass, bot: bot, ends: ends, sum: sum, pips: pips };
});
