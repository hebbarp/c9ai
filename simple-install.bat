@echo off
echo Installing C9 AI CLI...

REM Create installation directory
mkdir "C:\Program Files\C9AI" 2>nul

REM Copy executable
copy "c9ai-win.exe" "C:\Program Files\C9AI\" >nul

REM Add to PATH
setx PATH "%PATH%;C:\Program Files\C9AI" /M >nul

echo.
echo ✅ C9 AI CLI installed successfully!
echo.
echo To use: Open new command prompt and type: c9ai-win
echo.
pause