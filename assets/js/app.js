/* ============================================================
   ValueGol — App (panel autenticado)
   Auth + CRUD de estrategias + builder visual, sobre Supabase.
   ES module. Cliente Supabase desde CDN (sin build).
   ============================================================ */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

let catalog = [];          // filas de metric_catalog
let catalogByKey = {};     // key -> fila
let editingId = null;      // estrategia en edición

// ---------- Helpers de UI ----------
function msg(el, text, kind) {
  el.textContent = text || "";
  el.className = "auth-msg" + (kind ? " " + kind : "");
}

// ============================================================
// AUTH
// ============================================================
const authView = $("#auth-view");
const appView = $("#app-view");
const userbar = $("#userbar");

sb.auth.onAuthStateChange((_e, session) => render(session));
sb.auth.getSession().then(({ data }) => render(data.session));

function render(session) {
  if (session) {
    authView.hidden = true;
    appView.hidden = false;
    userbar.hidden = false;
    $("#user-email").textContent = session.user.email;
    loadCatalog().then(loadStrategies);
    loadTelegram(session.user.id);
  } else {
    authView.hidden = false;
    appView.hidden = true;
    userbar.hidden = true;
  }
}

$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await login();
});
$("#btn-signup").addEventListener("click", signup);
$("#btn-logout").addEventListener("click", () => sb.auth.signOut());

function creds() {
  return { email: $("#email").value.trim(), password: $("#password").value };
}

async function login() {
  const m = $("#auth-msg");
  const { email, password } = creds();
  if (!email || !password) return msg(m, "Introduce email y contraseña.", "err");
  msg(m, "Entrando…");
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) msg(m, traducir(error.message), "err");
}

async function signup() {
  const m = $("#auth-msg");
  const { email, password } = creds();
  if (!email || password.length < 6) return msg(m, "Email válido y contraseña de 6+ caracteres.", "err");
  msg(m, "Creando cuenta…");
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return msg(m, traducir(error.message), "err");
  if (!data.session) msg(m, "Cuenta creada. Revisa tu email para confirmar y luego entra.", "ok");
  else msg(m, "¡Cuenta creada!", "ok");
}

function traducir(s) {
  if (/Invalid login/i.test(s)) return "Email o contraseña incorrectos.";
  if (/already registered/i.test(s)) return "Ese email ya tiene cuenta. Inicia sesión.";
  if (/confirm/i.test(s)) return "Confirma tu email antes de entrar.";
  return s;
}

// ============================================================
// CATÁLOGO DE MÉTRICAS
// ============================================================
async function loadCatalog() {
  if (catalog.length) return;
  const { data, error } = await sb.from("metric_catalog").select("*").order("category");
  if (error) { console.error(error); return; }
  catalog = data;
  catalogByKey = Object.fromEntries(data.map((m) => [m.key, m]));
}

function metricOptions(selected) {
  const groups = { historico: "Histórico", odds: "Cuotas", live: "En directo" };
  let html = "";
  for (const cat of Object.keys(groups)) {
    const items = catalog.filter((m) => m.category === cat);
    if (!items.length) continue;
    html += `<optgroup label="${groups[cat]}">`;
    for (const m of items) {
      html += `<option value="${m.key}" ${m.key === selected ? "selected" : ""}>${m.label}</option>`;
    }
    html += `</optgroup>`;
  }
  return html;
}

// ============================================================
// CONECTAR TELEGRAM
// ============================================================
let tgBot = null;     // username del bot (desde /api/config)
let tgPoll = null;    // intervalo de sondeo tras pulsar conectar

