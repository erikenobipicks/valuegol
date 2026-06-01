# ValueGol — Documento de Arquitectura Técnica

> Estado: **borrador v1** · Alcance: plataforma de análisis de fútbol en directo con
> scanner live, estrategias personalizadas y alertas por Telegram.
> Este documento describe el **sistema completo** (backend + tiempo real + datos),
> no la landing estática actual (que es solo el escaparate).

---

## 1. Objetivo y principios

**Objetivo:** detectar, en partidos en directo, situaciones que cumplen las reglas
definidas por el usuario y avisarle al instante (Telegram) y en el scanner (web).

**Principios de diseño:**
1. **El navegador nunca habla con el proveedor de datos.** Todo pasa por nuestro backend (protege la API key, controla coste y rate limits).
2. **Una sola fuente de verdad del estado live** (cache en memoria) que alimenta a la vez al scanner, al motor de estrategias y a las alertas.
3. **El modelo de estrategia es declarativo (JSON).** El motor lo interpreta; añadir métricas no requiere reprogramar el motor.
4. **Empezar barato y validar.** Free tier de datos + polling antes de invertir en feeds premium y WebSocket.
5. **La landing ya mapea 1:1 con las entidades reales** → migración incremental.

---

## 2. Vista de alto nivel

```
┌─────────────────┐     poll/push      ┌──────────────────────────────────────┐
│  Proveedor de   │ ─────────────────► │            BACKEND                    │
│  datos (API)    │                    │                                       │
│  - live events  │                    │  ┌─────────────┐   ┌───────────────┐  │
│  - stats        │                    │  │  Ingesta    │──►│ Normalizador  │  │
│  - históricos   │                    │  │ (worker)    │   │ (a modelo PG) │  │
│  - cuotas       │                    │  └─────────────┘   └──────┬────────┘  │
└─────────────────┘                    │                          │           │
                                       │   ┌──────────────────────▼────────┐  │
┌─────────────────┐                    │   │  Estado live (Redis)          │  │
│ Telegram Bot    │ ◄───── alertas ────┤   │  match:{id} = stats actuales  │  │
│ API             │                    │   └──────────┬────────────────────┘  │
└─────────────────┘                    │              │                       │
        ▲                              │   ┌──────────▼────────────────────┐  │
        │                              │   │  Motor de estrategias         │  │
        │ push alerta                  │   │  (evalúa reglas cada tick)    │  │
        └──────────────────────────────┤   └──────────┬────────────────────┘  │
                                       │              │ match update / signal  │
┌─────────────────┐   WebSocket / SSE  │   ┌──────────▼────────────────────┐  │
│   Navegador     │ ◄──────────────────┤   │  Gateway tiempo real (WS)     │  │
│  (scanner web)  │                    │   └───────────────────────────────┘  │
└─────────────────┘                    │   ┌───────────────────────────────┐  │
        │  REST (login, CRUD reglas)   │   │  API REST (Fastify)           │  │
        └──────────────────────────────┤   └──────────┬────────────────────┘  │
                                       │              │                       │
                                       │   ┌──────────▼────────────────────┐  │
                                       │   │  Postgres (Supabase)          │  │
                                       │   │  usuarios, estrategias,       │  │
                                       │   │  históricos, alertas, planes  │  │
                                       │   └───────────────────────────────┘  │
                                       └──────────────────────────────────────┘
```

---

## 3. Componentes

| Componente | Responsabilidad | Tecnología sugerida |
|---|---|---|
| **Ingesta (worker)** | Poll/subscribe al proveedor; trae partidos live, stats, cuotas, históricos | Node.js worker + cron/loop |
| **Normalizador** | Convierte la respuesta del proveedor a nuestro modelo interno | Capa de mapeo por proveedor (adapter) |
| **Estado live** | Snapshot actual de cada partido en memoria (lectura rápida) | Redis |
| **Motor de estrategias** | Evalúa cada estrategia activa contra cada partido en cada tick | Node.js (módulo `engine`) |
| **Gateway tiempo real** | Empuja cambios al navegador | WebSocket (o Supabase Realtime / SSE) |
| **API REST** | Auth, CRUD de estrategias, histórico, planes | Fastify |
| **Bot Telegram** | Envía alertas, gestiona vinculación de cuenta | grammY / node-telegram-bot-api |
| **Base de datos** | Persistencia (usuarios, reglas, alertas, históricos) | Postgres (Supabase) |
| **Billing** | Planes Free/Pro, gating de features | Stripe |

---

## 4. Modelo de datos (Postgres)

Esquema mínimo viable. Tipos simplificados.

