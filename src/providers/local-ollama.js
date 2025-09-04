"use strict";
/**
 * Ollama provider shim.
 * Exposes: { name, defaultModel, supportsGrammar: false, call({messages, model, temperature, top_p, max_tokens}) }
 *
 * ENV:
 *   OLLAMA_BASE_URL (default http://127.0.0.1:11434)
 *   OLLAMA_MODEL    (fallback model name)
 *
 * Notes:
 * - Official /api/chat does NOT (generally) support grammars. We keep supportsGrammar=false.
 * - If your fork supports JSON schema/format, you can add it here later.
 * - Requires Node 18+ (global fetch).
 */

const BASE_URL = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL?.trim() || "llama3.1:8b-instruct-q4_0";

function mapMessages(messages) {
  // Ollama expects {role, content}
  return messages.map(m => ({ role: m.role, content: String(m.content ?? "") }));
}

async function call(opts) {
  const body = {
    model: opts.model || DEFAULT_MODEL,
    messages: mapMessages(opts.messages),
    stream: false,
    options: {
      temperature: opts.temperature ?? 0.2,
      top_p: opts.top_p ?? 1,
      num_predict: opts.max_tokens ?? 512
    }
  };
  // NOTE: No grammar pass-through here (supportsGrammar=false)

  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ollama call failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  const text = data?.message?.content ?? "";
  return { text };
}

module.exports = {
  name: "local-ollama",
  defaultModel: DEFAULT_MODEL,
  supportsGrammar: false,
  call
};