async function loadTelegram(userId) {
  const card = $("#tg-card");
  // username del bot (si el backend lo expone)
  try { tgBot = (await (await fetch("/api/config")).json()).telegramBot; } catch (e) { tgBot = null; }

  const { data } = await sb.from("profile").select("telegram_chat_id").eq("id", userId).single();
  const linked = !!(data && data.telegram_chat_id);
  card.hidden = false;
  card.classList.toggle("is-linked", linked);

  if (linked) {
    $("#tg-title").textContent = "Telegram conectado ✅";
    $("#tg-sub").textContent = "Recibirás tus alertas en tu chat.";
    $("#btn-tg").textContent = "Desconectar";
    $("#btn-tg").onclick = async () => {
      await sb.from("profile").update({ telegram_chat_id: null }).eq("id", userId);
      loadTelegram(userId);
    };
  } else {
    $("#tg-title").textContent = "Conecta Telegram";
    $("#tg-sub").textContent = tgBot ? "Recibe tus alertas al instante en tu móvil." : "Pendiente: el bot aún no está configurado en el servidor.";
    $("#btn-tg").textContent = "Conectar Telegram";
    $("#btn-tg").disabled = !tgBot;
    $("#btn-tg").onclick = () => connectTelegram(userId);
  }
}

async function connectTelegram(userId) {
  if (!tgBot) return;
  const token = (crypto.randomUUID && crypto.randomUUID()) || ("t" + Date.now() + Math.random().toString(36).slice(2));
  await sb.from("profile").update({ tg_link_token: token }).eq("id", userId);
  window.open(`https://t.me/${tgBot}?start=${token}`, "_blank");
  // sondea hasta que el backend vincule el chat_id (máx ~2 min)
  $("#tg-sub").textContent = "Abre el chat y pulsa Iniciar / Start…";
  if (tgPoll) clearInterval(tgPoll);
  let tries = 0;
  tgPoll = setInterval(async () => {
    tries++;
    const { data } = await sb.from("profile").select("telegram_chat_id").eq("id", userId).single();
    if ((data && data.telegram_chat_id) || tries > 40) {
      clearInterval(tgPoll); tgPoll = null;
      loadTelegram(userId);
    }
  }, 3000);
}

// ============================================================
// LISTA DE ESTRATEGIAS
// ============================================================
async function loadStrategies() {
  const list = $("#strategy-list");
  const empty = $("#list-empty");
  const { data, error } = await sb.from("strategy").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return; }
  $$(".strategy-item", list).forEach((n) => n.remove());
  empty.hidden = data.length > 0;
  for (const s of data) list.appendChild(strategyCard(s));
}

function strategyCard(s) {
  const n = (s.definition && s.definition.conditions) ? s.definition.conditions.length : 0;
  const el = document.createElement("div");
  el.className = "card strategy-item";
  el.innerHTML = `
    <div class="strategy-item__info">
      <div class="strategy-item__name"></div>
      <div class="strategy-item__meta">${n} condición${n === 1 ? "" : "es"} · ${s.definition?.logic || "AND"} · ${s.notify?.telegram ? "Telegram ✓" : "sin alerta"}</div>
    </div>
    <div class="strategy-item__actions">
      <button class="toggle" type="button" aria-pressed="${!!s.enabled}" aria-label="Activar"></button>
      <button class="btn btn--ghost btn--sm c-edit" type="button">Editar</button>
      <button class="icon-btn c-del" type="button" aria-label="Eliminar">🗑</button>
    </div>`;
  $(".strategy-item__name", el).textContent = s.name;
  $(".toggle", el).addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    const next = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(next));
    await sb.from("strategy").update({ enabled: next }).eq("id", s.id);
  });
  $(".c-edit", el).addEventListener("click", () => openBuilder(s));
  $(".c-del", el).addEventListener("click", async () => {
    if (!confirm(`¿Eliminar "${s.name}"?`)) return;
    await sb.from("strategy").delete().eq("id", s.id);
    loadStrategies();
  });
  return el;
}

