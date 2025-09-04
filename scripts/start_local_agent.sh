#!/bin/bash
set -e

# c9ai — Local Agent Startup (llama.cpp)
echo "🔧 c9ai local-agent bootstrap (llama.cpp)"

# Config
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"
CTX="${CTX:-4096}"
PARALLEL="${PARALLEL:-2}"
LLAMACPP_BIN="${LLAMACPP_BIN:-llama-server}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

install_llamacpp_if_needed() {
  if need_cmd "$LLAMACPP_BIN"; then
    echo "✅ llama.cpp present: $LLAMACPP_BIN"
    return 0
  fi
  echo "ℹ️  $LLAMACPP_BIN not found."
  if [[ "$(uname -s)" == "Darwin" ]] && need_cmd brew; then
    echo "▶️  Installing llama.cpp via Homebrew…"
    brew install llama.cpp
    if ! need_cmd "$LLAMACPP_BIN"; then
      echo "❌ Brew installation succeeded but $LLAMACPP_BIN not on PATH"
      exit 1
    fi
    return 0
  fi
  echo "❌ Auto-install unavailable. Please install llama.cpp manually."
  exit 1
}

find_best_model() {
  # Check c9ai models dir first
  for d in "$HOME/.c9ai/models" "$HOME/models" "$HOME/Models" "$HOME/Downloads" "."; do
    if [ ! -d "$d" ]; then continue; fi
    for model in $(find "$d" -maxdepth 2 -name "*.gguf" 2>/dev/null | head -5); do
      if [ -f "$model" ]; then
        echo "$model"
        return 0
      fi
    done
  done
  return 1
}

kill_port_if_listening() {
  local port="$1"
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "ℹ️  Port $port in use; attempting to free it…"
    local pid=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
      sleep 1
    fi
  fi
}

wait_for_server() {
  local url="$1" tries=30
  echo -n "⏳ Waiting for llama.cpp: $url "
  for i in $(seq 1 $tries); do
    if curl -s "$url/v1/models" >/dev/null 2>&1; then
      echo " ready."
      return 0
    fi
    echo -n "."
    sleep 1
  done
  echo
  echo "❌ Timeout waiting for $url"
  return 1
}

# Main execution
install_llamacpp_if_needed

MODEL_FILE="$(find_best_model || true)"
if [ -z "$MODEL_FILE" ]; then
  echo "❌ No GGUF models found. Please place a model in ~/.c9ai/models/ and re-run."
  exit 1
fi
echo "📦 Using model: $(basename "$MODEL_FILE")"

kill_port_if_listening "$PORT"
echo "▶️  Starting llama.cpp server on :$PORT"

"$LLAMACPP_BIN" \
  --model "$MODEL_FILE" \
  --host "$HOST" --port "$PORT" \
  --ctx-size "$CTX" --parallel "$PARALLEL" \
  >/tmp/llama-server.log 2>&1 &

SERVER_PID=$!
trap 'echo "⏹ Stopping llama.cpp ($SERVER_PID)"; kill $SERVER_PID 2>/dev/null || true' EXIT

BASE_URL="http://$HOST:$PORT"
wait_for_server "$BASE_URL"

# Set environment for c9ai
export LLAMACPP_BASE_URL="$BASE_URL"
export LLAMACPP_MODEL="$(basename "$MODEL_FILE" .gguf)"
export LOCAL_PROVIDER="llamacpp"

echo "✅ Server ready at $BASE_URL"
echo "🎉 You can now run: switch local"
echo "   Then try: create a file named test.txt with content: Hello World"

# Keep server running
echo "Press Ctrl+C to stop the server..."
wait $SERVER_PID