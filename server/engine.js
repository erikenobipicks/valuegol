"use strict";
/* ============================================================
   ValueGol — Motor de evaluación de estrategias
   Interpreta una estrategia declarativa (JSON) contra un
   contexto de partido y devuelve si se cumple.

   Soporta:
   - Condiciones métrica: { metric, agg, window, venue, team, op, value }
   - Condiciones derivadas: { expr:{left,right,operator}, op, value }
   - Lógica anidable: { logic:'AND'|'OR', conditions:[...] }
   - 3 fuentes: live, histórico (ventana/localía/equipo) y cuotas

   Sin dependencias. Pensado para correr en el bucle del scanner
   (ver docs/ARQUITECTURA.md §5 y §6).
   ============================================================ */

// Categoría de cada métrica → de qué fuente se resuelve.
var CATALOG = {
  // Histórico (precalculado por equipo: media/porcentaje sobre ventana)
  fh_goals_for:     { category: "historico", agg: "avg" },
  fh_goals_against: { category: "historico", agg: "avg" },
  ht05_pct:         { category: "historico", agg: "pct" },
  // Cuotas pre-partido
  odds_fh_over_0_5: { category: "odds", agg: "value" },
  odds_fh_over_1_5: { category: "odds", agg: "value" },
  // Estado en directo
  goals_at_ht:      { category: "live", agg: "value" },
  red_cards:        { category: "live", agg: "value" },
  shots_on_target:  { category: "live", agg: "value" },
  corners:          { category: "live", agg: "value" },
  dangerous_attacks:{ category: "live", agg: "value" },
  momentum:         { category: "live", agg: "value" }
};

function num(x) {
  if (x === null || x === undefined) return undefined;
  var n = Number(x);
  return isNaN(n) ? undefined : n;
}

// Clave estable de un valor histórico: metric|agg|wN|venue|team
function histKey(spec) {
  var cat = CATALOG[spec.metric] || {};
  var agg = spec.agg || cat.agg || "avg";
  return [
    spec.metric,
    agg,
    "w" + (spec.window != null ? spec.window : ""),
    spec.venue || "overall",
    spec.team || "home"
  ].join("|");
}

// Resuelve el valor numérico de una métrica desde el contexto.
function resolveValue(spec, ctx) {
  var cat = (CATALOG[spec.metric] || {}).category;
  if (cat === "live") return num((ctx.live || {})[spec.metric]);
  if (cat === "odds") return num((ctx.odds || {})[spec.metric]);
  if (cat === "historico") {
    var h = ctx.historico || {};
    if (typeof h === "function") return num(h(spec));
    return num(h[histKey(spec)]);
  }
  return undefined; // métrica desconocida
}

function compare(op, a, b) {
  if (a === undefined || a === null) return false;
  switch (op) {
    case ">=": return a >= b;
    case "<=": return a <= b;
    case ">":  return a > b;
    case "<":  return a < b;
    case "=":
    case "==": return a === b;
    case "between": return Array.isArray(b) && a >= b[0] && a <= b[1];
    default: return false;
  }
}

// Evalúa una condición hoja (métrica o derivada).
function evalCondition(c, ctx) {
  var left;
  if (c.expr) {
    var l = resolveValue(c.expr.left, ctx);
    var r = resolveValue(c.expr.right, ctx);
    if (l === undefined || r === undefined) {
      return { pass: false, value: undefined, missing: true, label: describe(c) };
    }
    left = c.expr.operator === "-" ? l - r : l + r;
  } else {
    left = resolveValue(c, ctx);
  }
  return {
    pass: left !== undefined && compare(c.op, left, c.value),
    value: left,
    missing: left === undefined,
    label: describe(c)
  };
}

// Evalúa un nodo lógico (AND/OR) recursivo.
function evalNode(node, ctx) {
  var logic = (node.logic || "AND").toUpperCase();
  var conds = node.conditions || [];
  var results = conds.map(function (c) {
    return c.conditions ? evalNode(c, ctx) : evalCondition(c, ctx);
  });
  var pass = logic === "OR"
    ? results.some(function (r) { return r.pass; })
    : results.every(function (r) { return r.pass; });
  return { pass: pass, logic: logic, results: results };
}

// Punto de entrada: evalúa una estrategia completa.
function evaluateStrategy(definition, ctx) {
  if (!definition || !definition.conditions) return { pass: false, results: [] };
  return evalNode(definition, ctx);
}

// Descripción legible de una condición (para alertas/depuración).
function describe(c) {
  if (c.expr) {
    return describe(c.expr.left) + " " + c.expr.operator + " " + describe(c.expr.right) +
      (c.op ? " " + c.op + " " + c.value : "");
  }
  var parts = [c.metric];
  if (c.window) parts.push("últ." + c.window);
  if (c.venue && c.venue !== "overall") parts.push(c.venue);
  if (c.op) parts.push(c.op + " " + c.value);
  return parts.join(" ");
}

// Lista de condiciones que han fallado (útil para el inverso de la alerta).
function failingConditions(node) {
  var out = [];
  (node.results || []).forEach(function (r) {
    if (r.results) out = out.concat(failingConditions(r));
    else if (!r.pass) out.push(r.label);
  });
  return out;
}

module.exports = {
  evaluateStrategy: evaluateStrategy,
  evalCondition: evalCondition,
  resolveValue: resolveValue,
  histKey: histKey,
  describe: describe,
  failingConditions: failingConditions,
  CATALOG: CATALOG
};
