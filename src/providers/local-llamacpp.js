"use strict";
/**
 * Llama.cpp provider shim (OpenAI-compatible).
 * - Direct-connect only (no autostart).
 * - Auto-detects the active model if LLAMACPP_MODEL is "auto" or unset.
 *
 * ENV:
 *   LLAMACPP_BASE_URL (default http://127.0.0.1:8080)
 *   LLAMACPP_MODEL    (model id/label or "auto")
 */

const { readFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");

const BASE_URL = (process.env.LLAMACPP_BASE_URL || "http://127.0.0.1:8080").trim();
const MODEL_ENV = (process.env.LLAMACPP_MODEL || "auto").trim(); // "auto" means detect from server

function loadConciseness() {
  try {
    const s = JSON.parse(readFileSync(join(homedir(), ".c9ai", "settings.json"), "utf-8"));
    const c = Math.max(0, Math.min(1, Number(s?.style?.conciseness ?? 0.6)));
    return c;
  } catch { return 0.6; }
}

function mapMessages(messages) {
  // Already in {role, content} shape; just ensure strings
  return messages.map(m => ({ role: m.role, content: String(m.content ?? "") }));
}

async function detectActiveModel() {
  const res = await fetch(`${BASE_URL}/v1/models`, { method: "GET" });
  if (!res.ok) throw new Error(`models list failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  // Prefer OpenAI-ish "data[0].id" if present; else first "models[0].model"
  const id = data?.data?.[0]?.id || data?.models?.[0]?.model || data?.models?.[0]?.name;
  if (!id) throw new Error("no models reported by server");
  return id;
}

async function call(opts) {
  // quick connectivity check (no autostart logic here)
  try {
    const ping = await fetch(`${BASE_URL}/v1/models`, { method: "GET" });
    if (!ping.ok) {
      const t = await ping.text().catch(() => "");
      throw new Error(`healthcheck failed: ${ping.status} ${ping.statusText} ${t.slice(0,200)}`);
    }
  } catch (e) {
    throw new Error(
      `llamacpp not reachable at ${BASE_URL}. ` +
      `Start llama-server with --api, or set LLAMACPP_BASE_URL. Detail: ${e.message || e}`
    );
  }
  // Resolve model: explicit > env > auto-detect
  let modelName = (opts.model && String(opts.model).trim()) || (MODEL_ENV !== "auto" ? MODEL_ENV : "");
  if (!modelName) {
    modelName = await detectActiveModel();
    // eslint-disable-next-line no-console
    console.log(`🧠 llama.cpp: auto-detected active model: ${modelName}`);
  }

  const c = loadConciseness();
  const cap = Math.round((opts.max_tokens || 512) * (0.5 + (1 - c) * 0.5)); // 0.6 -> ~0.7x, 1.0 -> 0.5x
  
  const body = {
    model: modelName,
    messages: mapMessages(opts.messages),
    // Safer, less loopy defaults tuned by conciseness:
    max_tokens: Math.max(200, Math.min(cap, 700)),
    temperature: opts.temperature ?? 0.4,
    top_p: opts.top_p ?? 0.9,
    top_k: opts.top_k ?? 40,
    // penalties
    repeat_penalty: opts.repeat_penalty ?? 1.18,
    repeat_last_n: opts.repeat_last_n ?? 256,
    frequency_penalty: opts.frequency_penalty ?? 0.2,
    presence_penalty: opts.presence_penalty ?? 0.2,
    penalize_nl: opts.penalize_nl ?? true,
    // stabilization
    mirostat: opts.mirostat ?? 2,
    mirostat_tau: opts.mirostat_tau ?? 5.0,
    mirostat_eta: opts.mirostat_eta ?? 0.1,
    // common stop tokens
    stop: opts.stop ?? ["</s>", "<|eot_id|>", "<|end|>", "<|assistant_end|>", "User:", "Assistant:"],
    stream: false
  };
  if (opts.grammar) body.grammar = opts.grammar; // <-- grammar goes straight through

  const url = `${BASE_URL}/v1/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const hint = text.slice(0, 500).replace(/\s+/g, " ");
    throw new Error(`llamacpp call failed: ${res.status} ${res.statusText} url=${url} resp=${hint}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  return { text };
}

module.exports = {
  name: "local-llamacpp",
  defaultModel: MODEL_ENV,
  supportsGrammar: true,
  call
};