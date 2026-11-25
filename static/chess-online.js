(function () {
  "use strict";
  var C = window.Chess, root = document.getElementById("chess"), boardEl = document.getElementById("board");
  if (!C || !root || !boardEl) return;
  var $ = function (id) { return document.getElementById(id); };
  var TYPE = [" ", "p", "n", "b", "r", "q", "k"];
  var sq = [], srv = null, state, sans, repeats, lastMove, selected = -1, targets = [], pending = null, busy = false, flipped = false, baseTitle = document.title;

  for (var i = 0; i < 64; i++) {
    var d = document.createElement("div");
    d.className = "sq"; d.setAttribute("role", "gridcell");
    sq.push(d); boardEl.appendChild(d);
  }
  boardEl.addEventListener("click", function (e) {
    var el = e.target.closest(".sq");
    if (el) onSquare(Number(el.dataset.s));
  });

  // reconstruye la posición repitiendo las jugadas guardadas en el servidor
  function replay(moves) {
    state = C.fromFEN(C.START); sans = []; lastMove = null;
    repeats = {}; repeats[C.positionKey(state)] = 1;
    for (var i = 0; i < moves.length; i++) {
      var m = C.legalMoves(state).filter(function (x) {
        return x.f === moves[i][0] && x.t === moves[i][1] && x.p === moves[i][2];
      })[0];
      if (!m) break;
      sans.push(C.san(state, m, "es"));
      state = C.make(state, m); lastMove = m;
      var k = C.positionKey(state); repeats[k] = (repeats[k] || 0) + 1;
    }
  }

  function myTurn() {
    return srv && srv.status === "playing" && srv.you && ((state.turn === 1) === (srv.you === "w"));
  }

  function onSquare(s) {
    if (!myTurn() || busy || pending) return;
    var p = state.board[s];
    if (selected >= 0) {
      var cand = targets.filter(function (m) { return m.t === s; });
      if (cand.length) {
        if (cand.length > 1) { pending = cand; $("promo").hidden = false; render(); return; }
        send(cand[0]); return;
      }
    }
    if (p && (p > 0) === (state.turn > 0)) {
      selected = s; targets = C.legalMoves(state).filter(function (m) { return m.f === s; });
    } else { selected = -1; targets = []; }
    render();
  }

  $("promo").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || !pending) return;
    var m = pending.filter(function (x) { return x.p === Number(b.dataset.p); })[0];
    pending = null; $("promo").hidden = true;
    if (m) send(m); else render();
  });

  function resultFor(next, key) {
    var st = C.status(next);
    if (st.over) return st.result;
    return (repeats[key] || 0) + 1 >= 3 ? "repetition" : "";
  }

  function send(m) {
    busy = true; selected = -1; targets = [];
    var next = C.make(state, m);
    var body = new URLSearchParams({
      _csrf: root.dataset.token, ply: String(srv.ply), f: m.f, t: m.t, p: m.p || 0,
      result: resultFor(next, C.positionKey(next))
    });
    fetch(root.dataset.moveUrl, { method: "POST", body: body, credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) { if (!data.error) apply(data); busy = false; render(); if (data.error) poll(); })
      .catch(function () { busy = false; render(); });
  }

  function apply(data) {
    var changed = !srv || data.ply !== srv.ply || data.status !== srv.status;
    var first = !srv;
    srv = data;
    if (first) flipped = data.you === "b";
    if (changed) { replay(data.moves); selected = -1; targets = []; }
  }

  function poll() {
    if (busy) return;
    fetch(root.dataset.stateUrl, { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (data) { if (!busy) { apply(data); render(); } })
      .catch(function () {});
  }

  function who(c) { return c === "w" ? "las blancas" : "las negras"; }

  function statusText() {
    if (!srv) return "Cargando…";
    if (srv.status === "open") return "Esperando a que otro miembro se una. Pídele que entre a Ajedrez → En línea.";
    if (srv.status === "over") {
      var r = srv.result;
      if (r === "mate") return "Jaque mate. Ganan " + who(srv.winner) + ".";
      if (r === "resign") return "Se rindió " + who(srv.winner === "w" ? "b" : "w") + ". Ganan " + who(srv.winner) + ".";
      if (r === "stalemate") return "Tablas: rey ahogado.";
      if (r === "insufficient") return "Tablas: falta de material para dar mate.";
      if (r === "fifty") return "Tablas: 50 jugadas sin captura ni peón.";
      return "Tablas: la posición se repitió tres veces.";
    }
    var turn = state.turn === 1 ? "w" : "b", chk = C.status(state).check ? "¡Jaque! " : "";
    if (!srv.you) return chk + "Turno de " + who(turn) + " (estás mirando).";
    return chk + (turn === srv.you ? "Es tu turno." : "Turno de tu rival.");
  }

  function findKing(color) {
    for (var i = 0; i < 64; i++) if (state.board[i] === color * C.K) return i;
    return -1;
  }

  function render() {
    if (!srv) return;
    $("cstatus").textContent = statusText();
    $("players").textContent = "Blancas: " + (srv.white || "…") + " · Negras: " + (srv.black || "…") +
      (srv.you ? " · Tú juegas con " + (srv.you === "w" ? "blancas" : "negras") : "");
    var rb = $("resignbtn");
    if (rb) {
      rb.hidden = srv.status === "over";
      rb.textContent = srv.status === "open" ? "Cancelar partida" : "Rendirme";
    }
    document.title = (myTurn() ? "(tu turno) " : "") + baseTitle;
    var kingSq = srv.status !== "open" && C.status(state).check ? findKing(state.turn) : -1;
    for (var i = 0; i < 64; i++) {
      var s = flipped ? 63 - i : i, el = sq[i], p = state.board[s];
      var cls = "sq " + ((((s >> 3) + (s & 7)) & 1) ? "dk" : "lt");
      if (s === selected) cls += " sel";
      if (lastMove && (s === lastMove.f || s === lastMove.t)) cls += " last";
      if (s === kingSq) cls += " chk";
      if (targets.some(function (m) { return m.t === s; })) cls += p ? " cap" : " tgt";
      el.className = cls; el.dataset.s = s; el.textContent = "";
      if (p) {
        var pc = document.createElement("i");
        pc.className = "pc " + (p > 0 ? "w" : "b") + TYPE[Math.abs(p)];
        el.appendChild(pc);
      }
    }
    var ol = $("moves"); ol.textContent = "";
    for (var j = 0; j < sans.length; j += 2) {
      var li = document.createElement("li");
      li.value = j / 2 + 1;
      li.textContent = sans[j] + (sans[j + 1] ? "  " + sans[j + 1] : "");
      ol.appendChild(li);
    }
    ol.scrollTop = ol.scrollHeight;
  }

  var rs = $("resign");
  if (rs) rs.addEventListener("submit", function (e) {
    var open = srv && srv.status === "open";
    if (!window.confirm(open ? "¿Cancelar esta partida?" : "¿Seguro que quieres rendirte?")) e.preventDefault();
  });
  $("cflip").addEventListener("click", function () { flipped = !flipped; render(); });

  state = C.fromFEN(C.START); sans = []; repeats = {};
  poll();
  setInterval(function () { if (!document.hidden) poll(); }, 2500);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
})();
