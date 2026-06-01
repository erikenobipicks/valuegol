/* ============================================================
   PicksGuru — i18n (infraestructura multiidioma)
   Vanilla, sin dependencias.

   CÓMO AÑADIR UN IDIOMA (p. ej. inglés):
   1) Copia el objeto `es` completo dentro de `translations`
      como `en` y traduce SOLO los valores (no las claves).
   2) Añade su nombre en `LANGS` (p. ej. en: "English").
   3) Listo: el selector del header lo mostrará automáticamente.

   Notas:
   - Las claves que falten en un idioma CAEN al texto que ya
     hay en el HTML (fallback seguro: nunca se queda en blanco).
   - Para traducir un texto nuevo: añade  data-i18n="seccion.clave"
     al elemento en index.html y la clave aquí.
   - Para atributos (placeholder, aria-label):
     data-i18n-attr="placeholder:cf.email"
   ============================================================ */
(function () {
  "use strict";

  var DEFAULT = "es";
  var STORAGE = "pg_lang";

  // Nombre legible de cada idioma disponible.
  var LANGS = {
    es: "Español"
    // en: "English",
    // pt: "Português",
    // fr: "Français"
  };

  // Diccionarios. La clave es estable; el valor es el texto mostrado.
  var translations = {
    es: {
      "meta.title": "PicksGuru — Análisis de fútbol en directo y alertas por Telegram",
      "meta.description": "Crea estrategias personalizadas, analiza métricas de partidos en directo y recibe alertas automáticas por Telegram cuando un partido cumple tus condiciones. Prueba gratis.",

      "nav.how": "Cómo funciona",
      "nav.strategies": "Estrategias",
      "nav.scanner": "Scanner live",
      "nav.pricing": "Precios",
      "nav.faq": "FAQ",
      "nav.cta": "Probar gratis",

      "hero.eyebrow": "Análisis en directo · Tiempo real",
      "hero.title": "Detecta señales en partidos en directo antes de que sea tarde",
      "hero.sub": "Crea estrategias personalizadas, analiza métricas live y recibe alertas automáticas por Telegram cuando un partido cumple tus condiciones.",
      "hero.cta1": "Probar gratis",
      "hero.cta2": "Ver cómo funciona",
      "hero.trust1": "Sin tarjeta para empezar",
      "hero.trust2": "Cancela cuando quieras",
      "hero.trust3": "Alertas en segundos",

      "how.eyebrow": "Cómo funciona",
      "how.title": "De la idea a la alerta en tres pasos",
      "how.lead": "Configura una vez y deja que el sistema vigile cada partido por ti.",

      "tg.eyebrow": "Alertas por Telegram",
      "tg.title": "Las señales llegan donde ya estás",
      "tg.lead": "Nada de mirar la pantalla todo el día. Conecta tu Telegram en un minuto y recibe avisos claros y accionables en cuanto se cumple tu estrategia.",

      "st.eyebrow": "Estrategias personalizadas",
      "st.title": "Tus reglas, vigiladas automáticamente",
      "st.lead": "Construye condiciones tan simples o tan finas como quieras. Guárdalas, duplícalas y actívalas con un clic.",
      "st.advanced": "Estrategia avanzada · Goles 1ª parte",
      "st.more": "+ 8 condiciones más · % goles HT, tarjetas rojas…",

      "sc.eyebrow": "Scanner live",
      "sc.title": "Todos los partidos, una sola pantalla",
      "sc.lead": "Ordena por la métrica que te importa y detecta a simple vista dónde está pasando algo.",

      "mo.eyebrow": "Momentum del partido",
      "mo.title": "Mide quién está apretando, no solo el marcador",
      "mo.lead": "El indicador de presión combina ataques peligrosos, tiros y posesión reciente para mostrarte el impulso real de cada equipo, minuto a minuto.",

      "hi.eyebrow": "Histórico y datos",
      "hi.title": "Revisa, mide y exporta lo que importa",
      "hi.lead": "Cada alerta queda registrada. Analiza el rendimiento de tus estrategias y llévate los datos en un clic.",

      "ca.eyebrow": "Casos de uso",
      "ca.title": "Pensado para tu forma de seguir el fútbol",

      "te.eyebrow": "Lo que dicen",
      "te.title": "Usuarios que ya no se pierden una señal",

      "pr.eyebrow": "Precios",
      "pr.title": "Empieza gratis. Sube a Pro cuando lo necesites",
      "pr.lead": "Sin permanencia. Cancela cuando quieras.",
      "pr.per": "/mes",
      "pr.freedesc": "Para empezar a explorar el scanner.",
      "pr.freecta": "Probar gratis",
      "pr.popular": "Más popular",
      "pr.prodesc": "Para quien va en serio con el análisis.",
      "pr.procta": "Empezar con Pro",

      "fa.eyebrow": "FAQ",
      "fa.title": "Preguntas frecuentes",
      "fa.q1": "¿Necesito conocimientos técnicos para crear estrategias?",
      "fa.q2": "¿Las alertas llegan en tiempo real?",
      "fa.q3": "¿Qué necesito para recibir avisos por Telegram?",
      "fa.q4": "¿Puedo cancelar cuando quiera?",
      "fa.q5": "¿Esto garantiza ganancias?",

      "cf.title": "Empieza a detectar señales hoy mismo",
      "cf.text": "Crea tu primera estrategia gratis y recibe tu próxima alerta por Telegram.",
      "cf.email": "tu@email.com",
      "cf.btn": "Probar gratis",
      "cf.note": "Sin tarjeta. Cancela cuando quieras.",

      "fo.tag": "Análisis de fútbol en directo con alertas inteligentes por Telegram.",
      "fo.prod": "Producto",
      "fo.res": "Recursos",
      "fo.legal": "Legal",
      "fo.disclaimer": "Aviso: PicksGuru es una herramienta de análisis estadístico e información deportiva. No constituye consejo de apuesta ni de inversión y no garantiza resultados. Juega con responsabilidad. Solo para mayores de 18 años (+18).",
      "fo.copy": "PicksGuru. Todos los derechos reservados."
    }
  };

  // --- Motor --------------------------------------------------
  function available() { return Object.keys(translations); }

  function apply(lang) {
    var dict = translations[lang] || {};

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key] != null) el.textContent = dict[key];
    });

    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(",").forEach(function (pair) {
        var p = pair.split(":");
        if (p.length < 2) return;
        var attr = p[0].trim(), key = p[1].trim();
        if (dict[key] != null) el.setAttribute(attr, dict[key]);
      });
    });

    if (dict["meta.title"]) document.title = dict["meta.title"];
    var md = document.querySelector('meta[name="description"]');
    if (md && dict["meta.description"]) md.setAttribute("content", dict["meta.description"]);

    document.documentElement.lang = lang;
    try { localStorage.setItem(STORAGE, lang); } catch (e) {}

    document.querySelectorAll("[data-lang-btn]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang-btn") === lang));
    });
  }

  function init() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE); } catch (e) {}
    var lang = (saved && translations[saved]) ? saved : DEFAULT;

    var mount = document.querySelector("[data-lang-switcher]");
    if (mount) {
      available().forEach(function (code) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "lang__btn";
        btn.textContent = code.toUpperCase();
        btn.setAttribute("data-lang-btn", code);
        btn.setAttribute("aria-pressed", "false");
        btn.setAttribute("aria-label", "Cambiar idioma a " + (LANGS[code] || code));
        btn.addEventListener("click", function () { apply(code); });
        mount.appendChild(btn);
      });
    }
    apply(lang);
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
