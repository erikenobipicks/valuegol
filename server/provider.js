"use strict";
/* ============================================================
   ValueGol — Adaptador de proveedor de datos
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
  { home: "Rayo Verde", away: "Atlético Azul", league: "Liga Demo", country: "ES", seed: 3, baseH: 2, baseA: 1 },
  { home: "Costa FC", away: "Unión Norte", league: "Liga Demo", country: "ES", seed: 7, baseH: 0, baseA: 0 },
  { home: "Sporting Sur", away: "Real Cima", league: "Copa Demo", country: "ES", seed: 11, baseH: 1, baseA: 1 },
  { home: "Deportivo Río", away: "CD Llano", league: "Liga Demo", country: "ES", seed: 5, baseH: 3, baseA: 1 },
  { home: "Olímpico Este", away: "Ciudad Lago", league: "Liga Demo 2", country: "ES", seed: 2, baseH: 0, baseA: 1 },
  { home: "Veloz CF", away: "Montaña United", league: "Copa Demo", country: "ES", seed: 9, baseH: 1, baseA: 0 },
  { home: "City Rovers", away: "North End", league: "Premier Demo", country: "EN", seed: 13, baseH: 2, baseA: 2 },
  { home: "Bavaria SV", away: "Rheinland", league: "Bundes Demo", country: "DE", seed: 6, baseH: 1, baseA: 0 },
  { home: "AC Marea", away: "Inter Valle", league: "Serie Demo", country: "IT", seed: 8, baseH: 0, baseA: 0 },
  { home: "Lyon Est", away: "Paris Nord", league: "Ligue Demo", country: "FR", seed: 4, baseH: 1, baseA: 2 }
];

// Pseudo-aleatorio determinista (sin Math.random) que evoluciona con el minuto.
function rnd(seed, salt) {
  var x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x); // 0..1
}

function getDemo() {
  var now = Date.now();
  return DEMO.map(function (m) {
    // El minuto avanza ~1 cada 10 s reales (loop 1–90) → movimiento visible.
    var minute = 1 + Math.floor((now / 10000 + m.seed * 7) % 90);
    var prog = minute / 90;

    // Reparto local/visitante con sesgo por seed.
    var bias = 0.4 + rnd(m.seed, 1) * 0.3;            // 0.4..0.7 a favor del local
    var mk = function (base, salt) {
      var total = Math.round(base * prog + rnd(m.seed, salt) * base * 0.4);
      var h = Math.round(total * bias);
      return { h: h, a: Math.max(0, total - h), t: total };
    };

    var shots = mk(24, 2);
    var sot = { h: Math.round(shots.h * 0.45), a: Math.round(shots.a * 0.45) };
    sot.t = sot.h + sot.a;
    var corners = mk(11, 3);
    var attacks = mk(120, 4);
    var datt = mk(55, 5);          // ataques peligrosos
    var possH = 40 + Math.round(rnd(m.seed, 6) * 25);  // 40..65%
    var yellow = Math.floor(prog * (2 + (m.seed % 3)));
    var red = (m.seed % 7 === 0 && minute > 60) ? 1 : 0;

    // Presión: onda lenta + ataques peligrosos recientes.
    var wave = Math.sin((now / 30000) + m.seed) * 0.5 + 0.5;
    var pScore = wave * 0.5 + Math.min(1, (datt.t + shots.t) / 60) * 0.5;
    var pressure = pScore > 0.66 ? "alta" : pScore > 0.4 ? "media" : "baja";
    var momentumHome = Math.round((bias) * pScore * 100);
    var momentumAway = Math.round((1 - bias) * pScore * 100);

    return {
      id: "demo-" + m.seed,
      league: m.league,
      country: m.country || "",
      home: m.home,
      away: m.away,
      scoreHome: m.baseH,
      scoreAway: m.baseA,
      minute: minute,
      status: "LIVE",
      // Totales (compatibilidad + motor)
      shots: shots.t,
      corners: corners.t,
      dangerous_attacks: datt.t,
      red_cards: red,
      yellow_cards: yellow,
      pressure: pressure,
      // Detalle local/visitante (scanner pro)
      possessionHome: possH, possessionAway: 100 - possH,
      shotsHome: shots.h, shotsAway: shots.a,
      sotHome: sot.h, sotAway: sot.a,
      cornersHome: corners.h, cornersAway: corners.a,
      attacksHome: attacks.h, attacksAway: attacks.a,
      dangerousHome: datt.h, dangerousAway: datt.a,
      momentumHome: momentumHome, momentumAway: momentumAway,
      signal: pressure === "alta" && corners.t >= 7
    };
  });
}

module.exports = { fetchLiveReal: fetchLiveReal, getDemo: getDemo, normalizeReal: normalizeReal };
