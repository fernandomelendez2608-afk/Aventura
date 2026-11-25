/* Dibujo de fichas, compartido por el dominó local y el de línea. */
(function () {
  "use strict";
  var PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function half(n, horizontal) {
    var h = document.createElement("div"); h.className = "half";
    var pat = n === 6 && horizontal ? [0, 1, 2, 6, 7, 8] : PIPS[n];
    for (var i = 0; i < 9; i++) {
      var s = document.createElement("span");
      if (pat.indexOf(i) >= 0) s.className = "pip";
      h.appendChild(s);
    }
    return h;
  }
  function tile(t, cls) {
    var dbl = t[0] === t[1], el = document.createElement("div");
    el.className = "dt " + (dbl ? "v" : "h") + (cls ? " " + cls : "");
    el.appendChild(half(t[0], !dbl));
    el.appendChild(document.createElement("i"));
    el.appendChild(half(t[1], !dbl));
    el.setAttribute("aria-label", "ficha " + t[0] + " con " + t[1]);
    return el;
  }
  function back() { var el = document.createElement("div"); el.className = "dt back"; return el; }
  window.DominoView = { tile: tile, back: back };
})();
