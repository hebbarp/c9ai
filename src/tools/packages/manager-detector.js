"use strict";

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

/**
 * Package Manager Detection System
 * Detects and interfaces with system package managers
 */
class PackageManagerDetector {
  constructor() {
    this.detectedManagers = new Map();
    this.supportedManagers = this.initializeSupportedManagers();
  }

  /**
   * Initialize configuration for supported package managers
   */
  initializeSupportedManagers() {
    return {
      // Cross-platform managers
      "npm": {
        platforms: ["darwin", "linux", "win32"],
        checkCommand: "npm --version",
        searchCommand: "npm search {query}",
        installCommand: "npm install -g {package}",
        infoCommand: "npm info {package}",
        listCommand: "npm list -g --depth=0",
        updateCommand: "npm update -g {package}",
        removeCommand: "npm uninstall -g {package}",
        type: "language",
        ecosystem: "javascript"
      },
      
      "pip": {
        platforms: ["darwin", "linux", "win32"],
        checkCommand: "pip --version",
        searchCommand: "pip search {query} || echo 'Search disabled'",
        installCommand: "pip install {package}",
        infoCommand: "pip show {package}",
        listCommand: "pip list",
        updateCommand: "pip install --upgrade {package}",
        removeCommand: "pip uninstall {package}",
        type: "language",
        ecosystem: "python"
      },

      // macOS managers
      "brew": {
        platforms: ["darwin"],
        checkCommand: "brew --version",
        searchCommand: "brew search {query}",
        installCommand: "brew install {package}",
        infoCommand: "brew info {package}",
        listCommand: "brew list",
        updateCommand: "brew upgrade {package}",
        removeCommand: "brew uninstall {package}",
        type: "system",
        ecosystem: "homebrew"
      },

      // Windows managers  
      "choco": {
        platforms: ["win32"],
        checkCommand: "choco --version",
        searchCommand: "choco search {query}",
        installCommand: "choco install {package} -y",
        infoCommand: "choco info {package}",
        listCommand: "choco list --local-only",
        updateCommand: "choco upgrade {package} -y",
        removeCommand: "choco uninstall {package} -y",
        type: "system", 
        ecosystem: "chocolatey"
      },

      "winget": {
        platforms: ["win32"],
        checkCommand: "winget --version",
        searchCommand: "winget search {query}",
        installCommand: "winget install {package}",
        infoCommand: "winget show {package}",
        listCommand: "winget list",
        updateCommand: "winget upgrade {package}",
        removeCommand: "winget uninstall {package}",
        type: "system",
        ecosystem: "winget"
      },

      // Linux managers
      "apt": {
        platforms: ["linux"],
        checkCommand: "apt --version",
        searchCommand: "apt search {query}",
        installCommand: "apt install {package} -y",
        infoCommand: "apt show {package}",
        listCommand: "apt list --installed",
        updateCommand: "apt upgrade {package} -y",
        removeCommand: "apt remove {package} -y",
        type: "system",
        ecosystem: "debian"
      },

      "yum": {
        platforms: ["linux"],
        checkCommand: "yum --version",
        searchCommand: "yum search {query}",
        installCommand: "yum install {package} -y",
        infoCommand: "yum info {package}",
        listCommand: "yum list installed",
        updateCommand: "yum update {package} -y", 
        removeCommand: "yum remove {package} -y",
        type: "system",
        ecosystem: "redhat"
      },

      "dnf": {
        platforms: ["linux"],
        checkCommand: "dnf --version",
        searchCommand: "dnf search {query}",
        installCommand: "dnf install {package} -y",
        infoCommand: "dnf info {package}",
        listCommand: "dnf list installed",
        updateCommand: "dnf upgrade {package} -y",
        removeCommand: "dnf remove {package} -y",
        type: "system",
        ecosystem: "redhat"
      },

      "pacman": {
        platforms: ["linux"],
        checkCommand: "pacman --version",
        searchCommand: "pacman -Ss {query}",
        installCommand: "pacman -S {package} --noconfirm",
        infoCommand: "pacman -Si {package}",
        listCommand: "pacman -Q",
        updateCommand: "pacman -S {package} --noconfirm",
        removeCommand: "pacman -R {package} --noconfirm",
        type: "system",
        ecosystem: "arch"
      },

      // Universal Linux managers
      "snap": {
        platforms: ["linux"],
        checkCommand: "snap --version",
        searchCommand: "snap find {query}",
        installCommand: "snap install {package}",
        infoCommand: "snap info {package}",
        listCommand: "snap list",
        updateCommand: "snap refresh {package}",
        removeCommand: "snap remove {package}",
        type: "universal",
        ecosystem: "canonical"
      },

      "flatpak": {
        platforms: ["linux"],
        checkCommand: "flatpak --version",
        searchCommand: "flatpak search {query}",
        installCommand: "flatpak install {package} -y",
        infoCommand: "flatpak info {package}",
        listCommand: "flatpak list",
        updateCommand: "flatpak update {package} -y",
        removeCommand: "flatpak uninstall {package} -y",
        type: "universal",
        ecosystem: "flatpak"
      },

      // Additional language managers
      "cargo": {
        platforms: ["darwin", "linux", "win32"],
        checkCommand: "cargo --version",
        searchCommand: "cargo search {query}",
        installCommand: "cargo install {package}",
        infoCommand: "cargo search {package}",
        listCommand: "cargo install --list",
        updateCommand: "cargo install {package} --force",
        removeCommand: "cargo uninstall {package}",
        type: "language",
        ecosystem: "rust"
      },

      "gem": {
        platforms: ["darwin", "linux", "win32"],
        checkCommand: "gem --version",
        searchCommand: "gem search {query}",
        installCommand: "gem install {package}",
        infoCommand: "gem info {package}",
        listCommand: "gem list",
        updateCommand: "gem update {package}",
        removeCommand: "gem uninstall {package}",
        type: "language",
        ecosystem: "ruby"
      }
    };
  }