// ============================================================
// BUILDER
// ============================================================
const builder = $("#builder");
$("#btn-new").addEventListener("click", () => openBuilder(null));
$("#builder-close").addEventListener("click", closeBuilder);
$("#builder-cancel").addEventListener("click", closeBuilder);
$("#add-simple").addEventListener("click", () => addCondition("simple"));
$("#add-derived").addEventListener("click", () => addCondition("derived"));
$("#builder-save").addEventListener("click", saveStrategy);

function openBuilder(s) {
  editingId = s ? s.id : null;
  $("#builder-title").textContent = s ? "Editar estrategia" : "Nueva estrategia";
  $("#s-name").value = s ? s.name : "";
  $("#s-logic").value = s?.definition?.logic || "AND";
  $("#s-telegram").checked = s ? !!s.notify?.telegram : true;
  $("#conditions").innerHTML = "";
  msg($("#builder-msg"), "");
  const conds = s?.definition?.conditions || [];
  if (conds.length) conds.forEach((c) => addCondition(c.expr ? "derived" : "simple", c));
  else addCondition("simple");
  builder.hidden = false;
}
function closeBuilder() { builder.hidden = true; msg($("#builder-msg"), ""); }

// --- Sub-controles de "spec de métrica" (metric + window + venue + team) ---
function specHTML(suffix, spec = {}) {
  return `
    <select class="c-metric${suffix}">${metricOptions(spec.metric)}</select>
    <select class="c-window${suffix}" aria-label="Ventana">
      <option value="">ventana…</option>
      <option value="5" ${spec.window == 5 ? "selected" : ""}>últ. 5</option>
      <option value="10" ${spec.window == 10 ? "selected" : ""}>últ. 10</option>
    </select>
    <select class="c-venue${suffix}" aria-label="Localía">
      <option value="overall" ${spec.venue === "overall" ? "selected" : ""}>global</option>
      <option value="home" ${spec.venue === "home" ? "selected" : ""}>en casa</option>
      <option value="away" ${spec.venue === "away" ? "selected" : ""}>fuera</option>
    </select>
    <select class="c-team${suffix}" aria-label="Equipo">
      <option value="home" ${spec.team !== "away" ? "selected" : ""}>local</option>
      <option value="away" ${spec.team === "away" ? "selected" : ""}>visitante</option>
    </select>`;
}

const OPS = [">=", "<=", ">", "<", "="];
function opHTML(sel) {
  return OPS.map((o) => `<option ${o === sel ? "selected" : ""}>${o}</option>`).join("");
}

function addCondition(kind, c = {}) {
  const box = document.createElement("div");
  box.className = "cond";
  box.dataset.kind = kind;

  if (kind === "derived") {
    box.innerHTML = `
      <div class="cond__head"><span class="cond__tag cond__tag--historico">Derivada (A ± B)</span><button class="cond__remove" type="button" aria-label="Quitar">✕</button></div>
      <div class="cond__row">${specHTML("-a", c.expr?.left)}</div>
      <div class="cond__row">
        <select class="c-oper" aria-label="Operación" style="flex:0 0 64px">
          <option value="+" ${c.expr?.operator !== "-" ? "selected" : ""}>+</option>
          <option value="-" ${c.expr?.operator === "-" ? "selected" : ""}>−</option>
        </select>
        ${specHTML("-b", c.expr?.right)}
      </div>
      <div class="cond__row">
        <select class="cond__op c-op">${opHTML(c.op)}</select>
        <input class="cond__val c-val" type="number" step="any" placeholder="valor" value="${c.value ?? ""}">
      </div>`;
  } else {
    box.innerHTML = `
      <div class="cond__head"><span class="cond__tag"></span><button class="cond__remove" type="button" aria-label="Quitar">✕</button></div>
      <div class="cond__row">
        ${specHTML("", c)}
        <select class="cond__op c-op">${opHTML(c.op)}</select>
        <input class="cond__val c-val" type="number" step="any" placeholder="valor" value="${c.value ?? ""}">
      </div>`;
  }

  $(".cond__remove", box).addEventListener("click", () => box.remove());
  // refresco según categoría de la métrica
  $$(".c-metric, .c-metric-a, .c-metric-b", box).forEach((sel) => {
    sel.addEventListener("change", () => refreshSpec(box));
  });
  $("#conditions").appendChild(box);
  refreshSpec(box);
}

