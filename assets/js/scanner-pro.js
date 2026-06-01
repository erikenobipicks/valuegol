/* ============================================================
   ValueGol — Scanner PRO (configurable)
   Tabla en directo con buscador, filtros, orden por columna y
   selector de columnas (mostrar/ocultar). Config persistida en
   localStorage. Consume /api/matches/live cada N segundos.
   Vanilla, sin dependencias.
   ============================================================ */
(function () {
  "use strict";

  var ENDPOINT = "/api/matches/live";
  var REFRESH_MS = 8000;
  var LS = "vg_scanner_cfg";

  var table = document.getElementById("sc-table");
  if (!table) return; // solo en app.html

  var head = document.getElementById("sc-head");
  var body = document.getElementById("sc-body");
  var meta = document.getElementById("sc-meta");
  var count = document.getElementById("sc-count");

  // helpers
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pair(h, a) { return (h == null ? "—" : h) + "<span class='sc-sep'>-</span>" + (a == null ? "—" : a); }
  function num(x) { return (x == null || isNaN(x)) ? null : Number(x); }

  function pressurePill(p) {
    var map = { alta: ["Alta", "hot"], media: ["Media", "mid"], baja: ["Baja", "low"] };
    var v = map[p] || ["—", "low"];
    return '<span class="pill pill--' + v[1] + '">' + v[0] + "</span>";
  }

  // --- Definición de columnas ---------------------------------
  // always: no se puede ocultar. sort: valor numérico/cadena para ordenar.
  var COLUMNS = [
    { key: "league",  label: "Liga",       def: false, render: function (m) { return esc(m.league); }, sort: function (m) { return m.league || ""; } },
    { key: "match",   label: "Partido",    always: true, render: function (m) { return '<span class="sc-match">' + esc(m.home) + ' <b>' + (m.scoreHome || 0) + "–" + (m.scoreAway || 0) + "</b> " + esc(m.away) + "</span>"; }, sort: function (m) { return m.home || ""; } },
    { key: "min",     label: "Min",        always: true, render: function (m) { return (m.minute != null ? m.minute + "'" : (m.status || "—")); }, sort: function (m) { return num(m.minute) || 0; } },
    { key: "poss",    label: "Posesión",   def: true,  render: function (m) { return m.possessionHome != null ? m.possessionHome + "<span class='sc-sep'>-</span>" + m.possessionAway + "%" : "—"; }, sort: function (m) { return num(m.possessionHome) || 0; } },
    { key: "shots",   label: "Tiros",      def: true,  render: function (m) { return pair(m.shotsHome, m.shotsAway); }, sort: function (m) { return (num(m.shots)) || 0; } },
    { key: "sot",     label: "T. puerta",  def: true,  render: function (m) { return pair(m.sotHome, m.sotAway); }, sort: function (m) { return (num(m.sotHome) || 0) + (num(m.sotAway) || 0); } },
    { key: "corners", label: "Córners",    def: true,  render: function (m) { return pair(m.cornersHome, m.cornersAway); }, sort: function (m) { return num(m.corners) || 0; } },
    { key: "attacks", label: "Ataques",    def: false, render: function (m) { return pair(m.attacksHome, m.attacksAway); }, sort: function (m) { return (num(m.attacksHome) || 0) + (num(m.attacksAway) || 0); } },
    { key: "datt",    label: "At. pelig.", def: true,  render: function (m) { return pair(m.dangerousHome, m.dangerousAway); }, sort: function (m) { return num(m.dangerous_attacks) || 0; } },
    { key: "cards",   label: "Tarjetas",   def: false, render: function (m) { return '<span class="sc-yel">🟨' + (m.yellow_cards || 0) + "</span> <span class='sc-red'>🟥" + (m.red_cards || 0) + "</span>"; }, sort: function (m) { return (num(m.red_cards) || 0) * 10 + (num(m.yellow_cards) || 0); } },
    { key: "press",   label: "Presión",    def: true,  render: function (m) { return pressurePill(m.pressure); }, sort: function (m) { return ({ alta: 3, media: 2, baja: 1 })[m.pressure] || 0; } },
    { key: "signal",  label: "Señal",      def: true,  render: function (m) { return m.signal ? '<span class="pill pill--signal">Señal</span>' : ""; }, sort: function (m) { return m.signal ? 1 : 0; } }
  ];
  var COLMAP = {}; COLUMNS.forEach(function (c) { COLMAP[c.key] = c; });

  // --- Configuración (persistida) -----------------------------
  var cfg = loadCfg();
  function defaultCfg() {
    var vis = {}; COLUMNS.forEach(function (c) { vis[c.key] = c.always || c.def || false; });
    return { cols: vis, sortKey: "datt", sortDir: -1, q: "", minute: "all", pressure: "all", signalOnly: false };
  }
  function loadCfg() {
    try { var s = JSON.parse(localStorage.getItem(LS)); if (s && s.cols) return Object.assign(defaultCfg(), s); } catch (e) {}
    return defaultCfg();
  }
  function saveCfg() { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) {} }

  // --- Controles ----------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  var search = $("sc-search"), selMin = $("sc-minute"), selPre = $("sc-pressure"), chkSig = $("sc-signal");
  var colsBtn = $("sc-cols-btn"), colsMenu = $("sc-cols-menu"), resetBtn = $("sc-reset");

  // estado inicial de los controles
  search.value = cfg.q; selMin.value = cfg.minute; selPre.value = cfg.pressure; chkSig.checked = cfg.signalOnly;

  search.addEventListener("input", function () { cfg.q = search.value.trim().toLowerCase(); saveCfg(); paint(); });
  selMin.addEventListener("change", function () { cfg.minute = selMin.value; saveCfg(); paint(); });
  selPre.addEventListener("change", function () { cfg.pressure = selPre.value; saveCfg(); paint(); });
  chkSig.addEventListener("change", function () { cfg.signalOnly = chkSig.checked; saveCfg(); paint(); });
  resetBtn.addEventListener("click", function () { cfg = defaultCfg(); saveCfg(); syncControls(); buildHead(); buildColsMenu(); paint(); });

  function syncControls() { search.value = cfg.q; selMin.value = cfg.minute; selPre.value = cfg.pressure; chkSig.checked = cfg.signalOnly; }

  // menú de columnas
  function buildColsMenu() {
    colsMenu.innerHTML = COLUMNS.filter(function (c) { return !c.always; }).map(function (c) {
      return '<label class="sc-colopt"><input type="checkbox" data-col="' + c.key + '"' + (cfg.cols[c.key] ? " checked" : "") + "> " + esc(c.label) + "</label>";
    }).join("");
    colsMenu.querySelectorAll("input[data-col]").forEach(function (inp) {
      inp.addEventListener("change", function () { cfg.cols[inp.dataset.col] = inp.checked; saveCfg(); buildHead(); paint(); });
    });
  }
  colsBtn.addEventListener("click", function () {
    var open = colsMenu.hidden;
    colsMenu.hidden = !open; colsBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", function (e) {
    if (!colsMenu.hidden && !colsMenu.contains(e.target) && e.target !== colsBtn) { colsMenu.hidden = true; colsBtn.setAttribute("aria-expanded", "false"); }
  });

  function visibleCols() { return COLUMNS.filter(function (c) { return c.always || cfg.cols[c.key]; }); }

  // cabecera con orden
  function buildHead() {
    head.innerHTML = visibleCols().map(function (c) {
      var arrow = cfg.sortKey === c.key ? (cfg.sortDir < 0 ? " ▼" : " ▲") : "";
      return '<th data-col="' + c.key + '" class="sc-th' + (cfg.sortKey === c.key ? " is-sorted" : "") + '">' + esc(c.label) + arrow + "</th>";
    }).join("");
    head.querySelectorAll("th").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.col;
        if (cfg.sortKey === k) cfg.sortDir = -cfg.sortDir; else { cfg.sortKey = k; cfg.sortDir = -1; }
        saveCfg(); buildHead(); paint();
      });
    });
  }

  // --- Datos + render -----------------------------------------
  var rows = [], source = "demo";

  function filtered() {
    return rows.filter(function (m) {
      if (cfg.q) {
        var hay = (m.home + " " + m.away + " " + (m.league || "")).toLowerCase();
        if (hay.indexOf(cfg.q) === -1) return false;
      }
      if (cfg.minute === "1h" && !(m.minute <= 45)) return false;
      if (cfg.minute === "2h" && !(m.minute > 45)) return false;
      if (cfg.minute === "final" && !(m.minute >= 75)) return false;
      if (cfg.pressure === "alta" && m.pressure !== "alta") return false;
      if (cfg.pressure === "media" && !(m.pressure === "alta" || m.pressure === "media")) return false;
      if (cfg.signalOnly && !m.signal) return false;
      return true;
    });
  }

  function paint() {
    var cols = visibleCols();
    var col = COLMAP[cfg.sortKey] || COLMAP.datt;
    var list = filtered().sort(function (a, b) {
      var va = col.sort(a), vb = col.sort(b);
      if (typeof va === "string") return va.localeCompare(vb) * cfg.sortDir;
      return (va - vb) * cfg.sortDir;
    });

    body.innerHTML = list.length ? list.map(function (m) {
      return "<tr" + (m.signal ? ' class="is-signal"' : "") + ">" + cols.map(function (c) {
        return "<td" + (c.key === "match" ? ' class="sc-tdmatch"' : "") + ">" + c.render(m) + "</td>";
      }).join("") + "</tr>";
    }).join("") : '<tr><td class="muted" style="padding:1rem" colspan="' + cols.length + '">Sin partidos que cumplan los filtros.</td></tr>';

    if (count) count.textContent = "EN VIVO · " + rows.length + (source.indexOf("demo") === 0 ? " (demo)" : "");
    if (meta) meta.textContent = list.length + " de " + rows.length + " partidos";
  }

  function tick() {
    fetch(ENDPOINT, { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) { rows = d.matches || []; source = d.source || "demo"; paint(); })
      .catch(function () {});
  }

  // init
  buildHead();
  buildColsMenu();
  tick();
  setInterval(tick, REFRESH_MS);
})();
