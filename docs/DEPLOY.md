# ValueGol — Despliegue (Fase 1)

La app es un **único servicio Node sin dependencias** que sirve la landing y el
endpoint `/api/matches/live`. Funciona en **modo demo sin configurar nada** (datos que
se auto-actualizan) y pasa a **datos reales** cuando defines `APIFOOTBALL_KEY`.

## Ejecutar en local

```bash
# Node 18+ (probado en 24)
node server/server.js
# o
npm start
```
Abre http://localhost:3000 — el scanner ya late en modo demo.

Para datos reales: copia `.env.example` a `.env`, pon tu `APIFOOTBALL_KEY` y reinicia.

---

## Verlo online

### Opción recomendada — Render (corre el backend → scanner live real) ⭐

1. Sube el repo a GitHub (ver más abajo).
2. En [render.com](https://render.com) → **New → Web Service** → conecta el repo.
3. Configuración:
   - **Build Command:** *(vacío — no hay dependencias)*
   - **Start Command:** `node server/server.js`
   - **Environment:** añade `APIFOOTBALL_KEY` (opcional) y, si la pones,
     `POLL_INTERVAL=900000` para respetar el free tier (100 req/día).
4. Deploy. Render asigna una URL pública (`https://valuegol.onrender.com`).

> El plan free de Render "duerme" tras inactividad; la primera carga tras un rato
> tarda unos segundos en despertar. Normal en demos.

**Railway** y **Fly.io** funcionan igual: detectan `npm start` y arrancan el servicio.

### Opción rápida — GitHub Pages (solo estático, SIN backend)

GitHub Pages sirve la web pero **no ejecuta Node** → `/api/matches/live` no existe y el
scanner muestra las **filas de ejemplo estáticas** (no se actualiza solo). Útil para ver
el diseño, no la función live. Settings → Pages → Branch `main` / root.

---

## Subir a GitHub

```bash
git init
git add .
git commit -m "ValueGol: landing + backend Fase 1 (scanner live)"
git branch -M main
git remote add origin https://github.com/<usuario>/valuegol.git
git push -u origin main
```

`.env` está en `.gitignore` → **tu API key nunca se sube**.

---

## Qué falta para Fases siguientes
- Stats live por partido (tiros/córners/presión reales) → llamada extra a
  `/fixtures/statistics` (ver `docs/ARQUITECTURA.md` §6).
- Persistencia (Postgres), cuentas, builder de estrategias y motor de evaluación.
- Alertas Telegram y WebSocket en tiempo real.
