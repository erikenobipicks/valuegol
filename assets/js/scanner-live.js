/* ============================================================
   PicksGuru — Scanner live (frontend)
   Consume /api/matches/live del backend y refresca la tabla.
   Si el backend no está disponible (p. ej. abriendo el HTML como
   archivo suelto), conserva las filas estáticas de ejemplo.
   ============================================================ */
(function () {
  "use strict";

  var ENDPOINT = "/api/matches/live";
  var REFRESH_MS = 15000;

  var rows = document.getElementById("scanner-rows");
  var countEl = document.getElementById("scanner-count");
  var sourceEl = document.getElementById("scanner-source");
  var updatedEl = document.getElementById("scanner-updated");
  if (!rows) return;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function pressurePill(p) {
    if (p === "alta") return '<span class="pill pill--hot">Alta</span>';
    if (p === "media") return '<span class="pill pill--mid">Media</span>';
    if (p === "baja") return '<span class="pill pill--low">Baja</span>';
    return '<span class="pill pill--low">—</span>';
  }

  function cell(v) { return (v === null || v === undefined) ? "—" : v; }

  function renderRow(m) {
    var score = (m.scoreHome != null ? m.scoreHome : 0) + "–" + (m.scoreAway != null ? m.scoreAway : 0);
    var min = (m.minute != null ? m.minute + "'" : (m.status || "—"));
    var signal = m.signal ? '<span class="pill pill--signal">Señal</span>' : "<span></span>";
    return (
      '<div class="table__row" role="row">' +
        '<span class="t-match">' + esc(m.home) + ' <b>' + esc(score) + '</b> ' + esc(m.away) + "</span>" +
        "<span>" + esc(min) + "</span>" +
        "<span>" + cell(m.shots) + "</span>" +
        "<span>" + cell(m.corners) + "</span>" +
        "<span>" + pressurePill(m.pressure) + "</span>" +
        signal +
      "</div>"
    );
  }

  function render(data) {
    var matches = (data.matches || []).slice(0, 8);
    if (!matches.length) return; // mantiene el fallback estático
    rows.innerHTML = matches.map(renderRow).join("");

    if (countEl) countEl.textContent = "EN VIVO · " + data.count + " partido" + (data.count === 1 ? "" : "s");

    if (sourceEl) {
      if (data.source && data.source.indexOf("demo") === 0) {
        sourceEl.hidden = false;
        sourceEl.textContent = "demo";
        sourceEl.title = "Datos de demostración (sin API key o sin partidos en directo).";
      } else {
        sourceEl.hidden = true;
      }
    }
    if (updatedEl) updatedEl.textContent = "actualizado ahora";
  }

  var ticking = false;
  function tick() {
    if (ticking) return;
    ticking = true;
    fetch(ENDPOINT, { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(render)
      .catch(function () { /* sin backend: se conservan las filas estáticas */ })
      .finally(function () { ticking = false; });
  }

  tick();
  setInterval(tick, REFRESH_MS);

  // Marca "hace Xs" entre refrescos (feedback de vida).
  var secs = 0;
  setInterval(function () {
    if (!updatedEl || !updatedEl.textContent) return;
    secs = (secs + 1) % (REFRESH_MS / 1000);
  }, 1000);
})();
