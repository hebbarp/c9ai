# Simple Installer Creation Guide

## Quick Summary: 3 Easy Options

### Option 1: Batch File (Easiest - No tools needed)
1. Run `npm run build:exe` 
2. Copy `dist/c9ai-win.exe` and `simple-install.bat` to a folder
3. Give this folder to users
4. Users right-click `simple-install.bat` → "Run as administrator"

### Option 2: NSIS Installer (Professional)
1. Download NSIS from https://nsis.sourceforge.io/Download
2. Install NSIS on Windows
3. Run `npm run build:exe`
4. Run `makensis installer.nsi`
5. Share `dist/c9ai-installer.exe` with users

### Option 3: PowerShell Installer (Modern)
1. Run `npm run build:exe`
2. Users run PowerShell script (see below)

## Detailed Steps

### For Option 1 (Batch File):
```bash
# 1. Build executable
npm run build:exe

# 2. Create distribution package
mkdir release
copy dist\c9ai-win.exe release\
copy simple-install.bat release\

# 3. Zip the release folder
# Give users the zip file
```

### For Option 2 (NSIS):
```bash
# 1. Install NSIS first from website
# 2. Build executable  
npm run build:exe

# 3. Create installer
makensis installer.nsi

# 4. Share dist/c9ai-installer.exe
```

### PowerShell Alternative: