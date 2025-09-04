#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Fix PATH for macOS double-click execution (includes homebrew paths)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Check for Node.js
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "Node.js not found" message "Install Node.js from https://nodejs.org/"'
  exit 1
fi

# Check for llama-server
if ! command -v llama-server >/dev/null 2>&1; then
  osascript -e 'display alert "llama-server not found" message "Install llama.cpp with: brew install llama.cpp"'
  exit 1
fi

echo "🚀 Starting C9AI local stack..."
echo "📍 llama-server found at: $(which llama-server)"
echo "📂 Working directory: $(pwd)"

node scripts/start-local-stack.js