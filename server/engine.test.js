"use strict";
/* Test del motor con la estrategia real "Goles 1ª parte" (12 condiciones).
   Ejecuta:  node server/engine.test.js                                   */

var assert = require("assert");
var engine = require("./engine");

// --- Estrategia real (idéntica a docs/ARQUITECTURA.md §5.1) ---
var STRATEGY = {
  logic: "AND",
  conditions: [
    { metric: "fh_goals_for", agg: "avg", window: 10, venue: "home", team: "home", op: ">=", value: 0.6 },
    { metric: "fh_goals_against", agg: "avg", window: 10, venue: "away", team: "away", op: ">=", value: 0.7 },
    { expr: {
        left:  { metric: "fh_goals_for", agg: "avg", window: 10, venue: "home", team: "home" },
        operator: "+",
        right: { metric: "fh_goals_against", agg: "avg", window: 10, venue: "away", team: "away" }
      }, op: ">=", value: 1.6 },
    { metric: "odds_fh_over_0_5", agg: "value", op: "<", value: 1.25 },
    { metric: "ht05_pct", agg: "pct", window: 10, venue: "home", team: "home", op: ">=", value: 70 },
    { metric: "ht05_pct", agg: "pct", window: 10, venue: "away", team: "away", op: ">=", value: 70 },
    { metric: "odds_fh_over_1_5", agg: "value", op: ">=", value: 1.7 },
    { expr: {
        left:  { metric: "fh_goals_against", agg: "avg", window: 10, venue: "home", team: "home" },
        operator: "+",
        right: { metric: "fh_goals_for", agg: "avg", window: 10, venue: "away", team: "away" }
      }, op: ">=", value: 1.8 },
    { metric: "ht05_pct", agg: "pct", window: 5, venue: "home", team: "home", op: ">=", value: 60 },
    { metric: "ht05_pct", agg: "pct", window: 5, venue: "away", team: "away", op: ">=", value: 60 },
    { metric: "goals_at_ht", agg: "value", op: "<=", value: 1 },
    { metric: "red_cards", agg: "value", op: "=", value: 0 }
  ]
};

// --- Contexto donde TODAS las condiciones se cumplen ---
var ctxPass = {
  historico: {
    "fh_goals_for|avg|w10|home|home": 0.8,
    "fh_goals_against|avg|w10|away|away": 0.9,
    "fh_goals_against|avg|w10|home|home": 0.9,
    "fh_goals_for|avg|w10|away|away": 1.0,
    "ht05_pct|pct|w10|home|home": 75,
    "ht05_pct|pct|w10|away|away": 72,
    "ht05_pct|pct|w5|home|home": 65,
    "ht05_pct|pct|w5|away|away": 62
  },
  odds: { odds_fh_over_0_5: 1.20, odds_fh_over_1_5: 1.80 },
  live: { goals_at_ht: 1, red_cards: 0 }
};

// 1) Debe DISPARAR (todas se cumplen)
var r1 = engine.evaluateStrategy(STRATEGY, ctxPass);
assert.strictEqual(r1.pass, true, "La estrategia debería cumplirse con ctxPass");
assert.strictEqual(engine.failingConditions(r1).length, 0, "No debería haber condiciones fallidas");
console.log("✓ Test 1: estrategia COMPLETA se cumple (12/12 condiciones)");

// 2) Falla una condición live (tarjeta roja) → NO dispara
var ctxRed = JSON.parse(JSON.stringify(ctxPass));
ctxRed.live.red_cards = 1;
var r2 = engine.evaluateStrategy(STRATEGY, ctxRed);
assert.strictEqual(r2.pass, false, "Con tarjeta roja no debería cumplirse");
console.log("✓ Test 2: red_cards=1 rompe la estrategia →", engine.failingConditions(r2).join(" | "));

// 3) Falla una condición derivada (suma por debajo del umbral) → NO dispara
var ctxDerived = JSON.parse(JSON.stringify(ctxPass));
ctxDerived.historico["fh_goals_for|avg|w10|home|home"] = 0.6;   // c1 sigue ok (>=0.6)
ctxDerived.historico["fh_goals_against|avg|w10|away|away"] = 0.7; // c2 sigue ok (>=0.7)
// suma 0.6+0.7 = 1.3 < 1.6 → c3 (derivada) falla
var r3 = engine.evaluateStrategy(STRATEGY, ctxDerived);
assert.strictEqual(r3.pass, false, "La suma derivada por debajo de 1.6 no debería cumplirse");
console.log("✓ Test 3: derivada 0.6+0.7<1.6 rompe la estrategia →", engine.failingConditions(r3).join(" | "));

// 4) Falla una cuota → NO dispara
var ctxOdds = JSON.parse(JSON.stringify(ctxPass));
ctxOdds.odds.odds_fh_over_0_5 = 1.40; // ya no es < 1.25
var r4 = engine.evaluateStrategy(STRATEGY, ctxOdds);
assert.strictEqual(r4.pass, false, "Cuota fuera de rango no debería cumplirse");
console.log("✓ Test 4: cuota 1.40 (no <1.25) rompe la estrategia");

// 5) Lógica OR: con una sola condición verdadera basta
var orStrat = { logic: "OR", conditions: [
  { metric: "red_cards", op: "=", value: 5 },        // falso
  { metric: "goals_at_ht", op: "<=", value: 1 }      // verdadero
]};
assert.strictEqual(engine.evaluateStrategy(orStrat, ctxPass).pass, true, "OR debería cumplirse");
console.log("✓ Test 5: lógica OR funciona");

console.log("\n✅ TODOS LOS TESTS PASAN — el motor soporta tu estrategia completa.");
