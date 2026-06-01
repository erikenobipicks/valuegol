"use strict";
/* ============================================================
   ValueGol — Evaluador en vivo
   En cada tick: construye el contexto de cada partido, evalúa
   las estrategias activas con el motor, y dispara alertas
   (Telegram + registro) con anti-spam por estrategia+partido.

   Nota Fase 2: el feed actual (demo/básico) solo aporta métricas
   LIVE. Las condiciones de histórico/cuotas se resuelven como
   "missing" → no disparan (a prueba de fallos) hasta que conectemos
   esos feeds (ver docs/ARQUITECTURA.md §6).
   ============================================================ */

var engine = require("./engine");
var telegram = require("./telegram");
var admin = require("./supabase-admin");

var COOLDOWN_MS = 10 * 60 * 1000;   // no re-alertar el mismo partido/estrategia en 10 min
var FETCH_EVERY = 60 * 1000;        // refrescar estrategias cada 60 s
var cooldown = {};
var strategiesCache = [];
var lastFetch = 0;

function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

// Mapea el snapshot del partido al contexto que entiende el motor.
function buildContext(m) {
  var pressureNum = m.pressure === "alta" ? 80 : m.pressure === "media" ? 50 : m.pressure === "baja" ? 20 : undefined;
  return {
    live: {
      shots_on_target: m.shots,
      corners: m.corners,
      dangerous_attacks: m.dangerous_attacks,
      goals_at_ht: (m.minute != null && m.minute <= 45) ? ((m.scoreHome || 0) + (m.scoreAway || 0)) : undefined,
      red_cards: m.red_cards,
      momentum: pressureNum
    },
    odds: {},       // sin feed de cuotas todavía
    historico: {}   // sin precálculo todavía
  };
}

async function refreshStrategies(now) {
  if (!admin.enabled()) return;
  if (strategiesCache.length && now - lastFetch < FETCH_EVERY) return;
  try {
    strategiesCache = (await admin.getEnabledStrategies()) || [];
    lastFetch = now;
  } catch (e) {
    console.error("[eval] no pude leer estrategias:", e.message);
  }
}

function formatAlert(s, m) {
  return "⚡ <b>Señal — " + esc(s.name) + "</b>\n" +
    esc(m.home) + " <b>" + (m.scoreHome || 0) + "–" + (m.scoreAway || 0) + "</b> " + esc(m.away) +
    (m.minute != null ? " · " + m.minute + "'" : "") + "\n" +
    "🏆 " + esc(m.league || "—");
}

async function fireAlert(s, m) {
  var chatId = s.profile && s.profile.telegram_chat_id;
  var delivered = {};
  try {
    if (chatId && s.notify && s.notify.telegram && telegram.enabled()) {
      await telegram.sendMessage(chatId, formatAlert(s, m));
      delivered.telegram = "ok";
    } else {
      delivered.telegram = chatId ? "telegram-off" : "sin-chat";
    }
  } catch (e) { delivered.telegram = "error: " + e.message; }

  try {
    await admin.insertAlert({
      strategy_id: s.id, user_id: s.user_id, match_id: String(m.id),
      snapshot: { match: m }, delivered: delivered
    });
  } catch (e) { console.error("[eval] no pude registrar alerta:", e.message); }

  console.log("[eval] SEÑAL:", s.name, "→", m.home, "vs", m.away, "| telegram:", delivered.telegram);
}

async function evaluateTick(matches, now) {
  await refreshStrategies(now);
  if (!strategiesCache.length) return;
  for (var m of matches) {
    var ctx = buildContext(m);
    for (var s of strategiesCache) {
      var r;
      try { r = engine.evaluateStrategy(s.definition, ctx); } catch (e) { continue; }
      if (!r.pass) continue;
      var key = s.id + ":" + m.id;
      if (cooldown[key] && now - cooldown[key] < COOLDOWN_MS) continue;
      cooldown[key] = now;
      fireAlert(s, m); // fire-and-forget
    }
  }
}

module.exports = { evaluateTick: evaluateTick, buildContext: buildContext };