```sql
-- Usuarios (Supabase Auth gestiona auth.users; perfil propio aquí)
profile (
  id              uuid primary key,        -- = auth.users.id
  email           text,
  plan            text default 'free',     -- 'free' | 'pro'
  telegram_chat_id text,                    -- null hasta vincular el bot
  created_at      timestamptz default now()
)

-- Estrategias del usuario
strategy (
  id          uuid primary key,
  user_id     uuid references profile(id),
  name        text not null,
  enabled     boolean default true,
  scope       text default 'live',         -- 'live' | 'prematch'
  logic       text default 'AND',          -- 'AND' | 'OR' (raíz)
  definition  jsonb not null,              -- árbol de condiciones (ver §5)
  notify      jsonb default '{"telegram":true}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
)

-- Catálogo de métricas disponibles (dirige el editor visual)
metric_catalog (
  key         text primary key,            -- 'fh_goals_for'
  label       text,                        -- 'Goles 1ª parte marcados'
  category    text,                        -- 'historico' | 'odds' | 'live'
  unit        text,                        -- 'goles' | 'pct' | 'odd' | 'count'
  supports    jsonb                        -- ventanas/venue/agregaciones válidas
)

-- Partidos
match (
  id          text primary key,            -- id del proveedor
  league_id   text,
  home_team   text,
  away_team   text,
  status      text,                        -- 'NS' | 'LIVE' | '1H' | 'HT' | '2H' | 'FT'
  minute      int,
  score_home  int,
  score_away  int,
  kickoff_at  timestamptz,
  updated_at  timestamptz
)

-- Snapshot de stats live (también cacheado en Redis; PG = histórico/auditoría)
match_stat (
  match_id    text references match(id),
  ts          timestamptz,
  payload     jsonb,                       -- tiros, córners, ataques, posesión...
  primary key (match_id, ts)
)

-- Stats históricas pre-calculadas por equipo (para condiciones tipo "media últ. 10")
team_form (
  team_id     text,
  venue       text,                        -- 'home' | 'away' | 'overall'
  window      int,                         -- 5 | 10
  metrics     jsonb,                       -- {fh_goals_for_avg:0.6, ht05_pct:70,...}
  computed_at timestamptz,
  primary key (team_id, venue, window)
)

-- Cuotas pre-partido por mercado
odds (
  match_id    text references match(id),
  market      text,                        -- 'fh_over_0_5' | 'fh_over_1_5'
  value       numeric,
  updated_at  timestamptz,
  primary key (match_id, market)
)

-- Alertas disparadas (histórico + export CSV)
alert (
  id          uuid primary key,
  strategy_id uuid references strategy(id),
  match_id    text references match(id),
  fired_at    timestamptz default now(),
  snapshot    jsonb,                       -- estado del partido al disparar
  delivered   jsonb                        -- {telegram:'ok', ts:...}
)
```

---

## 5. Modelo de estrategia (el corazón del sistema)

Una estrategia es un **árbol declarativo** de condiciones. Cada condición es:

```
condición = {
  metric:   "<clave del catálogo>",
  agg:      "avg" | "pct" | "value" | "count",
  window:   5 | 10 | null,                 // nº de partidos (histórico)
  venue:    "home" | "away" | "overall" | null,
  team:     "home" | "away" | null,        // ¿de qué equipo del partido?
  op:       ">=" | "<=" | ">" | "<" | "=" | "between",
  value:    number | [min,max]
}
```

Y soporta **condiciones derivadas** (suma/resta de dos métricas):

```
derivada = {
  expr: { left:<condición-métrica>, operator:"+"|"-", right:<condición-métrica> },
  op:   ">=", value: 1.6
}
```

### 5.1 Tu estrategia real, serializada

Tu caso (`Goles 1ª parte`, 12 condiciones, todas AND) queda así en `strategy.definition`:

```json
{
  "logic": "AND",
  "conditions": [
    { "metric":"fh_goals_for",  "agg":"avg", "window":10, "venue":"home", "team":"home", "op":">=", "value":0.6 },
    { "metric":"fh_goals_against","agg":"avg","window":10, "venue":"away", "team":"away", "op":">=", "value":0.7 },

    { "expr": {
        "left":  { "metric":"fh_goals_for",   "agg":"avg","window":10,"venue":"home","team":"home" },
        "operator":"+",
        "right": { "metric":"fh_goals_against","agg":"avg","window":10,"venue":"away","team":"away" }
      }, "op":">=", "value":1.6 },

    { "metric":"odds_fh_over_0_5", "agg":"value", "op":"<", "value":1.25 },

    { "metric":"ht05_pct", "agg":"pct", "window":10, "venue":"home", "team":"home", "op":">=", "value":70 },
    { "metric":"ht05_pct", "agg":"pct", "window":10, "venue":"away", "team":"away", "op":">=", "value":70 },

    { "metric":"odds_fh_over_1_5", "agg":"value", "op":">=", "value":1.7 },

    { "expr": {
        "left":  { "metric":"fh_goals_against","agg":"avg","window":10,"venue":"home","team":"home" },
        "operator":"+",
        "right": { "metric":"fh_goals_for",    "agg":"avg","window":10,"venue":"away","team":"away" }
      }, "op":">=", "value":1.8 },

    { "metric":"ht05_pct", "agg":"pct", "window":5, "venue":"home", "team":"home", "op":">=", "value":60 },
    { "metric":"ht05_pct", "agg":"pct", "window":5, "venue":"away", "team":"away", "op":">=", "value":60 },

    { "metric":"goals_at_ht", "agg":"value", "scope":"live", "op":"<=", "value":1 },
    { "metric":"red_cards",   "agg":"value", "scope":"live", "op":"=",  "value":0 }
  ]
}
```

