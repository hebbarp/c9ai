"use strict";
const vm = require("node:vm");

// Very small expression evaluator for custom calculators
// Supports: numbers, variables [a-zA-Z_][a-zA-Z0-9_]*, operators + - * / ^, parentheses, and Math functions: min,max,abs,pow

function sanitize(expr) {
  if (typeof expr !== 'string') return '';
  // Replace percentages like 12% -> (12/100)
  let e = expr.replace(/([0-9]+(?:\.[0-9]+)?)\s*%/g, '($1/100)');
  // Replace caret with JS exponent
  e = e.replace(/\^/g, '**');
  // Allow digits, operators, parentheses, dot, comma, space, underscore, letters, newlines
  const invalid = e.match(/[^0-9+\-*/()., _a-zA-Z\n\r]/);
  if (invalid) {
    const ch = invalid[0];
    throw new Error(`Expression contains invalid character: '${ch}'`);
  }
  return e;
}

function evaluateExpression(expression, variables = {}) {
  const expr = sanitize(expression);
  // Build safe context
  const ctx = {
    Math,
    min: Math.min,
    max: Math.max,
    abs: Math.abs,
    pow: Math.pow,
    sqrt: Math.sqrt,
    log: Math.log,
    exp: Math.exp,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
  };
  // Copy numeric variables only
  for (const [k, v] of Object.entries(variables || {})) {
    if (!/^[_a-zA-Z][\w]*$/.test(k)) continue;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    ctx[k] = n;
  }
  const context = vm.createContext(ctx);
  try {
    const result = vm.runInContext(expr, context, { timeout: 200, displayErrors: false });
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      throw new Error('Expression did not produce a finite numeric result');
    }
    return { success: true, result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = { evaluateExpression };
