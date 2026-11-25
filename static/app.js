(function () {
  "use strict";

  // Confirmaciones: <form data-confirm="texto">
  document.addEventListener("submit", function (ev) {
    var msg = ev.target && ev.target.getAttribute && ev.target.getAttribute("data-confirm");
    if (msg && !window.confirm(msg)) {
      ev.preventDefault();
    }
  });

  // Animación de la ruleta: solo repite visualmente el resultado ya calculado en el servidor.
  function runRoulette(box) {
    var nums = (box.getAttribute("data-numbers") || "").split(",").filter(Boolean);
    var winner = box.getAttribute("data-winner");
    var sprite = box.querySelector(".sprite");
    var label = box.querySelector(".rn");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.classList.remove("done");
    // Cada número tiene su animal: la clase "aN" del sprite elige el dibujo.
    function show(num) {
      sprite.className = "sprite xl a" + num;
      label.textContent = num;
    }
    if (reduce || nums.length < 2) {
      show(winner);
      box.classList.add("done");
      return;
    }
    var step = 0, total = 22, delay = 50;
    (function tick() {
      step += 1;
      if (step >= total) {
        show(winner);
        box.classList.add("done");
        return;
      }
      show(nums[Math.floor(Math.random() * nums.length)]);
      delay *= 1.12;
      window.setTimeout(tick, delay);
    })();
  }

  var box = document.getElementById("ruleta");
  if (box) {
    runRoulette(box);
    var again = document.getElementById("repetir");
    if (again) again.addEventListener("click", function () { runRoulette(box); });
  }

  // Verificación en el navegador (misma fórmula que el servidor).
  function sha256Hex(text) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  var btn = document.getElementById("verificar");
  if (btn) {
    btn.addEventListener("click", function () {
      var out = document.getElementById("verificacion");
      if (!window.crypto || !crypto.subtle) {
        out.textContent = "Tu navegador no permite verificar aquí (se necesita una conexión segura).";
        return;
      }
      var seed = btn.getAttribute("data-seed");
      var commitment = btn.getAttribute("data-commitment");
      var day = btn.getAttribute("data-day");
      var nums = btn.getAttribute("data-numbers").split(",").map(Number).sort(function (a, b) { return a - b; });
      var winner = Number(btn.getAttribute("data-winner"));
      var payload = seed + "|" + day + "|" + nums.join(",");
      Promise.all([sha256Hex(seed), sha256Hex(payload)]).then(function (r) {
        var okCommit = r[0] === commitment;
        var idx = Number(BigInt("0x" + r[1]) % BigInt(nums.length));
        var calc = nums[idx];
        var okWinner = calc === winner;
        out.textContent =
          (okCommit ? "✓" : "✗") + " La huella publicada coincide con el secreto revelado.\n" +
          (okWinner ? "✓" : "✗") + " La fórmula da el número " + calc + " (posición " + idx +
          " de " + nums.length + "), y el ganador registrado es el " + winner + ".\n\n" +
          (okCommit && okWinner ? "Todo cuadra." : "Algo no cuadra: avisa al grupo.");
      });
    });
  }
})();
