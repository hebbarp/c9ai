#!/usr/bin/env node
"use strict";
// Cross-platform launcher:
// 1) Find llama-server and a .gguf model
// 2) Start server on first free port (8080..8090) if not already running
// 3) Wait for /v1/models
// 4) Launch Agent API
// 5) Open llama.cpp UI in browser
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const cp = require("node:child_process");

function which(bin) {
  try {
    const cmd = process.platform === "win32" ? `where ${bin}` : `command -v ${bin}`;
    const out = cp.execSync(cmd, { stdio: ["ignore","pipe","ignore"] }).toString().trim();
    return out.split(/\r?\n/)[0] || null;
  } catch { return null; }
}

function findModelCandidates() {
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

function pickPort(start = 8080, max = 8090) {
  return new Promise((resolve) => {
    let port = start;
    const tryPort = () => {
      const srv = http.createServer();
      srv.once("error", () => { port++; if (port > max) resolve(null); else tryPort(); });
      srv.listen(port, "127.0.0.1", () => srv.close(() => resolve(port)));
    };
    tryPort();
  });
}

function openBrowser(url) {
  try {
    if (process.platform === "darwin") {
      cp.spawn("open", [url], { stdio: "ignore", detached: true });
    } else if (process.platform === "win32") {
      cp.spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
    } else {
      const opener = which("xdg-open") || which("gio") || which("gnome-open") || which("kde-open");
      if (opener) cp.spawn(opener, [url], { stdio: "ignore", detached: true });
    }
  } catch {}
}

(async () => {
  // 1) llama-server binary
  const llamaBin = which("llama-server") || which("llama-server.exe") || which("server");
  if (!llamaBin) {
    console.error("❌ llama-server not found in PATH.");
    console.error("   macOS:  brew install llama.cpp");
    console.error("   Linux:  build from source (see repo)");
    console.error("   Win:    download/build llama.cpp, add folder to PATH");
    process.exit(1);
  }

  // 2) model
  const models = findModelCandidates();
  if (models.length === 0) {
    console.error("❌ No .gguf models found in ~/.c9ai/models, ./models, or CWD.");
    process.exit(1);
  }
  const model = process.env.LLAMACPP_MODEL || models[0];

  // 3) pick port / start llama.cpp if needed
  let baseUrl = process.env.LLAMACPP_BASE_URL || "http://127.0.0.1:8080";
  let healthy = false;
  try { healthy = await waitHttp(baseUrl + "/v1/models", { timeoutMs: 1200 }); } catch {}
  let portUsed = Number(new URL(baseUrl).port || 8080);

  if (!healthy) {
    const port = await pickPort(8080, 8090);
    if (!port) {
      console.error("❌ No free port in 8080..8090.");
      process.exit(1);
    }
    portUsed = port;
    baseUrl = `http://127.0.0.1:${portUsed}`;
    console.log(`🚀 Starting llama-server on ${baseUrl}`);

    // Retry ladder: try fast settings first.
    // IMPORTANT: We DO NOT fall back to CPU unless FORCE_CPU=true
    const ctxEnv = process.env.LLAMACPP_CTX;
    const nglEnv = process.env.LLAMACPP_NGL;
    const forceCPU = String(process.env.FORCE_CPU || "").toLowerCase() === "true";
    const tries = forceCPU
      ? [
          { c: ctxEnv || "2048", ngl: "0",  t: "8", tb: "8", ub: "128" }, // CPU safe
          { c: "1536",           ngl: "0",  t: "8", tb: "8", ub: "128" }
        ]
      : [
          { c: ctxEnv || "4096", ngl: nglEnv || "20", t: "8", tb: "8", ub: "128" }, // fast, GPU
          { c: ctxEnv || "3072", ngl: "12",           t: "8", tb: "8", ub: "128" }, // less GPU
          { c: "3072",           ngl: "10",           t: "8", tb: "8", ub: "128" }  // small step-down
        ];
    let started = false;
    for (const attempt of tries) {
      console.log(`→ trying: -c ${attempt.c} -ngl ${attempt.ngl} -t ${attempt.t} -tb ${attempt.tb}`);
      const args = [
        "-m", model,
        "-c", String(attempt.c),
        "-ngl", String(attempt.ngl),
        "-t", String(attempt.t),
        "-tb", String(attempt.tb),
        "--host", "127.0.0.1",
        "--port", String(portUsed)
      ];
      const child = cp.spawn(llamaBin, args, { stdio: "inherit" });
      try {
        await waitHttp(baseUrl + "/v1/models", { timeoutMs: 20000 });
        console.log("✅ llama.cpp API healthy.");
        started = true;
        child.on("exit", (code) => {
          console.error(`llama-server exited with code ${code}`);
          process.exit(code || 1);
        });
        break;
      } catch (e) {
        console.warn(`⚠️ failed at -c ${attempt.c} -ngl ${attempt.ngl}: ${e.message}`);
        try { child.kill("SIGINT"); } catch {}
      }
    }
    if (!started) {
      console.error("❌ Could not start llama-server with GPU settings.");
      if (!forceCPU) {
        console.error("   (Refusing to fall back to CPU unless FORCE_CPU=true)");
      }
      console.error("   Try: export LLAMACPP_CTX=3072; export LLAMACPP_NGL=12; npm run start:local");
      process.exit(1);
    }
  } else {
    console.log(`✅ llama.cpp already healthy at ${baseUrl}`);
  }

  // start Agent API server (8787) and pass llama base URL
  console.log("🌐 Launching Agent API (port 8787) …");
  const agentEnv = { ...process.env, LLAMACPP_BASE_URL: baseUrl };
  const api = cp.spawn(process.execPath, ["server/agent-api.js"], { stdio: "inherit", env: agentEnv });
  api.on("exit", (code) => {
    console.error(`Agent API exited with code ${code}`);
    process.exit(code || 1);
  });

  // 5) open UI(s)
  console.log("\n🧩 Ready!");
  console.log(`   llama.cpp API: ${baseUrl}`);
  console.log("   c9ai UI:       http://127.0.0.1:8787");
  openBrowser("http://127.0.0.1:8787");
})();
