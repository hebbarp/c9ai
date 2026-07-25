# Builds the c9ai Windows installer.
# Output: installer\output\c9ai-setup-<version>.exe
# Requires: node/npm on PATH, Inno Setup 6 (ISCC.exe).

param(
    [string]$NodeVersion = "22.12.0"
)

$ErrorActionPreference = "Stop"

$installerDir = $PSScriptRoot
$repoRoot = Split-Path $installerDir -Parent
$staging = Join-Path $installerDir "staging"
$cache = Join-Path $installerDir "cache"

$pkg = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$version = $pkg.version
Write-Host "Building c9ai installer v$version (Node $NodeVersion)" -ForegroundColor Cyan

# 1. Compile TypeScript
Push-Location $repoRoot
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
} finally { Pop-Location }

# 2. Stage the app: dist + docs + production node_modules
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
$appDir = Join-Path $staging "app"
New-Item -ItemType Directory -Force (Join-Path $appDir "docs") | Out-Null

Copy-Item (Join-Path $repoRoot "dist") (Join-Path $appDir "dist") -Recurse
Copy-Item (Join-Path $repoRoot "package.json") $appDir
Copy-Item (Join-Path $repoRoot "package-lock.json") $appDir
foreach ($f in @("README.md", "CHANGELOG.md", "LICENSE")) {
    $src = Join-Path $repoRoot $f
    if (Test-Path $src) { Copy-Item $src $appDir }
}
Copy-Item (Join-Path $repoRoot "docs\create-your-models.md") (Join-Path $appDir "docs")
if (Test-Path (Join-Path $repoRoot "samples")) {
    Copy-Item (Join-Path $repoRoot "samples") (Join-Path $appDir "samples") -Recurse
}

Write-Host "Installing production dependencies into staging..." -ForegroundColor Cyan
Push-Location $appDir
try {
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
} finally { Pop-Location }

# 3. Portable Node runtime (cached download)
New-Item -ItemType Directory -Force $cache | Out-Null
$nodeZip = Join-Path $cache "node-v$NodeVersion-win-x64.zip"
if (-not (Test-Path $nodeZip)) {
    $url = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
    Write-Host "Downloading $url ..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $url -OutFile $nodeZip -UseBasicParsing
}
$nodeExtract = Join-Path $cache "node-v$NodeVersion-win-x64"
if (-not (Test-Path $nodeExtract)) {
    Expand-Archive -Path $nodeZip -DestinationPath $cache
}
New-Item -ItemType Directory -Force (Join-Path $staging "runtime") | Out-Null
Copy-Item (Join-Path $nodeExtract "node.exe") (Join-Path $staging "runtime\node.exe")

# 4. Smoke test the staged app with the bundled runtime
Write-Host "Smoke-testing staged app..." -ForegroundColor Cyan
$smoke = & (Join-Path $staging "runtime\node.exe") (Join-Path $appDir "dist\index.js") --help 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Host $smoke
    throw "Staged app failed to run with bundled node.exe"
}

# 5. Compile the installer
$iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $iscc)) { $iscc = (Get-Command ISCC.exe -ErrorAction Stop).Source }
& $iscc /Qp "/DAppVersion=$version" (Join-Path $installerDir "c9ai.iss")
if ($LASTEXITCODE -ne 0) { throw "ISCC failed" }

$out = Join-Path $installerDir "output\c9ai-setup-$version.exe"
$sizeMB = [math]::Round((Get-Item $out).Length / 1MB, 1)
Write-Host "Done: $out ($sizeMB MB)" -ForegroundColor Green
