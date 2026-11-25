(function () {
  "use strict";
  var V = window.DominoView, root = document.getElementById("dom-online");
  if (!V || !root) return;
  var $ = function (id) { return document.getElementById(id); };
  var view = null, busy = false, pendingTile = -1, post = function (url, data) {
    var b = new URLSearchParams(data || {}); b.set("_csrf", root.dataset.token);
    return fetch(url, { method: "POST", body: b, credentials: "same-origin" }).then(function (r) { return r.json(); });
  };

  function nm(s) { var x = view.seats[s]; return x ? x.name : "(vacío)"; }
  function rel(s) { return (s - Math.max(view.you, 0) + 4) % 4; }
  function seatOf(r) { return (r + Math.max(view.you, 0)) % 4; }
  function label(r) {
    var s = seatOf(r), n = nm(s);
    return r === 0 ? "Tú" : n + (r === 2 ? " (compañero)" : " (rival)");
  }
  function entryText(e) {
    var who = rel(e.seat) === 0 ? "Tú" : nm(e.seat);
    return e.pass ? who + " pasó." : who + " jugó " + e.tile[0] + "|" + e.tile[1] + ".";
  }

  function statusText() {
    if (view.status === "open") {
      var seated = view.seats.filter(Boolean).length;
      return "Esperando jugadores (" + seated + " de 4 sentados). " + (view.owner ? "Cuando quieras, empieza y la computadora ocupa los lugares vacíos." : "El anfitrión empezará pronto.");
    }
    var last = view.log.length ? entryText(view.log[view.log.length - 1]) + " " : "";
    if (view.over) {
      var us = view.winner >= 0 && (view.winner - Math.max(view.you, 0) + 4) % 2 === 0, txt;
      if (view.reason === "tranca-empate") txt = "Juego trancado y empatado entre parejas: nadie suma.";
      else txt = (view.reason === "domino" ? (rel(view.winner) === 0 ? "Te quedaste" : nm(view.winner) + " se quedó") + " sin fichas" : "Juego trancado") +
        ". " + (us ? "Suman ustedes " : "Suman ellos ") + view.points + " puntos.";
      if (view.status === "over") {
        var mine = (Math.max(view.you, 0) % 2 === 0) ? view.scores[0] : view.scores[1], theirs = (Math.max(view.you, 0) % 2 === 0) ? view.scores[1] : view.scores[0];
        txt += mine >= theirs ? " ¡Ganaron ustedes la partida!" : " Ganaron ellos la partida.";
      }
      return txt;
    }
    if (view.turn === view.you) return last + (view.legal.length ? "Es tu turno." : "No tienes ficha: pasas.");
    return last + "Turno de " + nm(view.turn) + ".";
  }

  function render() {
    var v = view, me = Math.max(v.you, 0), myTeam = me % 2;
    $("d-us").textContent = v.scores[myTeam]; $("d-them").textContent = v.scores[1 - myTeam];
    $("d-round").textContent = v.round_no;
    $("d-msg").textContent = statusText();
    $("d-start").hidden = !(v.status === "open" && v.owner);
    $("d-next").hidden = !(v.status === "playing" && v.over);
    var table = $("table"); table.textContent = "";
    if (v.status === "open") {
      [1, 2, 3].forEach(function (r) { $("seat" + r).textContent = label(r); });
      $("hand").textContent = ""; $("d-ends").textContent = "";
      $("choice").hidden = true; $("d-log").textContent = "";
      return;
    }
    [1, 2, 3].forEach(function (r) {
      var s = seatOf(r), el = $("seat" + r); el.textContent = "";
      var n = v.counts[s], name = document.createElement("div");
      name.className = "dom-name" + (v.turn === s && !v.over ? " turn" : "");
      name.textContent = label(r) + " · " + n + (n === 1 ? " ficha" : " fichas");
      el.appendChild(name);
      var row = document.createElement("div"); row.className = "dom-backs";
      if (v.over && v.hands) v.hands[s].forEach(function (t) { row.appendChild(V.tile(t, "mini")); });
      else for (var i = 0; i < n; i++) row.appendChild(V.back());
      el.appendChild(row);
    });
    v.chain.forEach(function (t) { table.appendChild(V.tile(t)); });
    var e = v.chain.length ? [v.chain[0][0], v.chain[v.chain.length - 1][1]] : null;
    $("d-ends").textContent = e ? "Extremos de la mesa: " + e[0] + " y " + e[1] : "La mesa está vacía.";
    var hand = $("hand"); hand.textContent = "";
    var playable = v.legal.map(function (m) { return m.i; });
    v.hand.forEach(function (t, i) {
      var can = playable.indexOf(i) >= 0;
      var b = document.createElement("button");
      b.type = "button"; b.className = "dom-tile-btn" + (can ? " can" : "") + (i === pendingTile ? " sel" : "");
      b.disabled = !can; b.appendChild(V.tile(t));
      b.addEventListener("click", function () { $("choice").hidden = true; onHand(i); });
      hand.appendChild(b);
    });
    if (v.turn !== v.you || v.over) $("choice").hidden = true;
    var ul = $("d-log"); ul.textContent = "";
    v.log.slice().reverse().forEach(function (x) { var li = document.createElement("li"); li.textContent = entryText(x); ul.appendChild(li); });
  }

  function onHand(i) {
    if (busy || !view || view.turn !== view.you || view.over) return;
    var moves = view.legal.filter(function (m) { return m.i === i; });
    if (!moves.length) return;
    var sides = moves.map(function (m) { return m.side; });
    var e = [view.chain[0] && view.chain[0][0], view.chain.length ? view.chain[view.chain.length - 1][1] : null];
    if (sides.length === 2 && e[0] === e[1]) sides = [sides[0]];
    if (sides.length === 1) return send(i, sides[0]);
    pendingTile = i;
    var c = $("choice"); c.textContent = "";
    [["L", "◀ Izquierda (" + e[0] + ")"], ["R", "Derecha (" + e[1] + ") ▶"]].forEach(function (o) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = o[1];
      b.addEventListener("click", function () { c.hidden = true; send(pendingTile, o[0]); });
      c.appendChild(b);
    });
    c.hidden = false; render();
  }

  function send(i, side) {
    busy = true; pendingTile = -1;
    post(root.dataset.moveUrl, { i: i, side: side }).then(function (d) {
      busy = false;
      if (!d.error) { view = d; render(); } else poll();
    }).catch(function () { busy = false; });
  }

  function poll() {
    if (busy) return;
    fetch(root.dataset.stateUrl, { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (busy || d.error) return; view = d; render(); })
      .catch(function () {});
  }

  $("d-next").addEventListener("click", function () { post(root.dataset.nextUrl).then(poll); });
  $("d-start").addEventListener("click", function () {
    post(root.dataset.stateUrl.replace("/estado/", "/empezar/")).then(poll);
  });
  $("d-leave").addEventListener("submit", function (e) {
    if (!window.confirm("¿Salir de la mesa? Si ya empezó, la computadora jugará por ti.")) e.preventDefault();
  });
  poll();
  setInterval(function () { if (!document.hidden) poll(); }, 1500);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
})();
