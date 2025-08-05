# C9 AI CLI PowerShell Installer
# Run with: PowerShell -ExecutionPolicy Bypass -File install.ps1

Write-Host "🔧 Installing C9 AI CLI..." -ForegroundColor Green

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ Please run as Administrator" -ForegroundColor Red
    Read-Host "Press any key to exit"
    exit 1
}

# Create installation directory
$installDir = "C:\Program Files\C9AI"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# Download or copy executable (modify URL as needed)
$exePath = "$installDir\c9ai.exe"
if (Test-Path "c9ai-win.exe") {
    Copy-Item "c9ai-win.exe" $exePath
    Write-Host "✅ Copied executable to $installDir" -ForegroundColor Green
} else {
    Write-Host "❌ c9ai-win.exe not found in current directory" -ForegroundColor Red
    Read-Host "Press any key to exit"
    exit 1
}

# Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "Machine")
if ($currentPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$installDir", "Machine")
    Write-Host "✅ Added to system PATH" -ForegroundColor Green
}

# Create Start Menu shortcut
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:ALLUSERSPROFILE\Microsoft\Windows\Start Menu\Programs\C9 AI CLI.lnk")
$Shortcut.TargetPath = $exePath
$Shortcut.Save()

Write-Host ""
Write-Host "🎉 C9 AI CLI installed successfully!" -ForegroundColor Green
Write-Host "📍 Installed to: $installDir" -ForegroundColor Cyan
Write-Host "🔄 Restart your command prompt to use 'c9ai' command" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press any key to exit"