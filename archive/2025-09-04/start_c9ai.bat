@echo off
setlocal enabledelayedexpansion
cd /d %~dp0

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Please install from https://nodejs.org/
  pause
  exit /b 1
)

node scripts\start-local-stack.js
pause