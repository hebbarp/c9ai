"use strict";
const express = require("express");
const cp = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const router = express.Router();

function which(bin) {
  try {
    const cmd = process.platform === "win32" ? `where ${bin}` : `command -v ${bin}`;
    const out = cp.execSync(cmd, { stdio: ["ignore","pipe","ignore"] }).toString().trim();
    return out.split(/\r?\n/)[0] || null;
  } catch { return null; }
}

function findModels() {
  const home = os.homedir();
  const roots = [
    path.join(home, ".c9ai", "models"),
    path.join(process.cwd(), "models"),
    process.cwd()
  ];
  const list = [];
  for (const dir of roots) {
    try {
      for (const e of fs.readdirSync(dir)) if (e.endsWith(".gguf")) list.push(path.join(dir, e));
    } catch {}
  }
  return list;
}

async function waitHttp(url, { timeoutMs = 15000, intervalMs = 600 } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        const ok = res.statusCode >= 200 && res.statusCode < 400;
        res.resume();
        if (ok) return resolve(true);
        if (Date.now() > deadline) return reject(new Error(`HTTP ${res.statusCode}`));
        setTimeout(tick, intervalMs);
      });
      req.on("error", () => {
        if (Date.now() > deadline) return reject(new Error("fetch failed"));
        setTimeout(tick, intervalMs);
      });
      req.setTimeout(3000, () => { req.destroy(); });
    };
    tick();
  });
}

// POST /api/launch  { model?, ctx?, ngl?, port?, forceCPU? }
router.post("/api/launch", express.json(), async (req, res) => {
  try {
    const llamaBin = which("llama-server") || which("llama-server.exe") || which("server");
    if (!llamaBin) return res.status(400).json({ error: "llama-server not found in PATH" });
    const models = findModels();
    const model = req.body?.model || process.env.LLAMACPP_MODEL || models[0];
    if (!model) return res.status(400).json({ error: "no .gguf model found" });

    const port = Number(req.body?.port || (process.env.LLAMACPP_BASE_URL ? new URL(process.env.LLAMACPP_BASE_URL).port : 8080)) || 8080;
    const baseUrl = `http://127.0.0.1:${port}`;

    // if healthy, return early
    try { if (await waitHttp(baseUrl + "/v1/models", { timeoutMs: 1200 })) return res.json({ ok: true, baseUrl, model }); } catch {}

    const forceCPU = !!req.body?.forceCPU;
    const ctx = String(req.body?.ctx || process.env.LLAMACPP_CTX || (forceCPU ? "2048" : "4096"));
    const ngl = String(req.body?.ngl || process.env.LLAMACPP_NGL || (forceCPU ? "0" : "20"));
    const args = ["-m", model, "-c", ctx, "-ngl", ngl, "-t", "8", "-tb", "8", "--host", "127.0.0.1", "--port", String(port)];

    const child = cp.spawn(llamaBin, args, { stdio: "ignore", detached: true });
    child.unref();
    // wait up to 20s
    try {
      await waitHttp(baseUrl + "/v1/models", { timeoutMs: 20000 });
      return res.json({ ok: true, baseUrl, model, args, forceCPU });
    } catch (e) {
      // Do NOT auto-fallback to CPU; tell the client to adjust flags
      return res.status(500).json({ error: "llama.cpp did not become healthy", detail: e.message, baseUrl, model, suggested: { ctx, ngl } });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = { launchRouter: router };