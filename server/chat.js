"use strict";
const express = require("express");
const fetch = (...a) => import("node-fetch").then(({default:f}) => f(...a));
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { homedir } = require("node:os");
const { processResponseWithCodeBlocks } = require("../src/agent/synthesize");
const { runTool } = require("../src/tools/runner");

const router = express.Router();

router.get("/api/health", async (req, res) => {
  const s = readSettings();
  const out = { llama: null, claude: null, gemini: null, openai: null };
  // llama
  try {
    const base = process.env.LLAMACPP_BASE_URL || "http://127.0.0.1:8080";
    const r = await fetch(base + "/v1/models");
    out.llama = r.ok;
  } catch { out.llama = false; }
  // keys
  out.claude = !!(process.env.ANTHROPIC_API_KEY || s.apiKeys?.ANTHROPIC_API_KEY);
  out.gemini = !!(process.env.GEMINI_API_KEY || s.apiKeys?.GEMINI_API_KEY);
  out.openai = !!(process.env.OPENAI_API_KEY || s.apiKeys?.OPENAI_API_KEY);
  res.json(out);
});

async function callAnthropic({ apiKey, model, messages, params }) {
  const url = "https://api.anthropic.com/v1/messages";
  
  const anthropicMessages = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));
  
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  
  const body = {
    model: model || "claude-3-5-sonnet-latest",
    max_tokens: params.max_tokens || 1024,
    messages: anthropicMessages,
    ...(systemMessage && { system: systemMessage })
  };
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  return data.content[0]?.text || "";
}

async function callGemini({ apiKey, model, messages, params }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-1.5-pro-latest"}:generateContent?key=${apiKey}`;
  
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: params.max_tokens || 1024,
      temperature: params.temperature || 0.7,
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.candidates[0]?.content?.parts[0]?.text || "";
}

async function callOpenAI({ apiKey, baseUrl, model, messages, params }) {
  const url = (baseUrl || "https://api.openai.com") + "/v1/chat/completions";
  const body = {
    model: model || "gpt-4o-mini",
    messages,
    ...params
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

async function callLlamacpp({ baseUrl, model, messages, params = {} }) {
  const url = (baseUrl || process.env.LLAMACPP_BASE_URL || "http://127.0.0.1:8080");
  
  // Health check
  try {
    const health = await fetch(url + "/health");
    if (!health.ok) throw new Error("unhealthy");
    const healthJson = await health.json();
    if (healthJson.status !== "ok") throw new Error(healthJson.status);
  } catch (e) {
    throw new Error(`llama.cpp server is not ready: ${e.message}`);
  }

  const body = {
    model: model || "auto",
    messages,
    max_tokens: params.max_tokens || 512,
    temperature: params.temperature || 0.7,
    ...params
  };
  
  const r = await fetch(url + "/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  
  if (!r.ok) throw new Error(`llama.cpp ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content || "";
}

function readSettings() {
  try {
    const txt = readFileSync(join(homedir(), ".c9ai", "settings.json"), "utf-8");
    return JSON.parse(txt);
  } catch {
    return {
      provider: "llamacpp",
      apiKeys: {}
    };
  }
}

router.post("/api/chat", express.json(), async (req, res) => {
  try {
    const { provider: reqProvider, messages, model, ...params } = req.body;
    const s = readSettings();
    let provider = reqProvider || s.provider || "llamacpp";
    
    let text;
    try {
      if (provider === "claude") {
        const key = process.env.ANTHROPIC_API_KEY || s.apiKeys?.ANTHROPIC_API_KEY;
        if (!key) return res.status(400).json({ error: "Missing ANTHROPIC_API_KEY" });
        text = await callAnthropic({ apiKey: key, model: req.body.model || "claude-3-5-sonnet-latest", messages, params });
      } else if (provider === "gemini") {
        const key = process.env.GEMINI_API_KEY || s.apiKeys?.GEMINI_API_KEY;
        if (!key) return res.status(400).json({ error: "Missing GEMINI_API_KEY" });
        text = await callGemini({ apiKey: key, model: req.body.model || "gemini-1.5-pro", messages, params });
      } else if (provider === "openai") {
        const key = process.env.OPENAI_API_KEY || s.apiKeys?.OPENAI_API_KEY;
        if (!key) return res.status(400).json({ error: "Missing OPENAI_API_KEY" });
        text = await callOpenAI({ apiKey: key, baseUrl: process.env.OPENAI_BASE_URL, model: req.body.model || "gpt-4o-mini", messages, params });
      } else {
        // local (llama.cpp)
        text = await callLlamacpp({ baseUrl: process.env.LLAMACPP_BASE_URL, model: req.body.model, messages, params });
      }
    } catch (e) {
      if (provider === "llamacpp") {
        // Fallback to Claude
        const key = process.env.ANTHROPIC_API_KEY || s.apiKeys?.ANTHROPIC_API_KEY;
        if (!key) throw new Error("Local model failed and no fallback key is available.");
        text = await callAnthropic({ apiKey: key, model: "claude-3-5-sonnet-latest", messages, params });
      } else {
        throw e;
      }
    }
    
    // Process response to add code action buttons
    const processedText = processResponseWithCodeBlocks(text);
    res.json({ text: processedText });
  } catch (e) {
    console.error("[/api/chat] error:", e?.stack || e);
    res.status(500).json({ error: e.message });
  }
});

// Simple command endpoint for @save and @run
router.post("/api/command", express.json(), async (req, res) => {
  try {
    const { command, args } = req.body;
    
    if (command === "save") {
      const { language, code, filename } = args;
      const result = await runTool("jit", { 
        type: 'save', 
        response: `\`\`\`${language}\n${code}\n\`\`\`` 
      });
      res.json({ success: true, result, filename });
    } else if (command === "run") {
      const { filename } = args;
      const result = await runTool("jit", { 
        type: 'run', 
        filename: filename 
      });
      res.json({ success: true, result });
    } else {
      res.status(400).json({ error: "Unknown command" });
    }
  } catch (error) {
    console.error("[/api/command] error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { chatRouter: router };