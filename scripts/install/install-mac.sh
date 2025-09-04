#!/usr/bin/env bash
set -euo pipefail

MODEL_DIR="${MODEL_DIR:-$HOME/.c9ai/models/phi3}"
MODEL_FILE="${MODEL_FILE:-Phi-3-mini-4k-instruct-q4_K_M.gguf}"
MODEL_URL="${MODEL_URL:-https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4_K_M.gguf}"
PORT="${PORT:-8080}"

need_cmd() { command -v "$1" >/dev/null 2>&1; }
ensure_dir() { [ -d "$1" ] || mkdir -p "$1"; }

install_node() {
  if need_cmd node; then
    echo "Node already installed: $(node -v)"
    return
  fi
  if need_cmd brew; then
    echo "Installing Node.js via Homebrew..."
    brew install node
  else
    echo "Installing nvm + Node.js LTS..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh"
    nvm install --lts
  fi
}

install_llamacpp() {
  if need_cmd llama-server; then
    echo "llama-server already installed"
    return
  fi
  if need_cmd brew; then
    echo "Installing llama.cpp via Homebrew..."
    brew install llama.cpp
  else
    echo "Homebrew not found; please install llama.cpp manually: https://github.com/ggerganov/llama.cpp"
    exit 1
  fi
}

install_c9ai() {
  echo "Installing c9ai globally..."
  npm install -g c9ai
}

download_model() {
  ensure_dir "$MODEL_DIR"
  local dest="$MODEL_DIR/$MODEL_FILE"
  if [ ! -f "$dest" ]; then
    echo "Downloading Phi-3 model (accept license terms if prompted)..."
    curl -L "$MODEL_URL" -o "$dest"
  fi
  echo "$dest"
}

start_server() {
  local model_path="$1"
  export LLAMACPP_BASE_URL="http://127.0.0.1:${PORT}"
  echo "Starting llama-server on ${LLAMACPP_BASE_URL}..."
  (nohup llama-server -m "$model_path" -p "$PORT" -c 4096 >/tmp/llama-server.log 2>&1 &)
  echo "Set LLAMACPP_BASE_URL=${LLAMACPP_BASE_URL}"
}

install_node
install_llamacpp
install_c9ai
MODEL_PATH=$(download_model)

echo
echo "Installation complete."
echo "- c9ai: $(c9ai --version 2>/dev/null || true)"
echo "- llama-server: $(command -v llama-server)"
echo "- model: ${MODEL_PATH}"

echo
echo "Starting llama.cpp server (run in background)."
start_server "$MODEL_PATH"

echo
echo "Try: c9ai agent -p llamacpp 'say hello'"
