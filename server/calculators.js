"use strict";
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { evaluateExpression } = require("../src/tools/calcscript");

const USER_CALC_DIR = path.join(os.homedir(), ".c9ai", "calculators");

function ensureCalcDir() {
  try { fs.mkdirSync(USER_CALC_DIR, { recursive: true }); } catch {}
}

function slugifyId(name) {
  return String(name || "calc").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const router = express.Router();

router.post("/api/calculators/execute", express.json(), async (req, res) => {
  try {
    const { domain, params = {} } = req.body || {};
    if (!domain) return res.status(400).json({ success: false, error: "Missing domain" });

    const calc = require("../src/tools/executive-calculators");
    const id = String(domain).toUpperCase();

    let out;
    switch (id) {
      case "INVESTMENT":
        out = calc.analyzeInvestment(params); break;
      case "VENDOR_DISCOUNT":
        out = calc.analyzeVendorDiscount(params); break;
      case "SAAS_BREAKEVEN":
        out = calc.analyzeSaasBreakeven(params); break;
      case "FINANCE":
        out = calc.analyzeFinanceCompound(params); break;
      case "DEPRECIATION":
        out = calc.analyzeDepreciation(params); break;
      default:
        return res.status(400).json({ success: false, error: `Unknown calculator domain: ${domain}` });
    }

    if (!out || out.success === false) {
      return res.status(400).json({ success: false, error: out?.error || "Calculation failed", details: out });
    }
    return res.json({ success: true, domain: id, ...out });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { calculatorsRouter: router };

// Custom calculator quick evaluation (expression + vars)
router.post("/api/calculators/custom/execute", express.json(), async (req, res) => {
  try {
    const { expression, vars } = req.body || {};
    if (!expression) return res.status(400).json({ success: false, error: "Missing expression" });
    const out = evaluateExpression(String(expression), vars || {});
    if (!out.success) return res.status(400).json(out);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// (Optional) Save custom calculator spec
router.post("/api/calculators/custom/save", express.json(), async (req, res) => {
  try {
    const spec = req.body || {};
    if (!spec.name || !spec.expression) {
      return res.status(400).json({ success: false, error: "name and expression required" });
    }
    ensureCalcDir();
    let id = spec.id && String(spec.id).trim() ? String(spec.id).trim() : slugifyId(spec.name);
    // Ensure uniqueness by appending a number if needed
    let file = path.join(USER_CALC_DIR, `${id}.json`);
    let n = 2;
    while (fs.existsSync(file)) {
      id = `${slugifyId(spec.name)}-${n++}`;
      file = path.join(USER_CALC_DIR, `${id}.json`);
    }
    spec.id = id;
    spec.createdAt = spec.createdAt || new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(spec, null, 2));
    return res.json({ success: true, id, file });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// List saved custom calculators
router.get("/api/calculators/custom/list", async (_req, res) => {
  try {
    ensureCalcDir();
    const items = [];
    for (const f of fs.readdirSync(USER_CALC_DIR)) {
      if (!f.endsWith('.json')) continue;
      const p = path.join(USER_CALC_DIR, f);
      try {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        items.push({ id: j.id || f.replace(/\.json$/, ''), name: j.name || j.id, expression: j.expression || '', createdAt: j.createdAt });
      } catch {}
    }
    items.sort((a,b) => String(a.name).localeCompare(String(b.name)));
    return res.json({ success: true, items });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Update custom calculator (name and/or expression)
router.put("/api/calculators/custom/:id", express.json(), async (req, res) => {
  try {
    ensureCalcDir();
    const id = String(req.params.id);
    const file = path.join(USER_CALC_DIR, `${id}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ success: false, error: 'Calculator not found' });
    const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
    const next = { ...cur };
    if (req.body && typeof req.body.name === 'string' && req.body.name.trim()) next.name = req.body.name.trim();
    if (req.body && typeof req.body.expression === 'string' && req.body.expression.trim()) next.expression = req.body.expression.trim();
    next.updatedAt = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(next, null, 2));
    return res.json({ success: true, id, calc: { id, name: next.name, expression: next.expression } });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Delete custom calculator
router.delete("/api/calculators/custom/:id", async (req, res) => {
  try {
    ensureCalcDir();
    const id = String(req.params.id);
    const file = path.join(USER_CALC_DIR, `${id}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ success: false, error: 'Calculator not found' });
    fs.unlinkSync(file);
    return res.json({ success: true, id });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});
