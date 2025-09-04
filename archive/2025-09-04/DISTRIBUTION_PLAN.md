# C9AI Cross-Platform Distribution Plan

## Overview
This document outlines the strategy for distributing C9AI across macOS, Linux, and Windows platforms.

## Current Architecture
- Node.js backend with Express server
- HTML/CSS/JS frontend served statically
- Local file-based storage for settings, conversations, and user data
- Support for local (llama.cpp, Ollama) and cloud (Claude, Gemini) AI providers

## Distribution Strategies

### 1. Electron App (Recommended)
**Benefits:**
- Single codebase for all platforms
- Native desktop experience
- Auto-updater support
- System integration (notifications, menu bar)
- Offline capability

**Implementation:**
- Package the existing web UI in Electron
- Use electron-builder for cross-platform builds
- Implement auto-updates with electron-updater

**Files to Create:**
```
electron/
├── main.js              # Electron main process
├── preload.js           # Preload script for security
├── package.json         # Electron-specific dependencies
└── build/               # Platform-specific build configs
    ├── mac.json
    ├── windows.json
    └── linux.json
```

### 2. Native Binaries with pkg
**Benefits:**
- No additional runtime dependencies
- Smaller download size
- Direct executable

**Implementation:**
```bash
npm install -g pkg
pkg package.json --targets node18-macos-x64,node18-linux-x64,node18-win-x64
```

### 3. Docker Containers
**Benefits:**
- Consistent environment across platforms
- Easy deployment and scaling
- Isolated dependencies

**Implementation:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8787
CMD ["node", "server/agent-api.js"]
```

### 4. Progressive Web App (PWA)
**Benefits:**
- No installation required
- Automatic updates
- Cross-platform compatibility
- Offline support with service workers

**Implementation:**
- Add service worker for offline functionality
- Create web app manifest
- Implement PWA features

## Platform-Specific Considerations

### macOS
- **Distribution:** Mac App Store, direct download (.dmg)
- **Notarization:** Required for macOS Catalina+
- **Code Signing:** Apple Developer certificate needed
- **Architecture:** Support both Intel (x64) and Apple Silicon (arm64)

### Windows
- **Distribution:** Microsoft Store, direct download (.exe/.msi)
- **Code Signing:** Authenticode certificate to avoid security warnings
- **Installer:** NSIS or WiX for professional installer
- **Architecture:** x64 and potentially ARM64

### Linux
- **Distribution:** AppImage, Snap, Flatpak, .deb/.rpm packages
- **Desktop Integration:** .desktop files for application menu
- **Dependencies:** Bundle all dependencies or use system packages

## Recommended Implementation Plan

### Phase 1: Electron Desktop App
1. **Setup Electron**
   ```bash
   npm install --save-dev electron electron-builder
   ```

2. **Create Electron Main Process**
   - Window management
   - Menu setup
   - Auto-updater integration
   - System tray (optional)

3. **Configure Build System**
   - electron-builder configuration
   - GitHub Actions for automated builds
   - Code signing setup

4. **Platform Testing**
   - Test on all target platforms
   - Verify auto-update functionality

### Phase 2: Web Distribution
1. **PWA Implementation**
   - Service worker for offline support
   - Web app manifest
   - Install prompts

2. **Hosting Setup**
   - CDN for global distribution
   - HTTPS certificate
   - Domain setup

### Phase 3: Alternative Distributions
1. **Container Images**
   - Docker Hub publication
   - Multi-arch builds (AMD64, ARM64)

2. **Package Managers**
   - npm global package
   - Homebrew formula (macOS)
   - Chocolatey package (Windows)
   - Snap/Flatpak (Linux)

## Build Automation

### GitHub Actions Workflow
```yaml
name: Build and Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - run: npm ci
      - run: npm test
      - run: npm run build:electron
      
      - name: Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist/*
```

## Security Considerations

1. **Code Signing**
   - macOS: Apple Developer certificate
   - Windows: Authenticode certificate
   - Linux: GPG signing for packages

2. **Auto-Updates**
   - HTTPS-only update channels
   - Signature verification
   - Rollback capability

3. **Sandboxing**
   - Electron security best practices
   - Minimal permissions
   - Content Security Policy

## Distribution Channels

### Primary
- GitHub Releases (all platforms)
- Official website download

### Secondary
- Mac App Store
- Microsoft Store
- Snap Store
- Flathub

### Package Managers
- npm (global install)
- Homebrew (macOS)
- Chocolatey (Windows)
- APT/YUM repositories (Linux)

## Update Strategy

1. **Automatic Updates**
   - Check for updates on startup
   - Background downloads
   - User notification and consent

2. **Manual Updates**
   - In-app update checker
   - Direct download links
   - Migration guides for breaking changes

3. **Release Channels**
   - Stable: Tested releases
   - Beta: Pre-release testing
   - Alpha: Development builds

## Metrics and Analytics

1. **Installation Tracking**
   - Download counts by platform
   - Installation success rates
   - Geographic distribution

2. **Usage Analytics**
   - Feature usage statistics
   - Performance metrics
   - Error reporting (with user consent)

## Support and Documentation

1. **Platform-Specific Guides**
   - Installation instructions
   - Troubleshooting guides
   - Feature differences

2. **Community Support**
   - GitHub Issues
   - Discord/Slack community
   - Documentation wiki

## Budget Considerations

1. **Certificates**
   - Apple Developer: $99/year
   - Windows Code Signing: $200-500/year

2. **Infrastructure**
   - CDN costs for distribution
   - Update server hosting
   - Build server resources

3. **App Store Fees**
   - Apple App Store: 30% revenue share
   - Microsoft Store: 30% revenue share

## Timeline

- **Week 1-2:** Electron setup and basic packaging
- **Week 3-4:** Platform-specific testing and optimization
- **Week 5-6:** Code signing and distribution setup
- **Week 7-8:** Automated build pipeline and release process

This plan provides a comprehensive approach to cross-platform distribution while maintaining flexibility for future expansion and optimization.