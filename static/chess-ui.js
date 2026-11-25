(function () {
  "use strict";
  var C = window.Chess, boardEl = document.getElementById("board");
  if (!C || !boardEl) return;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "pcs"; // letras de clase por tipo
  var TYPE = [" ", "p", "n", "b", "r", "q", "k"];
  var state, hist, sans, flipped, human, selected, targets, pendingPromo, over, thinking, repeats, lastMove;
  var sq = [];

  for (var i = 0; i < 64; i++) {
    var d = document.createElement("div");
    d.className = "sq";
    d.setAttribute("role", "gridcell");
    sq.push(d);
    boardEl.appendChild(d);
  }
  boardEl.addEventListener("click", function (e) {
    var el = e.target.closest(".sq");
    if (el) onSquare(Number(el.dataset.s));
  });

  function mode() { return $("mode").value; }
  function level() { return Number($("level").value); }

  function newGame() {
    state = C.fromFEN(C.START);
    hist = []; sans = []; selected = -1; targets = []; pendingPromo = null; over = false; thinking = false;
    lastMove = null; repeats = {}; repeats[C.positionKey(state)] = 1;
    human = mode() === "ai" ? Number($("side").value) : 0;
    flipped = human === -1;
    $("promo").hidden = true;
    sync(); render();
    if (human && state.turn !== human) aiTurn();
  }

  function sync() {
    var ai = mode() === "ai";
    $("lvlbox").hidden = !ai; $("sidebox").hidden = !ai;
  }

  function isMine() { return !human || state.turn === human; }

  function onSquare(s) {
    if (over || thinking || pendingPromo || !isMine()) return;
    var p = state.board[s];
    if (selected >= 0) {
      var cand = targets.filter(function (m) { return m.t === s; });
      if (cand.length) {
        if (cand.length > 1) { pendingPromo = cand; $("promo").hidden = false; render(); return; }
        play(cand[0]); return;
      }
    }
    if (p && (p > 0) === (state.turn > 0)) {
      selected = s;
      targets = C.legalMoves(state).filter(function (m) { return m.f === s; });
    } else { selected = -1; targets = []; }
    render();
  }

  $("promo").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || !pendingPromo) return;
    var pt = Number(b.dataset.p);
    var m = pendingPromo.filter(function (x) { return x.p === pt; })[0];
    pendingPromo = null; $("promo").hidden = true;
    if (m) play(m);
  });

  function play(m) {
    var label = C.san(state, m, "es");
    hist.push({ state: state, last: lastMove, label: label, key: C.positionKey(state) });
    sans.push(label);
    state = C.make(state, m);
    lastMove = m; selected = -1; targets = [];
    var k = C.positionKey(state);
    repeats[k] = (repeats[k] || 0) + 1;
    render();
    if (human && !over && state.turn !== human) aiTurn();
  }

  function aiTurn() {
    thinking = true; render();
    setTimeout(function () {
      var r = C.bestMove(state, level());
      thinking = false;
      if (r && !over) play(r.move);
    }, 120);
  }

  function undo() {
    if (thinking || !hist.length) return;
    var n = human ? (state.turn === human ? 2 : 1) : 1;
    while (n-- > 0 && hist.length) {
      var k = C.positionKey(state);
      repeats[k] = Math.max(0, (repeats[k] || 1) - 1);
      var h = hist.pop(); sans.pop();
      state = h.state; lastMove = h.last;
    }
    selected = -1; targets = []; pendingPromo = null; $("promo").hidden = true;
    render();
  }

  function statusText() {
    var st = C.status(state), who = state.turn === 1 ? "las blancas" : "las negras";
    over = true;
    if (st.result === "mate") return "Jaque mate. Ganan " + (st.winner === 1 ? "las blancas" : "las negras") + ".";
    if (st.result === "stalemate") return "Tablas: rey ahogado.";
    if (st.result === "insufficient") return "Tablas: falta de material para dar mate.";
    if (st.result === "fifty") return "Tablas: 50 jugadas sin captura ni peón.";
    if (repeats[C.positionKey(state)] >= 3) return "Tablas: la posición se repitió tres veces.";
    over = false;
    if (thinking) return "La computadora está pensando…";
    var t = "Turno de " + who + (human && state.turn === human ? " (tú)" : "");
    return st.check ? "¡Jaque! " + t : t;
  }

  function render() {
    var text = statusText();
    $("cstatus").textContent = text;
    var kingSq = C.status(state).check ? findKing(state.turn) : -1;
    for (var i = 0; i < 64; i++) {
      var s = flipped ? 63 - i : i, el = sq[i], p = state.board[s];
      var cls = "sq " + ((((s >> 3) + (s & 7)) & 1) ? "dk" : "lt");
      if (s === selected) cls += " sel";
      if (lastMove && (s === lastMove.f || s === lastMove.t)) cls += " last";
      if (s === kingSq) cls += " chk";
      var tg = targets.some(function (m) { return m.t === s; });
      if (tg) cls += p ? " cap" : " tgt";
      el.className = cls;
      el.dataset.s = s;
      el.textContent = "";
      if (p) {
        var pc = document.createElement("i");
        pc.className = "pc " + (p > 0 ? "w" : "b") + TYPE[Math.abs(p)];
        el.appendChild(pc);
      }
      el.setAttribute("aria-label", C.sqName(s) + (p ? " " + (p > 0 ? "blanca" : "negra") : ""));
    }
    var ol = $("moves"); ol.textContent = "";
    for (var j = 0; j < sans.length; j += 2) {
      var li = document.createElement("li");
      li.value = j / 2 + 1;
      li.textContent = sans[j] + (sans[j + 1] ? "  " + sans[j + 1] : "");
      ol.appendChild(li);
    }
    ol.scrollTop = ol.scrollHeight;
    $("cundo").disabled = !hist.length || thinking;
  }

  function findKing(color) {
    for (var i = 0; i < 64; i++) if (state.board[i] === color * C.K) return i;
    return -1;
  }

  $("cnew").addEventListener("click", newGame);
  $("cundo").addEventListener("click", undo);
  $("cflip").addEventListener("click", function () { flipped = !flipped; render(); });
  $("mode").addEventListener("change", newGame);
  $("side").addEventListener("change", newGame);
  newGame();
  window.__chess = { play: function () { return state; } };
})();
