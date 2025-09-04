#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install from https://nodejs.org/"
  read -p "Press Enter to exit…"
  exit 1
fi

node scripts/start-local-stack.js
read -p "Press Enter to exit…"