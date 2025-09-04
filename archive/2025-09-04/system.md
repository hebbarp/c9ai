**Request Flow**
- UI → SSE: Browser opens `EventSource` to `/api/agent?prompt=...&provider=...&allow=...`.
- Handler: `server/sse-agent-handler.js` sets SSE headers, reads settings, logs session.
- Context: Builds contextual prompt; detects incomplete info for follow‑ups.
- Preprocess: NL math converter tries local first (llama.cpp), may escalate to cloud if needed.
- Provider: `src/providers` picks local (`llamacpp`) by default; can be cloud or hybrid.
- Orchestrate: `agentStep()` detects/plans tool use, validates, and executes via `runTool()`.
- Tools: Whitelisted actions (`shell.run`, `fs.read`, `fs.write`, `web.search`, `jit`, etc.).
- Stream: Emits SSE events: `status`, `detected`, `plan`, `tool`, `toolResult`, `token`, `final`, `error`, `metadata`.
- Synthesis: Formats results, enhances code blocks; optional bulletize per user style.
- Fallback: If local can’t fulfill, escalates to cloud provider when configured.
- Persist: Context manager stores user/assistant turns; sets pending context if incomplete.

**Minimal Launch**
- Dependencies: Node.js 16+, `llama-server` in PATH, a `.gguf` model in `~/.c9ai/models/` or `./models/`.
- Quick start:
  - `npm install`
  - `node scripts/start-local-stack.js`
  - Opens UI at `http://127.0.0.1:8787` and starts llama.cpp on the first free port.
- Manual start:
  - Start llama.cpp: `llama-server -m /path/to/model.gguf --port 8080 --host 127.0.0.1 --api -c 4096 -ngl 20`
  - Export base URL: `export LLAMACPP_BASE_URL=http://127.0.0.1:8080`
  - Run API/UI: `node server/agent-api.js` (serves UI on `:8787`)

**Optional Cloud**
- Keys: `export ANTHROPIC_API_KEY=...` or `OPENAI_API_KEY=...` or `GEMINI_API_KEY=...`.
- Switch in UI Settings or edit `~/.c9ai/settings.json` (`provider`, `allowedTools`, `confirmThreshold`).

**Verify**
- Agent API: `curl http://127.0.0.1:8787/health` → `{ "ok": true }`
- llama.cpp: `curl http://127.0.0.1:8080/v1/models` → models listed
- UI: Open `http://127.0.0.1:8787`, send a prompt; watch SSE debug and tool traces.

