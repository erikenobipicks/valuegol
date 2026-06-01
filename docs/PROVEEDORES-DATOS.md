# ValueGol — Comparativa de proveedores de datos

> Estado: **borrador v1** · Junio 2026.
> Objetivo: elegir el feed que alimenta el scanner live, las estrategias y las alertas.
> ⚠️ **Los precios cambian a menudo.** Las cifras son orientativas (verifícalas en la
> web oficial de cada proveedor antes de contratar). Se incluyen las fuentes al final.

---

## 0. Por qué esta decisión condiciona todo

El proveedor determina **qué se puede medir y con qué latencia**. Antes de mirar precios,
hay que comprobar que cubre lo que **tu estrategia real** exige. Tu caso ("Goles 1ª parte")
necesita cosas que NO todos los proveedores dan:

| Lo que tu estrategia pide | ¿Es fácil de encontrar? |
|---|---|
| **Goles de 1ª parte** (marcados/encajados, % HT) en histórico | ✅ Sí, si el feed da el **marcador al descanso** por partido → lo calculas tú |
| Medias **últimos 5/10** partidos con **split casa/fuera** | ✅ Lo calculas tú a partir del histórico de partidos |
| **Cuotas de 1ª parte** (1H Over 0.5 / 1.5) | ⚠️ Más raro: requiere un feed de **odds** con mercados de 1ª parte |
| **Ataques peligrosos** y **posesión** en vivo (para el momentum) | ⚠️ NO está en todos. Clave para el indicador de presión |
| **Goles al descanso / tarjetas rojas** en vivo | ✅ Común en cualquier feed live |

> **Conclusión de partida:** el histórico de 1ª parte lo derivas tú (solo necesitas el
> HT score por partido, que casi todos dan). Los dos puntos delicados son **(a) cuotas de
> mercados de 1ª parte** y **(b) ataques peligrosos en vivo** para el momentum.

---

## 1. Tabla comparativa (candidatos realistas)

| Proveedor | Free / Trial | Precio entrada (aprox.) | Stats in‑play | Ataques peligrosos | Cuotas | Cobertura | Self‑serve |
|---|---|---|---|---|---|---|---|
| **API‑Football** (API‑Sports) | ✅ 100 req/día gratis para siempre | Pro ~$19/mes (7.500 req/día) · Mega ~$39/mes (150k) | Tiros, córners, posesión, tarjetas, pases… (a partido) | ❌ No (no expone "dangerous attacks") | ✅ Endpoint odds (muchos bookies/mercados) | Todas las competiciones en todos los planes | ✅ Sí |
| **Sportmonks** | ✅ Trial 14 días + plan free limitado | Starter ~€29/mes (5 ligas) | In‑play granular, eventos, coordenadas de balón, <15 s | ⚠️ Más granular que API‑Football (revisar campo exacto) | ⚠️ Add‑on aparte (TXODDS) | 2.300+ ligas; pagas por nº de ligas | ✅ Sí |
| **BetsAPI** (bet365 inplay) | ❌ (de pago; entrada barata) | Desde ~$1/día · ~$100/mes nivel bajo | Enfocado a in‑play de bet365: **ataques, ataques peligrosos, córners, posesión** | ✅ Sí (vía bet365 inplay) | ✅ Odds bet365 (córners, BTTS, FT, **1ª parte**…) | Lo que cubre bet365 | ✅ Sí (vía web/RapidAPI) |
| **football‑data.org** | ✅ Free tier generoso | ~€nominal por tiers | Básico (marcadores, alineaciones); **poco live‑stats** | ❌ No | ❌ No | Top ligas europeas | ✅ Sí |
| **iSports API** | ✅ Trial | Publicado, económico | Live scores, <10 s | ⚠️ Revisar | ✅ Built‑in | 2.000+ ligas (fuerte en Asia) | ✅ Sí |
| **Sportradar** | 30 días dev trial | Enterprise (no público) | Muy completo | ✅ Sí | ✅ Sí (para casas) | 900+ competiciones | ❌ Contrato |
| **Opta / Stats Perform** | ❌ | Enterprise (caro) | El más profundo del mercado | ✅ Sí | ⚠️ | 3.900+ competiciones | ❌ Contrato |

---

## 2. Análisis por proveedor

### 🟢 API‑Football (API‑Sports) — *mejor para empezar*
- **Pros:** free tier real (100 req/día, sin tarjeta, permanente), precio bajísimo, self‑serve inmediato, documentación clara, **todas las competiciones en todos los planes**, endpoint de **odds** incluido, da **marcador al descanso** por partido (→ histórico de 1ª parte calculable).
- **Contras:** las estadísticas in‑play son **a nivel de partido** (no separadas por mitad) y **no incluye "ataques peligrosos"** → el momentum tendría que basarse en tiros/córners/posesión, no en ataques. Límite por minuto estricto (no martillear).
- **Veredicto:** **ideal para la Fase 1 / PoC**. Validas casi toda la estrategia (histórico 1ª parte, cuotas, goles al descanso, rojas) con coste casi nulo. El momentum sería una versión "v1" sin ataques peligrosos.

### 🟡 Sportmonks — *salto de calidad in‑play*
- **Pros:** in‑play más granular (eventos, coordenadas de balón, latencia <15 s), 2.300+ ligas, self‑serve, trial 14 días. Modelo flexible (pagas por ligas).
- **Contras:** **odds es add‑on** (coste extra y, según el caso, importante para tus cuotas de 1ª parte). Pagas por número de ligas → si quieres muchas, sube. Hay que confirmar el campo exacto de "ataques/ataques peligrosos".
- **Veredicto:** buen candidato para **Fase 3** (live real + momentum) si su in‑play trae ataques peligrosos y contratas el add‑on de odds.