  /**
   * Detect all available package managers on the system
   */
  async detectAll() {
    console.log("🔍 Detecting available package managers...");
    
    const currentPlatform = os.platform();
    const detected = [];

    for (const [name, config] of Object.entries(this.supportedManagers)) {
      // Skip if not supported on current platform
      if (!config.platforms.includes(currentPlatform)) {
        continue;
      }

      try {
        const info = await this.detectManager(name, config);
        if (info) {
          detected.push(info);
          this.detectedManagers.set(name, info);
          console.log(`   ✅ ${name} v${info.version} (${info.type})`);
        }
      } catch (error) {
        // Manager not available - this is normal
      }
    }

    console.log(`✅ Found ${detected.length} package managers`);
    return detected;
  }

  /**
   * Detect a specific package manager
   */
  async detectManager(name, config) {
    try {
      const output = execSync(config.checkCommand, {
        stdio: "pipe",
        timeout: 5000,
        encoding: "utf8"
      });

      const version = this.extractVersion(output);
      
      return {
        name,
        version,
        type: config.type,
        ecosystem: config.ecosystem,
        platform: os.platform(),
        config: config,
        available: true,
        detectedAt: new Date().toISOString()
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * Extract version from command output
   */
  extractVersion(output) {
    const patterns = [
      /version (\d+\.\d+(?:\.\d+)?)/i,
      /v(\d+\.\d+(?:\.\d+)?)/i,
      /(\d+\.\d+(?:\.\d+)?)/,
    ];
    
    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return "unknown";
  }

  /**
   * Get detected managers by type
   */
  getManagersByType(type) {
    const managers = [];
    for (const manager of this.detectedManagers.values()) {
      if (manager.type === type) {
        managers.push(manager);
      }
    }
    return managers;
  }

  /**
   * Get the best package manager for a specific task
   */
  getBestManager(criteria = {}) {
    const { 
      type = null,           // "system", "language", "universal"
      ecosystem = null,      // "homebrew", "debian", "python", etc.
      preferredManager = null,
      task = null           // "install", "search", "info"
    } = criteria;

    const available = Array.from(this.detectedManagers.values());
    
    // Apply filters
    let filtered = available;
    
    if (type) {
      filtered = filtered.filter(m => m.type === type);
    }
    
    if (ecosystem) {
      filtered = filtered.filter(m => m.ecosystem === ecosystem);
    }
    
    if (preferredManager && this.detectedManagers.has(preferredManager)) {
      return this.detectedManagers.get(preferredManager);
    }

    // Score managers by preference
    return filtered.sort((a, b) => {
      // Prefer system package managers over language-specific
      if (a.type === "system" && b.type === "language") return -1;
      if (a.type === "language" && b.type === "system") return 1;
      
      // Platform-specific preferences
      const platform = os.platform();
      if (platform === "darwin" && a.name === "brew") return -1;
      if (platform === "win32" && a.name === "winget") return -1;
      if (platform === "linux" && a.name === "apt") return -1;
      
      return 0;
    })[0];
  }

  /**
   * Check if a specific package manager is available
   */
  isAvailable(managerName) {
    return this.detectedManagers.has(managerName);
  }

  /**
   * Get package manager configuration
   */
  getManagerConfig(managerName) {
    const manager = this.detectedManagers.get(managerName);
    return manager ? manager.config : null;
  }

  /**
   * Build command for a specific manager and operation
   */
  buildCommand(managerName, operation, packageName, options = {}) {
    const manager = this.detectedManagers.get(managerName);
    if (!manager) {
      throw new Error(`Package manager '${managerName}' not available`);
    }

    const commandTemplate = manager.config[`${operation}Command`];
    if (!commandTemplate) {
      throw new Error(`Operation '${operation}' not supported by ${managerName}`);
    }

    let command = commandTemplate.replace("{package}", packageName);
    command = command.replace("{query}", packageName);

    // Add options
    if (options.version) {
      if (managerName === "npm") {
        command = command.replace(packageName, `${packageName}@${options.version}`);
      }
      // Add version support for other managers as needed
    }

    return command;
  }

  /**
   * Get system statistics
   */
  getStats() {
    const managers = Array.from(this.detectedManagers.values());
    const stats = {
      total: managers.length,
      byType: {
        system: managers.filter(m => m.type === "system").length,
        language: managers.filter(m => m.type === "language").length,
        universal: managers.filter(m => m.type === "universal").length
      },
      byPlatform: {
        [os.platform()]: managers.length
      },
      ecosystems: [...new Set(managers.map(m => m.ecosystem))]
    };

    return stats;
  }

  /**
   * Save detection results to cache
   */
  async saveCache() {
    const cacheDir = path.join(process.cwd(), ".c9ai", "cache");
    await fs.promises.mkdir(cacheDir, { recursive: true });
    
    const cacheFile = path.join(cacheDir, "package-managers.json");
    const cacheData = {
      platform: os.platform(),
      detectedAt: new Date().toISOString(),
      managers: Object.fromEntries(this.detectedManagers)
    };

    await fs.promises.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    console.log(`📝 Cached package manager info to ${cacheFile}`);
  }

  /**
   * Load detection results from cache
   */
  async loadCache() {
    const cacheFile = path.join(process.cwd(), ".c9ai", "cache", "package-managers.json");
    
    try {
      const cacheData = await fs.promises.readFile(cacheFile, "utf8");
      const cached = JSON.parse(cacheData);
      
      // Check if cache is recent (within 24 hours) and for same platform
      const cacheAge = Date.now() - new Date(cached.detectedAt).getTime();
      if (cacheAge < 24 * 60 * 60 * 1000 && cached.platform === os.platform()) {
        console.log("📋 Using cached package manager detection");
        
        for (const [name, manager] of Object.entries(cached.managers)) {
          this.detectedManagers.set(name, manager);
        }
        
        return Array.from(this.detectedManagers.values());
      }
    } catch (error) {
      // Cache doesn't exist or is invalid
    }
    
    return null;
  }
}

module.exports = { PackageManagerDetector };