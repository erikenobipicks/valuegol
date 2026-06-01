"use strict";
/* ============================================================
   ValueGol — Cliente Telegram (Bot API). Sin dependencias.
   - sendMessage(chatId, html): envía una alerta.
   - pollUpdates(onMessage): long-poll de mensajes entrantes
     (para vincular cuentas: el usuario escribe /start al bot).
   Requiere TELEGRAM_BOT_TOKEN.
   ============================================================ */

var TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
var BASE = "https://api.telegram.org/bot";

function enabled() { return !!TOKEN; }

async function call(method, payload) {
  var res = await fetch(BASE + TOKEN + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  var json = await res.json();
  if (!json.ok) throw new Error("Telegram " + method + ": " + (json.description || res.status));
  return json.result;
}

async function sendMessage(chatId, html) {
  return call("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true
  });
}

/* Long-poll de mensajes entrantes. Llama onMessage({chatId, text, name}). */
function pollUpdates(onMessage) {
  if (!TOKEN) return;
  var offset = 0;
  async function loop() {
    try {
      var res = await fetch(BASE + TOKEN + "/getUpdates?timeout=30&offset=" + offset, { });
      var json = await res.json();
      if (json.ok) {
        for (var u of json.result) {
          offset = u.update_id + 1;
          var m = u.message;
          if (m && m.chat) {
            onMessage({
              chatId: m.chat.id,
              text: (m.text || "").trim(),
              name: m.chat.first_name || m.chat.username || "amigo"
            });
          }
        }
      }
    } catch (e) {
      // red intermitente → reintenta tras una pausa
      await new Promise(function (r) { setTimeout(r, 3000); });
    }
    loop();
  }
  loop();
}

module.exports = { enabled: enabled, sendMessage: sendMessage, pollUpdates: pollUpdates };
