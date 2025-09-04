@echo off
echo 🌟 Installing C9 AI - Windows Installation
echo ============================================

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is required. Install from: https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Node.js found: 
node --version

REM Check if Claude CLI is available
claude --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Claude CLI not found. Please install Claude CLI first.
    echo 💡 Visit: https://docs.anthropic.com/claude/docs/cli
    pause
    exit /b 1
)
echo ✅ Claude CLI: Ready

echo 📦 Installing dependencies...
npm install

echo ✅ C9 AI installed successfully!
echo.
echo 🚀 Getting Started:
echo    c9ai.bat                # Interactive mode  
echo    c9ai.bat --help         # Show all commands
echo    c9ai.bat claude "hello" # Use Claude AI
echo.
echo 💡 Add this directory to your PATH for global access
echo 🎉 Ready for autonomous AI-powered productivity!
pause