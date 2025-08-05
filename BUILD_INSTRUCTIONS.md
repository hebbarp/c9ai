# Building C9AI Installers

## Prerequisites

- Node.js 16+ installed
- Windows environment (for MSI building)
- WiX Toolset installed (for MSI creation)

## Building Process

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Executable
```bash
npm run build:exe
```
This creates platform-specific executables in the `dist/` folder:
- `c9ai-win.exe` (Windows)
- `c9ai-macos` (macOS) 
- `c9ai-linux` (Linux)

### 3. Build MSI Installer (Windows only)
```bash
npm run build:msi
```
Creates `dist/c9ai-installer.msi`

### 4. Build Everything
```bash
npm run build:all
```

### 5. Clean Build Files
```bash
npm run clean
```

## Configuration

### MSI Installer Settings
Edit `installer.config.js` to customize:
- Product information
- Registry entries
- Shortcuts
- Installation directory
- Upgrade codes (generate unique GUIDs for production)

### PKG Settings
Edit the `pkg` section in `package.json` to customize:
- Target platforms
- Included assets
- Output paths

## Distribution Files

After building, you'll have:
- `dist/c9ai-win.exe` - Standalone Windows executable
- `dist/c9ai-installer.msi` - Windows MSI installer
- `dist/c9ai-macos` - macOS executable
- `dist/c9ai-linux` - Linux executable

## Enterprise Deployment

The MSI installer provides:
- Standard Windows installation experience
- Registry entries for version tracking
- PATH environment variable setup
- Start menu shortcuts
- Proper uninstall support
- Upgrade capability

## Security Notes

- All executables are self-contained
- No external dependencies required at runtime
- Local LLM processing ensures data privacy
- Enterprise security assessment available in `ENTERPRISE_SECURITY.md`