*** Begin Patch
*** Add File: src/providers/local-llamacpp.js
+"use strict";
+/**
+ * Llama.cpp provider shim (OpenAI-compatible server).
+ * Exposes: { name, defaultModel, supportsGrammar: true, call({messages, model, temperature, top_p, max_tokens, grammar}) }
+ *
+ * ENV:
+ *   LLAMACPP_BASE_URL (default http://127.0.0.1:8080)  // llama.cpp server started with --api
+ *   LLAMACPP_MODEL    (fallback model name)
+ *
+ * Notes:
+ * - llama.cpp OpenAI-compatible /v1/chat/completions supports "grammar" as a request field.
+ * - Requires Node 18+ (global fetch). If not, install undici and set globalThis.fetch.
+ */
+
+const BASE_URL = process.env.LLAMACPP_BASE_URL?.trim() || "http://127.0.0.1:8080";
+const DEFAULT_MODEL = process.env.LLAMACPP_MODEL?.trim() || "llama-3.1-8b-instruct-q4";
+
+function mapMessages(messages) {
+  // Already in {role, content} shape; just ensure strings
+  return messages.map(m => ({ role: m.role, content: String(m.content ?? "") }));
+}
+
+async function call(opts) {
+  const body = {
+    model: opts.model || DEFAULT_MODEL,
+    messages: mapMessages(opts.messages),
+    temperature: opts.temperature ?? 0.2,
+    top_p: opts.top_p ?? 1,
+    max_tokens: opts.max_tokens ?? 512,
+    stream: false
+  };
+  if (opts.grammar) body.grammar = opts.grammar; // <-- grammar goes straight through
+
+  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify(body)
+  });
+  if (!res.ok) {
+    const text = await res.text().catch(() => "");
+    throw new Error(`llamacpp call failed: ${res.status} ${text}`);
+  }
+  const data = await res.json();
+  const text = data?.choices?.[0]?.message?.content ?? "";
+  return { text };
+}
+
+module.exports = {
+  name: "local-llamacpp",
+  defaultModel: DEFAULT_MODEL,
+  supportsGrammar: true,
+  call
+};
+
*** End Patch
*** Begin Patch
*** Add File: src/providers/local-ollama.js
+"use strict";
+/**
+ * Ollama provider shim.
+ * Exposes: { name, defaultModel, supportsGrammar: false, call({messages, model, temperature, top_p, max_tokens}) }
+ *
+ * ENV:
+ *   OLLAMA_BASE_URL (default http://127.0.0.1:11434)
+ *   OLLAMA_MODEL    (fallback model name)
+ *
+ * Notes:
+ * - Official /api/chat does NOT (generally) support grammars. We keep supportsGrammar=false.
+ * - If your fork supports JSON schema/format, you can add it here later.
+ * - Requires Node 18+ (global fetch).
+ */
+
+const BASE_URL = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
+const DEFAULT_MODEL = process.env.OLLAMA_MODEL?.trim() || "llama3.1:8b-instruct-q4_0";
+
+function mapMessages(messages) {
+  // Ollama expects {role, content}
+  return messages.map(m => ({ role: m.role, content: String(m.content ?? "") }));
+}
+
+async function call(opts) {
+  const body = {
+    model: opts.model || DEFAULT_MODEL,
+    messages: mapMessages(opts.messages),
+    stream: false,
+    options: {
+      temperature: opts.temperature ?? 0.2,
+      top_p: opts.top_p ?? 1,
+      num_predict: opts.max_tokens ?? 512
+    }
+  };
+  // NOTE: No grammar pass-through here (supportsGrammar=false)
+
+  const res = await fetch(`${BASE_URL}/api/chat`, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify(body)
+  });
+  if (!res.ok) {
+    const text = await res.text().catch(() => "");
+    throw new Error(`ollama call failed: ${res.status} ${text}`);
+  }
+  const data = await res.json();
+  const text = data?.message?.content ?? "";
+  return { text };
+}
+
+module.exports = {
+  name: "local-ollama",
+  defaultModel: DEFAULT_MODEL,
+  supportsGrammar: false,
+  call
+};
+
*** End Patch
*** Begin Patch
*** Add File: src/providers/index.js
+"use strict";
+/**
+ * Helper to pick a local provider by name via ENV or argument.
+ * Usage:
+ *   const { getLocalProvider } = require("./src/providers");
+ *   const provider = getLocalProvider(process.env.LOCAL_PROVIDER || "llamacpp");
+ */
+
+function getLocalProvider(which = "llamacpp") {
+  if (which === "ollama") return require("./local-ollama");
+  return require("./local-llamacpp"); // default
+}
+
+module.exports = { getLocalProvider };
+
*** End Patch
*** Begin Patch
*** Add File: config/local.example.json
+{
+  "//": "Example local provider config. Copy to config/local.json and edit.",
+  "provider": "llamacpp",
+  "llamacpp": {
+    "base_url": "http://127.0.0.1:8080",
+    "model": "llama-3.1-8b-instruct-q4"
+  },
+  "ollama": {
+    "base_url": "http://127.0.0.1:11434",
+    "model": "llama3.1:8b-instruct-q4_0"
+  }
+}
+
*** End Patch
