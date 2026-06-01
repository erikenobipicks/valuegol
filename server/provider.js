"use strict";
/* ============================================================
   PicksGuru — Adaptador de proveedor de datos
   - fetchLiveReal(key): consume API-Football (api-sports.io) y
     normaliza a NUESTRO modelo interno.
   - getDemo(): datos sintéticos que evolucionan con el tiempo
     (para que el scanner se vea "vivo" online sin gastar cuota
     ni necesitar API key).

   El resto del sistema solo conoce el modelo interno → cambiar de
   proveedor = añadir otro normalizador aquí (capa Normalizador).
   ============================================================ */

var API_BASE = "https://v3.football.api-sports.io";

/* ---- Modelo interno de un partido ----
   { id, league, country, home, away, scoreHome, scoreAway,
     minute, status, shots, corners, pressure, signal } */

// --- API-Football: fixtures en directo ---------------------
function normalizeReal(fixtures) {
  return (fixtures || []).map(function (f) {
    var fx = f.fixture || {};
    var st = fx.status || {};
    var teams = f.teams || {};
    var goals = f.goals || {};
    var league = f.league || {};
    return {
      id: String(fx.id),
      league: league.name || "—",
      country: league.country || "",
      home: (teams.home && teams.home.name) || "Local",
      away: (teams.away && teams.away.name) || "Visitante",
      scoreHome: goals.home != null ? goals.home : 0,
      scoreAway: goals.away != null ? goals.away : 0,
      minute: st.elapsed != null ? st.elapsed : null,
      status: st.short || "LIVE",
      // El endpoint live=all NO trae stats detalladas (ahorra requests
      // en el free tier). Tiros/córners/presión requieren otra llamada
      // (/fixtures/statistics) que añadiremos en una fase posterior.
      shots: null,
      corners: null,
      pressure: null,
      signal: false
    };
  });
}

async function fetchLiveReal(key) {
  var res = await fetch(API_BASE + "/fixtures?live=all", {
    headers: { "x-apisports-key": key }
  });
  if (!res.ok) throw new Error("API-Football HTTP " + res.status);
  var json = await res.json();
  if (json.errors && !Array.isArray(json.errors) && Object.keys(json.errors).length) {
    throw new Error("API-Football: " + JSON.stringify(json.errors));
  }
  return normalizeReal(json.response || []);
}

// --- Datos demo (evolucionan con el reloj) -----------------
var DEMO = [
  { home: "Rayo Verde", away: "Atlético Azul", league: "Liga Demo", seed: 3, baseH: 2, baseA: 1 },
  { home: "Costa FC", away: "Unión Norte", league: "Liga Demo", seed: 7, baseH: 0, baseA: 0 },
  { home: "Sporting Sur", away: "Real Cima", league: "Copa Demo", seed: 11, baseH: 1, baseA: 1 },
  { home: "Deportivo Río", away: "CD Llano", league: "Liga Demo", seed: 5, baseH: 3, baseA: 1 },
  { home: "Olímpico Este", away: "Ciudad Lago", league: "Liga Demo 2", seed: 2, baseH: 0, baseA: 1 },
  { home: "Veloz CF", away: "Montaña United", league: "Copa Demo", seed: 9, baseH: 1, baseA: 0 }
];

function getDemo() {
  var now = Date.now();
  return DEMO.map(function (m) {
    // El minuto avanza ~1 cada 10 s reales (loop 1–90) → movimiento visible.
    var minute = 1 + Math.floor((now / 10000 + m.seed * 7) % 90);
    var shots = Math.floor(minute / 9) + (m.seed % 4);
    var corners = Math.floor(minute / 12) + (m.seed % 3);
    // Presión: onda lenta combinada con el minuto.
    var wave = Math.sin((now / 30000) + m.seed) * 0.5 + 0.5; // 0..1
    var score = (wave * 0.6) + Math.min(1, (corners + shots) / 22) * 0.4;
    var pressure = score > 0.66 ? "alta" : score > 0.4 ? "media" : "baja";
    return {
      id: "demo-" + m.seed,
      league: m.league,
      country: "",
      home: m.home,
      away: m.away,
      scoreHome: m.baseH,
      scoreAway: m.baseA,
      minute: minute,
      status: "LIVE",
      shots: shots,
      corners: corners,
      pressure: pressure,
      signal: pressure === "alta" && corners >= 6
    };
  });
}

module.exports = { fetchLiveReal: fetchLiveReal, getDemo: getDemo, normalizeReal: normalizeReal };
