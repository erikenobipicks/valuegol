"use strict";
/* ============================================================
   ValueGol — Backend Fase 1 (sin dependencias)
   - Sirve la landing estática (index.html, assets, …).
   - Expone GET /api/matches/live con el estado actual.
   - Poller en segundo plano: si hay APIFOOTBALL_KEY consulta el
     proveedor; si no (o si falla / no hay partidos), usa demo.

   Variables de entorno (ver .env.example):
     PORT             Puerto HTTP (def. 3000)
     APIFOOTBALL_KEY  API key de api-sports.io (opcional)
     POLL_INTERVAL    ms entre consultas al proveedor (def. 60000)
     FORCE_DEMO       "1" para forzar modo demo
   ============================================================ */

var http = require("http");
var fs = require("fs");
var path = require("path");
var provider = require("./provider");

// --- Mini-cargador de .env (sin dependencias) ---------------
(function loadEnv() {
  try {
    var envPath = path.join(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) return;
    fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith("#")) return;
      var key = m[1];
      var val = m[2].replace(/^["']|["']$/g, "");
      if (process.env[key] === undefined) process.env[key] = val;
    });
  } catch (e) { /* opcional */ }
})();

var PORT = parseInt(process.env.PORT, 10) || 3000;
var KEY = process.env.APIFOOTBALL_KEY || "";
var POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL, 10) || 60000;
var FORCE_DEMO = process.env.FORCE_DEMO === "1";
var ROOT = path.join(__dirname, "..");

// --- Estado en memoria (la "fuente de verdad" del scanner) --
var state = { matches: [], source: "demo", updatedAt: null, error: null };

async function refresh() {
  if (KEY && !FORCE_DEMO) {
    try {
      var live = await provider.fetchLiveReal(KEY);
      if (live && live.length) {
        state = { matches: live, source: "live", updatedAt: Date.now(), error: null };
        return;
      }
      // Sin partidos en directo ahora mismo → demo etiquetada.
      state = { matches: provider.getDemo(), source: "demo:no-live", updatedAt: Date.now(), error: null };
      return;
    } catch (err) {
      state = { matches: provider.getDemo(), source: "demo:error", updatedAt: Date.now(), error: String(err.message || err) };
      return;
    }
  }
  state = { matches: provider.getDemo(), source: "demo", updatedAt: Date.now(), error: null };
}

// --- Servidor de estáticos (con protección de path traversal)
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

function serveStatic(req, res) {
  var urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  var filePath = path.join(ROOT, urlPath);

  // Evita salir de ROOT.
  if (filePath.indexOf(ROOT) !== 0) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

var server = http.createServer(function (req, res) {
  if (req.url.split("?")[0] === "/api/matches/live") {
    // Datos reales → se sirven cacheados (no gastar cuota del proveedor).
    // Modo demo → se regeneran en cada petición para verse continuamente vivos.
    var isLive = state.source.indexOf("live") === 0;
    var matches = isLive ? state.matches : provider.getDemo();
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(JSON.stringify({
      source: state.source,
      updatedAt: isLive ? state.updatedAt : Date.now(),
      count: matches.length,
      matches: matches
    }));
    return;
  }
  if (req.url.split("?")[0] === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, source: state.source, hasKey: !!KEY }));
    return;
  }
  serveStatic(req, res);
});

// --- Arranque -----------------------------------------------
refresh().then(function () {
  setInterval(refresh, POLL_INTERVAL);
  server.listen(PORT, function () {
    var mode = (KEY && !FORCE_DEMO) ? "API-Football (key detectada)" : "DEMO";
    console.log("ValueGol backend en http://localhost:" + PORT + "  ·  modo: " + mode);
    console.log("Scanner API: http://localhost:" + PORT + "/api/matches/live");
  });
});
