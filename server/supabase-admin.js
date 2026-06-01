"use strict";
/* ============================================================
   ValueGol — Acceso admin a Supabase (REST/PostgREST). Sin deps.
   Usa la SERVICE KEY (sb_secret_… / service_role) → omite RLS,
   solo en el backend. NUNCA en el frontend.
   Requiere SUPABASE_URL y SUPABASE_SERVICE_KEY.
   ============================================================ */

var URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
var KEY = process.env.SUPABASE_SERVICE_KEY || "";

function enabled() { return !!(URL && KEY); }

function headers(extra) {
  return Object.assign({
    apikey: KEY,
    Authorization: "Bearer " + KEY,
    "Content-Type": "application/json"
  }, extra || {});
}

async function rest(path, opts) {
  var res = await fetch(URL + "/rest/v1/" + path, opts || { headers: headers() });
  if (!res.ok) throw new Error("Supabase " + res.status + ": " + (await res.text()).slice(0, 200));
  if (res.status === 204) return null;
  var txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// Estrategias activas + chat_id de Telegram del dueño (embed por FK).
async function getEnabledStrategies() {
  return rest(
    "strategy?enabled=eq.true&select=id,user_id,name,definition,notify,profile(telegram_chat_id,plan)",
    { headers: headers() }
  );
}

// Guarda el chat_id de Telegram de un usuario y limpia el token de vinculación.
async function linkTelegram(userId, chatId) {
  return rest("profile?id=eq." + userId, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({ telegram_chat_id: String(chatId), tg_link_token: null })
  });
}

// Busca el usuario por token de vinculación temporal (guardado en profile).
async function findByLinkToken(token) {
  var rows = await rest(
    "profile?tg_link_token=eq." + encodeURIComponent(token) + "&select=id,email",
    { headers: headers() }
  );
  return rows && rows[0];
}

// Registra una alerta disparada.
async function insertAlert(row) {
  return rest("alert", {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(row)
  });
}

module.exports = {
  enabled: enabled,
  getEnabledStrategies: getEnabledStrategies,
  linkTelegram: linkTelegram,
  findByLinkToken: findByLinkToken,
  insertAlert: insertAlert
};
