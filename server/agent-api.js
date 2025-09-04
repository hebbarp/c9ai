"use strict";
/**
 * Simple SSE API that exposes the agent loop to any frontend.
 * Endpoint: POST /api/agent  { prompt: string, provider?: "llamacpp"|"ollama", allow?: string[] }
 * Streams events: status, detected, plan, tool, toolResult, final, error
 */
const express = require("express");
const cors = require("cors");
const http = require("node:http");
const { getLocalProvider } = require("../src/providers");
const { agentStep } = require("../src/agent/runStep");
const { makeSynthesizer } = require("../src/agent/synthesize");
const { runTool } = require("../src/tools/runner");
const { agenticResponseSSE } = require("./sse-agent-handler");
const { settingsRouter } = require("./settings");
const { authRouter } = require("./auth");
const { paymentsRouter } = require("./payments");
const { launchRouter } = require("./launch");
const { benchRouter } = require("./bench");
const { chatRouter } = require("./chat");
const { toolRegistryRouter } = require("./tool-registry-router");
const { packageManagerRouter } = require("./package-manager-router");
const { creditsRouter } = require("./credits-router");
const { workflowRouter, initializeWorkflowAPI } = require("./workflow-api");
const { calculatorsRouter } = require("./calculators");
const { terminalRouter } = require("./terminal");
const { workflowsCustomRouter } = require("./workflows-custom");
const { creamDebugRouter } = require("./cream-debug");

const PORT = Number(process.env.PORT || 8787);
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Authentication endpoints
app.use(authRouter);

// Settings + tools endpoints
app.use(settingsRouter);

// Launch endpoint (start llama.cpp from UI)
app.use(launchRouter);

// Bench endpoint (tokens/sec)
app.use(benchRouter);

// Payments endpoints
app.use(paymentsRouter);

// Chat endpoint (simple chat without tools)
app.use(chatRouter);

// Tool Registry endpoints
app.use(toolRegistryRouter);

// Package Manager endpoints  
app.use(packageManagerRouter);

// Credits & Billing endpoints
app.use(creditsRouter);

// Workflow & Vibe-based Task Management endpoints
app.use(workflowRouter);

// Deterministic calculators (executive)
app.use(calculatorsRouter);

// Simple terminal runner (non-streaming)
app.use(terminalRouter);
app.use(workflowsCustomRouter);
app.use(creamDebugRouter);

// Accept both POST (JSON body) and GET (EventSource query) for SSE
app.all("/api/agent", (req, res, next) => {
  if (req.method === "GET" || req.method === "POST") return agenticResponseSSE(req, res, next);
  res.status(405).json({ error: "Method Not Allowed" });
});

// (optional) serve static UI if you drop your HTML in /public
const path = require("node:path");
app.use(express.static(path.join(process.cwd(), "public")));

// Initialize workflow API
async function startServer() {
  await initializeWorkflowAPI();
  
  http.createServer(app).listen(PORT, () => {
    console.log(`Agent API listening on http://127.0.0.1:${PORT}`);
    console.log(`🎭 Vibe-based workflow templates ready!`);
  });
}

startServer().catch(console.error);
