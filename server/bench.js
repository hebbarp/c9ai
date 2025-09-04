"use strict";
const express = require("express");
const fetch = (...a) => import("node-fetch").then(({default:f}) => f(...a));

const router = express.Router();

// GET /api/bench  → returns tokens/sec using llama.cpp timings
router.get("/api/bench", async (req, res) => {
  try {
    const base = process.env.LLAMACPP_BASE_URL || "http://127.0.0.1:8080";
    const r = await fetch(base + "/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "auto",
        messages: [{ role: "user", content: "Say hello in one short sentence." }],
        max_tokens: 64
      })
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: "llama.cpp error", status: r.status, text });
    }
    const data = await r.json();
    const t = data?.timings || {};
    // timings fields (observed): predicted_n, predicted_ms
    const n = Number(t.predicted_n || data?.usage?.completion_tokens || 0);
    const ms = Number(t.predicted_ms || 0);
    const tps = n && ms ? (n / (ms / 1000)) : null;
    res.json({ ok: true, tokens: n, ms, tps, timings: t });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { benchRouter: router };