### 🟡 BetsAPI (bet365 inplay) — *el más "apuestas", fuerte en vivo y cuotas*
- **Pros:** expone datos in‑play de bet365 con **ataques, ataques peligrosos, córners, posesión** (justo lo del momentum) y **odds con mercados de 1ª parte y córners**. Entrada barata (desde ~$1/día).
- **Contras:** depende de bet365 (cobertura y términos de uso de su feed); calidad/forma de los datos atada a ese origen; menos "enterprise". Revisar **legalidad/ToS** del uso de datos de casa de apuestas en tu jurisdicción.
- **Veredicto:** el que **mejor encaja con tu estrategia concreta** (cuotas FH + ataques peligrosos), pero con más cautela legal y de dependencia. Posible **complemento** de API‑Football para las piezas que a este le faltan.

### ⚪ football‑data.org — *demasiado limitado para esto*
- Barato/gratis y muy fácil, pero **sin live‑stats profundas ni odds ni ataques**. Sirve para marcadores y poco más. **No cubre** tu caso de uso. Descartado como principal.

### ⚪ Sportradar · Opta · Genius — *enterprise (futuro lejano)*
- Los mejores datos y latencia ("por segundo"), pero **sin pricing público, contrato y caros**. Solo tienen sentido al escalar mucho (Fase 4+). No para arrancar.

---

## 3. Recomendación por fase

| Fase | Proveedor recomendado | Por qué |
|---|---|---|
| **1 — PoC** | **API‑Football** (free → Pro $19) | Coste casi cero, valida ~el 80% de la lógica (histórico 1ª parte, cuotas, goles HT, rojas). Momentum v1 con tiros/córners/posesión. |
| **2 — Producto** | API‑Football (Pro/Ultra) | Suficiente para cuentas, builder, motor y alertas con datos reales. |
| **3 — Live de verdad + momentum fuerte** | **Sportmonks** (+odds add‑on) **o** **BetsAPI** | Si necesitas **ataques peligrosos** y cuotas de 1ª parte para el momentum y la estrategia completa. |
| **4 — Escala** | Evaluar Sportradar/Opta | Solo si el volumen y los ingresos lo justifican. |

> **Estrategia pragmática:** empezar con **API‑Football** (barato, valida el producto) y,
> cuando el momentum con ataques peligrosos sea un requisito firme, **añadir un segundo
> feed** (Sportmonks o BetsAPI) solo para esas métricas. La capa "Normalizador" del
> documento de arquitectura está pensada justo para esto: **multi‑proveedor** detrás de
> un modelo interno único.

---

## 4. Cómo validar antes de contratar (checklist)

Antes de pagar nada, con el **free tier / trial** comprueba con partidos reales:

- [ ] ¿Da **marcador al descanso** (HT score) por partido en el histórico? → habilita todo el cálculo de 1ª parte.
- [ ] ¿Las stats in‑play incluyen **posesión, tiros a puerta y córners** actualizándose en vivo?
- [ ] ¿Incluye **ataques / ataques peligrosos** en vivo? (sí/no decide el momentum v1 vs v2).
- [ ] ¿El endpoint de **odds** trae mercados de **1ª parte** (Over 0.5 / 1.5)?
- [ ] **Latencia real** observada (cada cuántos segundos cambian los datos).
- [ ] **Cobertura** de las ligas que te interesan.
- [ ] **Límite de requests** vs. nº de partidos que quieres vigilar simultáneamente.
- [ ] **Términos de uso** (¿se puede mostrar al usuario final?, ¿redistribución?, odds).

---

## 5. Decisión recomendada (resumen)

1. **Arrancar con API‑Football** (free → Pro). Máximo aprendizaje, mínimo coste.
2. Construir el **Normalizador multi‑proveedor** desde el día 1 (no acoplarse a un único feed).
3. Diseñar el **momentum** para funcionar con o sin "ataques peligrosos" (degradación elegante).
4. Reservar **Sportmonks/BetsAPI** para cuando el momentum avanzado y las cuotas de 1ª parte sean requisito de producto (Fase 3).
5. **Enterprise (Sportradar/Opta)** solo a escala.

---

## Fuentes

- [API‑Football — Pricing](https://www.api-football.com/pricing) · [Documentación](https://www.api-football.com/documentation-v3) · [Perfil SportsAPI](https://sportsapi.com/api-directory/api-football/)
- [Sportmonks — Planes y precios](https://www.sportmonks.com/football-api/plans-pricing/) · [Plan free](https://www.sportmonks.com/football-api/free-plan/) · [Football API](https://www.sportmonks.com/football-api/)
- [BetsAPI — Soccer / bet365 inplay](https://betsapi.com/c/Soccer) · [Docs inplay](https://betsapi.com/docs/bet365/inplay.html)
- [football‑data.org — Pricing](https://www.football-data.org/pricing)
- [Entity Sports — Top 5 Football API Providers 2026](https://www.entitysport.com/blog/best-football-api-providers/)
- [TheStatsAPI — Best Free Football APIs 2026](https://www.thestatsapi.com/blog/free-football-api-alternatives)
- [The Odds API](https://the-odds-api.com/)