> Observa que **3 fuentes** conviven: histórico (`team_form`), cuotas (`odds`) y live
> (`match_stat`). El motor resuelve cada métrica desde su origen. Por eso el modelo
> de datos separa esas tablas.

### 5.2 Catálogo de métricas (extracto)

| key | label | category | agg válidas |
|---|---|---|---|
| `fh_goals_for` | Goles 1ª parte marcados | historico | avg |
| `fh_goals_against` | Goles 1ª parte encajados | historico | avg |
| `ht05_pct` | % partidos con 0.5+ goles al descanso | historico | pct |
| `odds_fh_over_0_5` | Cuota 1ª parte Over 0.5 | odds | value |
| `odds_fh_over_1_5` | Cuota 1ª parte Over 1.5 | odds | value |
| `goals_at_ht` | Goles al descanso (actual) | live | value |
| `red_cards` | Tarjetas rojas (actual) | live | value |
| `shots_on_target` | Tiros a puerta | live | value |
| `corners` | Córners | live | value |
| `dangerous_attacks` | Ataques peligrosos | live | value |
| `momentum` | Índice de presión (derivado) | live | value |

El editor visual de la web se **genera desde este catálogo**: así añadir una métrica
es insertar una fila, no tocar el frontend.

---

## 6. Motor de evaluación

**Bucle por tick** (cada N segundos, N según el plan de datos):

```
for cada partido P en estado live:
    actualiza snapshot de P en Redis (desde ingesta)
    candidatas = estrategias activas cuyo scope/ligas aplican a P
    for cada estrategia S en candidatas:
        resultado = evalúa(S.definition, contexto(P))
        if resultado == true y no hay alerta reciente (anti-spam):
            crea alert, encola entrega Telegram, emite señal por WebSocket
```

**`evalúa(nodo, ctx)`** (recursivo):
- Nodo lógico (`AND`/`OR`) → combina hijos.
- Condición métrica → resuelve el valor:
  - `category=live` → lee de Redis (`match:{id}`).
  - `category=historico` → lee de `team_form` (precalculado).
  - `category=odds` → lee de `odds`.
- Condición derivada (`expr`) → resuelve `left` y `right` y aplica el operador.
- Aplica `op`/`value` y devuelve booleano.

**Optimizaciones clave** (para que escale con muchos usuarios × partidos):
- **Indexar reglas por métrica/liga**: solo evalúa estrategias que pueden disparar para ese partido.
- **Precálculo de `team_form`**: las medias históricas no cambian durante el partido → se calculan 1 vez al inicio.
- **Cortocircuito AND/OR**: en cuanto una condición AND falla, se descarta.
- **Anti-spam / histéresis**: una alerta por estrategia+partido por ventana de tiempo (p. ej. no re-alertar en 5 min).
- **Cache de resultados de condición** dentro del mismo tick.

Coste aproximado a vigilar: `nº partidos_live × nº estrategias_activas × nº condiciones`.
Con indexado, en la práctica solo evalúas un subconjunto pequeño por tick.

---

## 7. Indicador de momentum (diferenciador)

Se **calcula server-side**, no viene del proveedor. Ventana móvil (p. ej. últimos 5–10 min):

```
momentum_local = w1*ataques_peligrosos + w2*tiros + w3*posesión_reciente + w4*córners
```
- Se normaliza 0–100 por equipo y se guarda en el snapshot.
- Se expone como métrica `momentum` (usable en estrategias) y como serie para el gráfico.
- Los pesos `w*` son configurables → permite calibrar el indicador.

---

## 8. Tiempo real (web)

Dos modos, según fase:

| Modo | Cuándo | Pros / Contras |
|---|---|---|
| **Polling** (front hace `fetch` cada N s) | MVP / Fase 1 | Simple; más peticiones; latencia = intervalo |
| **WebSocket / SSE** (servidor empuja) | Fase 3 | Tiempo real; menos tráfico; algo más de infra |

