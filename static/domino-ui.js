(function () {
  "use strict";
  var D = window.Domino, tableEl = document.getElementById("table");
  if (!D || !tableEl) return;
  var $ = function (id) { return document.getElementById(id); };
  var NAMES = ["Tú", "Rival de la derecha", "Tu compañero", "Rival de la izquierda"];
  var round, scores, roundNo, msg, timer, gameOver, pendingTile;

  var V = window.DominoView, tile = V.tile, back = V.back;

  function label(t) { return t[0] + "|" + t[1]; }

  function newRound(starter) {
    clearTimeout(timer); pendingTile = -1;
    round = D.newRound(starter);
    round.hands[0].sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    msg = round.turn === 0 ? "Empiezas tú con el doble seis." : NAMES[round.turn] + " empieza con el doble seis.";
    if (starter !== null) msg = round.turn === 0 ? "Empiezas tú: pon la ficha que quieras." : NAMES[round.turn] + " empieza la mano.";
    $("d-next").hidden = true;
    render(); schedule();
  }

  function newGame() { scores = [0, 0]; roundNo = 1; gameOver = false; newRound(null); }

  function schedule() {
    clearTimeout(timer);
    if (round.over) return endRound();
    var seat = round.turn;
    if (seat === 0 && D.legal(round, 0).length) return; // espera tu clic
    timer = setTimeout(function () {
      var m = seat === 0 ? null : D.bot(round, seat);
      var before = round;
      if (m) {
        var t = before.hands[seat][m.i];
        round = D.play(round, seat, m.i, m.side);
        msg = NAMES[seat] + " jugó " + label(t) + ".";
      } else {
        round = D.pass(round, seat);
        msg = seat === 0 ? "No tienes ficha: pasas." : NAMES[seat] + " pasó.";
      }
      render(); schedule();
    }, seat === 0 ? 1100 : 750);
  }

  function endRound() {
    var us = round.winner >= 0 && round.winner % 2 === 0, who;
    if (round.reason === "tranca-empate") who = "Juego trancado y empatado entre parejas: nadie suma.";
    else {
      who = (round.reason === "domino" ? NAMES[round.winner] + (round.winner === 0 ? " te quedaste" : " se quedó") + " sin fichas" : "Juego trancado")
        + ". " + (us ? "Suman ustedes " : "Suman ellos ") + round.points + " puntos.";
      scores[us ? 0 : 1] += round.points;
    }
    var win = scores[0] >= D.TARGET || scores[1] >= D.TARGET;
    if (win) { gameOver = true; who += scores[0] >= scores[1] ? " ¡Ganaron ustedes la partida!" : " Ganaron ellos la partida."; }
    msg = who; render();
    $("d-next").hidden = win;
    $("d-next").textContent = "Siguiente mano";
  }

  $("d-next").addEventListener("click", function () {
    if (!round.over || gameOver) return;
    roundNo++;
    newRound(round.winner >= 0 ? round.winner : round.starter);
  });
  $("d-new").addEventListener("click", newGame);

  function onHand(i) {
    if (round.over || round.turn !== 0) return;
    var moves = D.legal(round, 0).filter(function (m) { return m.i === i; });
    if (!moves.length) return;
    var sides = moves.map(function (m) { return m.side; });
    var e = D.ends(round.chain);
    if (sides.length === 2 && e && e[0] === e[1]) sides = [sides[0]];
    if (sides.length === 1) return playHuman(i, sides[0]);
    pendingTile = i; renderChoice(e);
  }

  function playHuman(i, side) {
    var t = round.hands[0][i];
    pendingTile = -1;
    round = D.play(round, 0, i, side);
    msg = "Jugaste " + label(t) + ".";
    render(); schedule();
  }

  function renderChoice(e) {
    var c = $("choice"); c.textContent = "";
    var l = document.createElement("button"), r = document.createElement("button");
    l.type = r.type = "button";
    l.textContent = "◀ Izquierda (" + e[0] + ")"; r.textContent = "Derecha (" + e[1] + ") ▶";
    l.addEventListener("click", function () { c.hidden = true; playHuman(pendingTile, "L"); });
    r.addEventListener("click", function () { c.hidden = true; playHuman(pendingTile, "R"); });
    c.appendChild(l); c.appendChild(r); c.hidden = false;
  }

  function render() {
    $("d-us").textContent = scores[0]; $("d-them").textContent = scores[1]; $("d-round").textContent = roundNo;
    $("d-msg").textContent = msg;
    // fichas de los demás
    [1, 2, 3].forEach(function (s) {
      var el = $("seat" + s); el.textContent = "";
      var n = round.hands[s].length, name = document.createElement("div");
      name.className = "dom-name" + (round.turn === s && !round.over ? " turn" : "");
      name.textContent = NAMES[s] + " · " + n + (n === 1 ? " ficha" : " fichas");
      el.appendChild(name);
      var row = document.createElement("div"); row.className = "dom-backs";
      for (var i = 0; i < n; i++) row.appendChild(back());
      if (round.over) { row.textContent = ""; round.hands[s].forEach(function (t) { row.appendChild(tile(t, "mini")); }); }
      el.appendChild(row);
    });
    // mesa
    tableEl.textContent = "";
    round.chain.forEach(function (t) { tableEl.appendChild(tile(t)); });
    var e = D.ends(round.chain);
    $("d-ends").textContent = e ? "Extremos de la mesa: " + e[0] + " y " + e[1] : "La mesa está vacía.";
    // tu mano
    var hand = $("hand"); hand.textContent = "";
    var playable = round.turn === 0 && !round.over ? D.legal(round, 0).map(function (m) { return m.i; }) : [];
    round.hands[0].forEach(function (t, i) {
      var can = playable.indexOf(i) >= 0;
      var b = document.createElement("button");
      b.type = "button"; b.className = "dom-tile-btn" + (can ? " can" : "") + (i === pendingTile ? " sel" : "");
      b.disabled = !can; b.appendChild(tile(t));
      b.addEventListener("click", function () { $("choice").hidden = true; onHand(i); });
      hand.appendChild(b);
    });
    if (round.turn !== 0 || round.over) $("choice").hidden = true;
  }

  newGame();
})();
