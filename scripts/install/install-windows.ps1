Param(
  [string]$ModelDir = "$env:USERPROFILE\\.c9ai\\models\\phi3",
  [string]$ModelFile = "Phi-3-mini-4k-instruct-q4_K_M.gguf",
  [string]$ModelUrl = "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4_K_M.gguf",
  [string]$LlamaDir = "$env:LOCALAPPDATA\\llama.cpp",
  [string]$LlamaServerUrl = "https://github.com/ggerganov/llama.cpp/releases/latest/download/llama-server.exe",
  [int]$Port = 8080
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Function Ensure-Dir($path) {
  if (-not (Test-Path -LiteralPath $path)) {
    New-Item -ItemType Directory -Path $path | Out-Null
  }
}

Function Install-Node {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "Node already installed: $(node -v)" -ForegroundColor Green
    return
  }
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host "Installing Node.js LTS via winget..." -ForegroundColor Cyan
    winget install --id OpenJS.NodeJS.LTS -e --silent | Out-Null
  } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Host "Installing Node.js LTS via Chocolatey..." -ForegroundColor Cyan
    choco install nodejs-lts -y | Out-Null
  } else {
    throw "Neither winget nor choco found. Please install Node.js LTS manually from https://nodejs.org/en/download/"
  }
}

Function Install-C9AI {
  Write-Host "Installing c9ai globally..." -ForegroundColor Cyan
  npm install -g c9ai | Out-Null
}

Function Install-LlamaServer {
  Ensure-Dir $LlamaDir
  $serverPath = Join-Path $LlamaDir 'llama-server.exe'
  if (-not (Test-Path $serverPath)) {
    Write-Host "Downloading llama.cpp server..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $LlamaServerUrl -OutFile $serverPath
  }
  return $serverPath
}

Function Install-Phi3Model {
  Ensure-Dir $ModelDir
  $dest = Join-Path $ModelDir $ModelFile
  if (-not (Test-Path $dest)) {
    Write-Host "Downloading Phi-3 model (accept license terms on provider site if prompted)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $ModelUrl -OutFile $dest
  }
  return $dest
}

Function Start-LlamaServer($serverExe, $modelPath, $port) {
  $env:LLAMACPP_BASE_URL = "http://127.0.0.1:$port"
  Write-Host "Starting llama-server on $($env:LLAMACPP_BASE_URL)..." -ForegroundColor Yellow
  Start-Process -FilePath $serverExe -ArgumentList @('-m', $modelPath, '-p', $port, '-c', 4096) -NoNewWindow
  [Environment]::SetEnvironmentVariable('LLAMACPP_BASE_URL', $env:LLAMACPP_BASE_URL, 'User')
  Write-Host "Set user env var LLAMACPP_BASE_URL = $($env:LLAMACPP_BASE_URL)" -ForegroundColor Green
}

try {
  Install-Node
  Install-C9AI
  $server = Install-LlamaServer
  $model = Install-Phi3Model

  Write-Host "\nInstallation complete." -ForegroundColor Green
  Write-Host "- c9ai installed: $(c9ai --version 2>$null)" -ForegroundColor Green
  Write-Host "- llama-server: $server" -ForegroundColor Green
  Write-Host "- model: $model" -ForegroundColor Green

  Write-Host "\nStarting llama.cpp server (you can close and run manually later)..." -ForegroundColor Yellow
  Start-LlamaServer -serverExe $server -modelPath $model -port $Port

  Write-Host "\nTry: c9ai agent -p llamacpp \"say hello\"" -ForegroundColor Cyan
}
catch {
  Write-Error $_
  exit 1
}