// Muestra/oculta ventana/localía/equipo según la categoría de la métrica.
function refreshSpec(box) {
  const kind = box.dataset.kind;
  const apply = (suffix) => {
    const metricSel = $(".c-metric" + suffix, box);
    if (!metricSel) return;
    const cat = catalogByKey[metricSel.value]?.category;
    const show = cat === "historico";
    [".c-window", ".c-venue", ".c-team"].forEach((c) => {
      const el = $(c + suffix, box);
      if (el) el.style.display = show ? "" : "none";
    });
    return cat;
  };
  if (kind === "derived") { apply("-a"); apply("-b"); }
  else {
    const cat = apply("");
    const tag = $(".cond__tag", box);
    const names = { historico: ["Histórico", "historico"], odds: ["Cuota", "odds"], live: ["En directo", "live"] };
    const t = names[cat] || ["", ""];
    if (tag) { tag.textContent = t[0]; tag.className = "cond__tag cond__tag--" + t[1]; }
  }
}

// --- Recolectar la definición desde el DOM ---
function readSpec(box, suffix) {
  const metric = $(".c-metric" + suffix, box).value;
  const cat = catalogByKey[metric]?.category;
  const agg = (catalogByKey[metric]?.supports?.agg || [])[0] || "value";
  const spec = { metric, agg };
  if (cat === "historico") {
    const w = $(".c-window" + suffix, box).value;
    if (w) spec.window = Number(w);
    spec.venue = $(".c-venue" + suffix, box).value;
    spec.team = $(".c-team" + suffix, box).value;
  }
  return spec;
}

function collect() {
  const conditions = [];
  for (const box of $$(".cond", $("#conditions"))) {
    const op = $(".c-op", box).value;
    const value = Number($(".c-val", box).value);
    if (Number.isNaN(value)) throw new Error("Hay una condición sin valor numérico.");
    if (box.dataset.kind === "derived") {
      conditions.push({ expr: { left: readSpec(box, "-a"), operator: $(".c-oper", box).value, right: readSpec(box, "-b") }, op, value });
    } else {
      conditions.push(Object.assign(readSpec(box, ""), { op, value }));
    }
  }
  return { logic: $("#s-logic").value, conditions };
}

async function saveStrategy() {
  const m = $("#builder-msg");
  const name = $("#s-name").value.trim();
  if (!name) return msg(m, "Ponle un nombre a la estrategia.", "err");
  let definition;
  try { definition = collect(); } catch (e) { return msg(m, e.message, "err"); }
  if (!definition.conditions.length) return msg(m, "Añade al menos una condición.", "err");

  const { data: { session } } = await sb.auth.getSession();
  if (!session) return msg(m, "Tu sesión ha caducado. Vuelve a entrar.", "err");
  const payload = {
    user_id: session.user.id,
    name,
    definition,
    notify: { telegram: $("#s-telegram").checked },
  };

  const btn = $("#builder-save");
  btn.disabled = true;                       // evita doble clic
  msg(m, "Guardando…");

  const query = editingId
    ? sb.from("strategy").update(payload).eq("id", editingId)
    : sb.from("strategy").insert(payload);
  // Timeout de seguridad: si la red se cuelga, no nos quedamos en "Guardando…" para siempre.
  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve({ error: { message: "La conexión tardó demasiado. Reintenta." } }), 12000)
  );
  const res = await Promise.race([query, timeout]).catch((e) => ({ error: { message: e.message || "Error al guardar." } }));

  btn.disabled = false;
  if (res && res.error) return msg(m, res.error.message, "err");
  closeBuilder();
  loadStrategies();
}
