*** Begin Patch
*** Add File: scripts/start_local_agent.sh
+#!/usr/bin/env bash
+set -euo pipefail
+
+# c9ai — Local Agent Startup (llama.cpp)
+# What it does:
+# 1) Auto-install llama.cpp if missing (Homebrew on macOS).
+# 2) Pick a small, available GGUF model (TinyLlama/Gemma/PHI prioritized).
+# 3) Start llama.cpp OpenAI-compatible server with sensible params.
+# 4) Verify connectivity with a test chat call.
+# 5) Launch c9ai's agentic loop (fs.write -> fs.read smoke test).
+#
+# Usage:
+#   ./scripts/start_local_agent.sh
+# Env (optional):
+#   MODEL_PATH=/path/to/model.gguf
+#   HOST=127.0.0.1 PORT=8080 CTX=8192 PARALLEL=2
+#   LLAMACPP_BIN=llama-server
+#
+
+### -------- Config --------
+HOST="${HOST:-127.0.0.1}"
+PORT="${PORT:-8080}"
+CTX="${CTX:-8192}"
+PARALLEL="${PARALLEL:-2}"
+LLAMACPP_BIN="${LLAMACPP_BIN:-llama-server}"
+MODELS_DIR_DEFAULT="$HOME/models"
+MODEL_PATH="${MODEL_PATH:-}"
+### ------------------------
+
+echo "🔧 c9ai local-agent bootstrap (llama.cpp)"
+
+need_cmd() {
+  command -v "$1" >/dev/null 2>&1
+}
+
+install_llamacpp_if_needed() {
+  if need_cmd "$LLAMACPP_BIN"; then
+    echo "✅ llama.cpp present: $LLAMACPP_BIN"
+    return 0
+  fi
+  echo "ℹ️  $LLAMACPP_BIN not found."
+  # macOS: try Homebrew
+  if [[ "$(uname -s)" == "Darwin" ]] && need_cmd brew; then
+    echo "▶️  Installing llama.cpp via Homebrew…"
+    brew install llama.cpp
+    if ! need_cmd "$LLAMACPP_BIN"; then
+      echo "❌ Brew installation succeeded but $LLAMACPP_BIN not on PATH. Ensure Homebrew's bin dir is exported."
+      exit 1
+    fi
+    return 0
+  fi
+  echo "❌ Auto-install unavailable on this platform."
+  echo "   Please install llama.cpp server manually (build or package manager), then re-run:"
+  echo "   https://github.com/ggerganov/llama.cpp"
+  exit 1
+}
+
+find_best_model() {
+  # If MODEL_PATH provided and exists, use it.
+  if [[ -n "${MODEL_PATH}" && -f "${MODEL_PATH}" ]]; then
+    echo "${MODEL_PATH}"
+    return 0
+  fi
+  local base="${MODELS_DIR_DEFAULT}"
+  # Allow alternate common locations
+  for d in "$base" "$HOME/Models" "$HOME/Downloads" "."; do
+    [[ -d "$d" ]] || continue
+    # Preferred (small first): TinyLlama, Gemma 2B IT, PHI-3 mini, Llama 3.1 8B IT, Gemma 2 9B IT
+    # Extendable by adding more patterns.
+    mapfile -t candidates < <( \
+      find "$d" -maxdepth 3 -type f -name '*.gguf' 2>/dev/null | \
+      awk 'BEGIN{IGNORECASE=1}
+        /tinyllama/ {print; next}
+        /gemma[-_]?2[^0-9]*2b.*(it|instruct)/ {print; next}
+        /phi[-_]?3.*mini.*(it|instruct)/ {print; next}
+        /llama[-_]?3(\.1)?[-_]?8b.*(it|instruct)/ {print; next}
+        /gemma[-_]?2[^0-9]*9b.*(it|instruct)/ {print; next}
+        {print}' )
+    )
+    if [[ ${#candidates[@]} -gt 0 ]]; then
+      # Pick smallest by size among candidates to keep memory footprint low
+      local best
+      best=$(ls -S "${candidates[@]}" 2>/dev/null | tail -n 1)
+      if [[ -n "$best" && -f "$best" ]]; then
+        echo "$best"
+        return 0
+      fi
+    fi
+  done
+  return 1
+}
+
+kill_port_if_listening() {
+  local port="$1"
+  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
+    echo "ℹ️  Port $port in use; attempting to free it…"
+    local pid
+    pid=$(lsof -ti tcp:"$port" -sTCP:LISTEN || true)
+    if [[ -n "${pid:-}" ]]; then
+      kill "$pid" || true
+      sleep 1
+    fi
+  fi
+}
+
+wait_for_server() {
+  local url="$1" tries=60
+  echo -n "⏳ Waiting for llama.cpp: $url "
+  for i in $(seq 1 $tries); do
+    if curl -s "$url/v1/models" >/dev/null; then
+      echo "ready."
+      return 0
+    fi
+    echo -n "."
+    sleep 1
+  done
+  echo
+  echo "❌ Timeout waiting for $url"
+  return 1
+}
+
+verify_chat_works() {
+  local url="$1"
+  echo "🔎 Verifying chat completion API…"
+  local payload='{"model":"PLACEHOLDER","messages":[{"role":"user","content":"hi"}],"max_tokens":8}'
+  local resp
+  resp=$(curl -s -X POST "$url/v1/chat/completions" -H 'content-type: application/json' -d "$payload" || true)
+  if [[ "$resp" == *"choices"* ]]; then
+    echo "✅ Chat endpoint responding."
+  else
+    echo "⚠️  Chat endpoint response unexpected. Proceeding anyway."
+  fi
+}
+
+run_agentic_smoke() {
+  echo "🧪 Running c9ai agentic smoke test (fs.write -> fs.read)…"
+  node - <<'NODE'
+const { getLocalProvider } = require('./src/providers');
+const { agentStep } = require('./src/agent/runStep');
+const { makeSynthesizer } = require('./src/agent/synthesize');
+const { runTool } = require('./src/tools/runner');
+
+(async () => {
+  const provider = getLocalProvider(process.env.LOCAL_PROVIDER || 'llamacpp');
+  const prompt = 'Create a file named agent-test.txt with exactly: This is a test for the agentic system. Then read agent-test.txt and show me its contents.';
+  const result = await agentStep(provider, prompt, {
+    allowedTools: ['shell.run','script.run','fs.read','fs.write'],
+    runTool: (name, args) => runTool(name, args),
+    synthesize: makeSynthesizer(provider),
+    confirmThreshold: 0.6
+  });
+  console.log('\n--- FINAL OUTPUT ---\n' + result + '\n--------------------');
+})();
+NODE
+}
+
+### 1) Ensure llama.cpp installed
+install_llamacpp_if_needed
+
+### 2) Pick a model
+MODEL_FILE="$(find_best_model || true)"
+if [[ -z "${MODEL_FILE}" ]]; then
+  echo "❌ No GGUF models found in common locations. Place a model in $MODELS_DIR_DEFAULT (or set MODEL_PATH=/path/to/model.gguf) and re-run."
+  echo "   Example sources: TinyLlama, Gemma 2 (IT), PHI-3 mini, Llama 3.1 8B IT in GGUF."
+  exit 1
+fi
+echo "📦 Using model: $MODEL_FILE"
+
+### 3) Start server
+kill_port_if_listening "$PORT"
+echo "▶️  Starting llama.cpp server :$PORT"
+"$LLAMACPP_BIN" \
+  --model "$MODEL_FILE" \
+  --host "$HOST" --port "$PORT" \
+  --ctx-size "$CTX" --parallel "$PARALLEL" \
+  --api \
+  >/tmp/llama-server.log 2>&1 &
+SERVER_PID=$!
+trap 'echo "⏹ Stopping llama.cpp ($SERVER_PID)"; kill $SERVER_PID 2>/dev/null || true' EXIT
+
+### 4) Verify connectivity
+BASE_URL="http://$HOST:$PORT"
+wait_for_server "$BASE_URL"
+verify_chat_works "$BASE_URL"
+
+### 5) Export env for c9ai provider shim and launch smoke test
+export LLAMACPP_BASE_URL="$BASE_URL"
+export LLAMACPP_MODEL="$(basename "$MODEL_FILE" .gguf)"
+export LOCAL_PROVIDER="llamacpp"
+echo "✅ Env set: LLAMACPP_BASE_URL=$LLAMACPP_BASE_URL, LLAMACPP_MODEL=$LLAMACPP_MODEL"
+
+run_agentic_smoke
+
+echo "🎉 Local agent ready. You can now run your usual c9ai commands in this shell."
+
*** End Patch
*** Begin Patch
*** Update File: package.json
@@
   "scripts": {
+    "agent:start": "bash scripts/start_local_agent.sh"
   }
*** End Patch