**Contrato de mensajes (WebSocket):**
```json
{ "type":"match_update", "match": { "id":"123", "minute":78, "stats":{...}, "momentum":{...} } }
{ "type":"signal", "strategyId":"...", "matchId":"123", "condition":"Presión alta + córners" }
```
El frontend actual ya tiene la tabla del scanner y el gráfico; conectar el WS es
sustituir el render estático por un handler de estos mensajes.

> **Supabase Realtime** puede cubrir esto sin montar tu propio servidor WS: te suscribes
> a cambios de la tabla `match`/`alert` y llegan al navegador. Buena opción para acelerar.

---

## 9. Alertas Telegram

**Vinculación:** el usuario pulsa "conectar Telegram" → abre el bot con un token de
deep-link (`t.me/ValueGolBot?start=<token>`) → el bot guarda su `chat_id` en `profile`.

**Envío:** cuando el motor dispara una alerta:
1. Crea fila en `alert`.
2. Encola mensaje (cola/worker) para no bloquear el tick.
3. El bot envía al `chat_id`, respetando los **rate limits de Telegram** (~30 msg/s globales, 1 msg/s por chat).
4. Marca `delivered`.

Plantilla de mensaje (ejemplo):
```
⚡ Señal — {estrategia}
{local} {marcador} {visitante} · {minuto}'
Condición: {resumen}
```

---

## 10. API REST (extracto)

```
POST   /auth/...                 (gestionado por Supabase Auth)
GET    /me                       perfil + plan
POST   /telegram/link            genera token de vinculación

GET    /metrics                  catálogo de métricas (alimenta el editor)
GET    /strategies               lista del usuario
POST   /strategies               crea (valida definition contra el catálogo)
PUT    /strategies/:id           edita
DELETE /strategies/:id
PATCH  /strategies/:id/toggle    activa/desactiva

GET    /matches/live             snapshot del scanner
GET    /matches/:id              detalle + momentum
GET    /alerts?from&to&format=csv histórico + export
```

Validación: toda `definition` se valida contra `metric_catalog` (métricas, agg, venue,
operadores permitidos) **antes** de guardar.

---

## 11. Caché (Redis) — claves principales

```
match:{id}            -> hash con stats live actuales        (TTL corto)
match:live:set        -> set de ids de partidos en directo
strat:index:{league}  -> set de estrategias que aplican a esa liga
alert:cooldown:{sid}:{mid} -> flag anti-spam con TTL
```

---

## 12. Seguridad y operación

- **Secretos** (API key del proveedor, token del bot) solo en backend (variables de entorno / secret manager). Nunca en el front.
- **Rate limiting** propio en la API y respeto del rate limit del proveedor (backoff).
- **Gating por plan**: el backend comprueba `plan` antes de permitir estrategias ilimitadas, momentum, export, etc.
- **Observabilidad**: logs de ingesta (latencia del feed), métricas del motor (evaluaciones/tick), entregas Telegram.
- **Idempotencia**: la ingesta debe poder reprocesar sin duplicar alertas (clave anti-spam).

---

## 13. Cumplimiento legal

- Usar **feed de datos licenciado**; respetar sus términos (atribución, no redistribución si aplica).
- **No scrapear** la web de referencia ni casas de apuestas.
- Datos de **cuotas**: revisar términos de uso del proveedor.
- Mantener el **disclaimer** (+18, no es consejo de apuesta) ya presente en la landing.
- RGPD: consentimiento, datos mínimos, gestión de `telegram_chat_id` y email.

---

## 14. Mapa fases ↔ componentes

| Fase | Entregable | Componentes nuevos |
|---|---|---|
| **0** ✅ | Landing estática | — |
| **1** | PoC scanner live (polling), 4–5 métricas, sin login | Ingesta, Normalizador, Redis, API `/matches/live`, front polling |
| **2** | Cuentas + builder persistido + motor + Telegram | Postgres, Auth, `metric_catalog`, `strategy`, Motor, Bot |
| **3** | Live real + momentum + histórico/CSV + cuotas | WebSocket/Realtime, momentum, `odds`, `alert` export |
| **4** | Escala + plan Pro + billing | Stripe, gating, indexado de reglas, observabilidad |

---

## 15. Decisiones abiertas (a cerrar antes de Fase 1)

1. **Proveedor de datos**: ¿cuál? (depende de cobertura de ligas, métricas live disponibles —¿ataques peligrosos, posesión por tramo?—, cuotas, latencia y precio). → *Pendiente comparativa (opción B).*
2. **Frecuencia de actualización** objetivo (define coste y "cuán live" es).
3. **Realtime**: ¿servidor WS propio o Supabase Realtime?
4. **Alcance de métricas** del MVP (cuántas y cuáles).
5. **Modelo de precios** definitivo (límites Free vs Pro).

---

*Siguiente paso recomendado: cerrar la **decisión #1** con una comparativa de proveedores
(opción B), porque condiciona qué métricas y latencia son realmente posibles.*
