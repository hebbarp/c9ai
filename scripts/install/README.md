# c9ai Install Scripts (Windows, macOS, Linux)

These scripts install Node.js, llama.cpp (server), a Phi‑3 GGUF model, and c9ai. They also start the local llama.cpp server and configure `LLAMACPP_BASE_URL` so c9ai can talk to it.

Contents
- `install-windows.ps1` — PowerShell installer for Windows
- `install-mac.sh` — Bash installer for macOS
- `install-linux.sh` — Bash installer for Linux

Prerequisites
- Internet connection to download Node, llama.cpp, and the Phi‑3 model.
- Enough disk space for the model (~2–4 GB depending on quantization).
- You may need to accept license terms for Phi‑3 on the model host.

Windows (PowerShell)
- Run: `powershell -ExecutionPolicy Bypass -File .\\scripts\\install\\install-windows.ps1`
- Parameters:
  - `-ModelDir` (default `C:\\models\\phi3`)
  - `-ModelFile` (default `Phi-3-mini-4k-instruct-q4_K_M.gguf`)
  - `-ModelUrl` (change if you have a private mirror)
  - `-LlamaDir` (default `%LOCALAPPDATA%\\llama.cpp`)
  - `-Port` (default `8080`)
- What it does:
  - Installs Node via winget/choco if missing, then `npm i -g c9ai`.
  - Downloads `llama-server.exe` from llama.cpp releases.
  - Downloads a Phi‑3 GGUF to `-ModelDir`.
  - Starts llama.cpp and sets user `LLAMACPP_BASE_URL`.
- Try: `c9ai agent -p llamacpp "say hello"`

macOS (bash)
- Run: `bash ./scripts/install/install-mac.sh`
- Env overrides: `MODEL_DIR`, `MODEL_FILE`, `MODEL_URL`, `PORT`
- What it does:
  - Installs Node via Homebrew or nvm; installs `c9ai`.
  - Installs llama.cpp via Homebrew.
  - Downloads a Phi‑3 GGUF to `MODEL_DIR`.
  - Starts `llama-server` in background; sets `LLAMACPP_BASE_URL` for the session.
- Try: `c9ai agent -p llamacpp 'say hello'`

Linux (bash)
- Run: `bash ./scripts/install/install-linux.sh`
- Env overrides: `MODEL_DIR`, `MODEL_FILE`, `MODEL_URL`, `PORT`
- What it does:
  - Installs build tools (apt/dnf/pacman).
  - Installs Node via nvm; installs `c9ai`.
  - Builds llama.cpp and installs `llama-server` to `~/.local/bin`.
  - Downloads a Phi‑3 GGUF to `MODEL_DIR`.
  - Starts `llama-server` in background; sets `LLAMACPP_BASE_URL` for the session.
- Try: `c9ai agent -p llamacpp 'say hello'`

Optional: Use Ollama instead of llama.cpp
- Install Ollama (Windows/macOS/Linux): https://ollama.com
- Pull model: `ollama pull phi3:mini`
- Use with c9ai: `c9ai agent -p ollama "say hello"`
- Set default provider: set env `LOCAL_PROVIDER=ollama`.

Troubleshooting
- License/403 on model download: The default `MODEL_URL` may require accepting a license on the host (e.g., Hugging Face). Provide your own `MODEL_URL` that you are permitted to use.
- PATH issues:
  - Linux: ensure `~/.local/bin` is in PATH for `llama-server`.
  - macOS: if using nvm, source your profile before running `c9ai`.
- Performance:
  - GPU builds are faster. On Windows, use a cuBLAS build of llama.cpp; on Linux/macOS use an accelerated build via your package manager.
- Health check: `http://127.0.0.1:8080/v1/models` should return JSON when the server is up.

Security note
- These scripts download binaries and models from the internet. If required, point `MODEL_URL` to a vetted, internally hosted location and verify checksums in your environment.
