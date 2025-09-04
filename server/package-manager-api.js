"use strict";

const { PackageManagerDetector } = require("../src/tools/packages/manager-detector");
const { UniversalPackageSearch } = require("../src/tools/packages/universal-search");
const { execSync } = require("node:child_process");

/**
 * Package Manager API endpoints for web UI integration
 */

let detector = new PackageManagerDetector();
let search = new UniversalPackageSearch();

// Initialize package managers on startup
async function initializePackageManagers() {
  try {
    const cached = await detector.loadCache();
    if (!cached) {
      await detector.detectAll();
      await detector.saveCache();
    }
    
    search.detector = detector;
    console.log("📦 Package managers initialized");
  } catch (error) {
    console.warn("Failed to initialize package managers:", error.message);
  }
}

/**
 * GET /api/packages/managers - Get available package managers
 */
async function getPackageManagers(req, res) {
  try {
    const managers = Array.from(detector.detectedManagers.values());
    const stats = detector.getStats();
    
    res.json({
      managers: managers.map(m => ({
        name: m.name,
        version: m.version,
        type: m.type,
        ecosystem: m.ecosystem,
        available: m.available
      })),
      stats,
      totalEstimatedPackages: calculateTotalPackages(managers)
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get package managers", message: error.message });
  }
}

/**
 * GET /api/packages/search?q=query - Search packages across all managers
 */
async function searchPackages(req, res) {
  try {
    const { q: query, limit = 20, type } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    console.log(`🔍 API: Searching for "${query}"`);
    
    const results = await search.searchAll(query, {
      limit: parseInt(limit),
      includeTypes: type ? [type] : undefined,
      timeout: 10000
    });

    res.json({
      query,
      packages: results.packages.map(pkg => ({
        name: pkg.name,
        manager: pkg.manager,
        description: pkg.description,
        version: pkg.version,
        installCommand: pkg.installCommand,
        relevanceScore: pkg.relevanceScore,
        source: pkg.source
      })),
      sources: results.sources,
      total: results.total,
      errors: results.errors
    });

  } catch (error) {
    console.error("Package search error:", error);
    res.status(500).json({ error: "Package search failed", message: error.message });
  }
}

/**
 * POST /api/packages/install - Install a package using appropriate manager
 */
async function installPackage(req, res) {
  try {
    const { packageName, manager, version, force = false } = req.body;
    
    if (!packageName) {
      return res.status(400).json({ error: "packageName is required" });
    }

    console.log(`📦 API: Installing ${packageName} via ${manager || 'auto'}`);

    // Determine best manager if not specified
    let selectedManager = manager;
    if (!selectedManager) {
      const bestManager = detector.getBestManager({});
      selectedManager = bestManager ? bestManager.name : null;
    }

    if (!selectedManager || !detector.isAvailable(selectedManager)) {
      return res.status(400).json({ 
        error: `Package manager '${selectedManager}' not available`,
        availableManagers: Array.from(detector.detectedManagers.keys())
      });
    }

    // Build install command
    const command = detector.buildCommand(selectedManager, "install", packageName, { version });
    
    console.log(`   Command: ${command}`);

    // Execute installation
    const result = await executePackageCommand(command, selectedManager, packageName);
    
    if (result.success) {
      console.log(`✅ Successfully installed ${packageName}`);
      
      // Update tool runner if needed
      await updateToolRunner();
      
      res.json({
        success: true,
        package: packageName,
        manager: selectedManager,
        command: command,
        output: result.output,
        installedAt: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        package: packageName,
        manager: selectedManager,
        error: result.error,
        command: command
      });
    }

  } catch (error) {
    console.error("Package installation error:", error);
    res.status(500).json({ error: "Package installation failed", message: error.message });
  }
}

/**
 * POST /api/packages/uninstall - Uninstall a package
 */
async function uninstallPackage(req, res) {
  try {
    const { packageName, manager } = req.body;
    
    if (!packageName || !manager) {
      return res.status(400).json({ error: "packageName and manager are required" });
    }

    if (!detector.isAvailable(manager)) {
      return res.status(400).json({ error: `Package manager '${manager}' not available` });
    }

    const command = detector.buildCommand(manager, "remove", packageName);
    console.log(`🗑️  Uninstalling ${packageName}: ${command}`);

    const result = await executePackageCommand(command, manager, packageName);
    
    if (result.success) {
      res.json({
        success: true,
        package: packageName,
        manager: manager,
        output: result.output
      });
    } else {
      res.status(400).json({
        success: false,
        package: packageName,
        error: result.error
      });
    }

  } catch (error) {
    res.status(500).json({ error: "Package uninstallation failed", message: error.message });
  }
}

/**
 * GET /api/packages/:packageName/info - Get detailed package information
 */
async function getPackageInfo(req, res) {
  try {
    const { packageName } = req.params;
    const { manager } = req.query;

    console.log(`📋 Getting info for ${packageName}`);

    const info = await search.getPackageInfo(packageName, manager);
    
    if (info) {
      res.json(info);
    } else {
      res.status(404).json({ error: `Package '${packageName}' not found` });
    }

  } catch (error) {
    res.status(500).json({ error: "Failed to get package info", message: error.message });
  }
}

/**
 * GET /api/packages/installed - List installed packages
 */
async function getInstalledPackages(req, res) {
  try {
    const { manager } = req.query;
    
    const managers = manager ? [manager] : Array.from(detector.detectedManagers.keys());
    const installed = {};

    for (const mgr of managers) {
      if (detector.isAvailable(mgr)) {
        try {
          const command = detector.buildCommand(mgr, "list", "");
          const result = await executePackageCommand(command, mgr, "list", { timeout: 15000 });
          
          if (result.success) {
            installed[mgr] = parseInstalledPackages(mgr, result.output);
          }
        } catch (error) {
          console.warn(`Failed to list packages for ${mgr}:`, error.message);
        }
      }
    }

    res.json({ installed });

  } catch (error) {
    res.status(500).json({ error: "Failed to get installed packages", message: error.message });
  }
}

/**
 * Execute package management command with proper error handling
 */
async function executePackageCommand(command, manager, packageName, options = {}) {
  const { timeout = 120000 } = options; // 2 minute default timeout

  try {
    const output = execSync(command, {
      stdio: "pipe",
      encoding: "utf8",
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: { ...process.env, HOMEBREW_NO_AUTO_UPDATE: "1" } // Speed up brew
    });

    return {
      success: true,
      output: output.trim(),
      manager,
      package: packageName
    };

  } catch (error) {
    console.error(`Package command failed: ${command}`, error.message);
    
    return {
      success: false,
      error: error.message,
      stderr: error.stderr || "",
      exitCode: error.status || 1,
      manager,
      package: packageName
    };
  }
}

/**
 * Parse installed packages from command output
 */
function parseInstalledPackages(manager, output) {
  const packages = [];
  const lines = output.split('\n').filter(line => line.trim());

  // Basic parsing - would be enhanced for each manager type
  for (const line of lines.slice(0, 50)) { // Limit to first 50
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 1) {
      packages.push({
        name: parts[0],
        version: parts[1] || "unknown",
        manager
      });
    }
  }

  return packages;
}

/**
 * Calculate total estimated packages across all managers
 */
function calculateTotalPackages(managers) {
  const estimates = {
    homebrew: 6000,
    javascript: 2000000,
    python: 400000,
    ruby: 180000,
    chocolatey: 9000,
    debian: 60000
  };

  let total = 0;
  const counted = new Set();

  for (const manager of managers) {
    if (!counted.has(manager.ecosystem)) {
      total += estimates[manager.ecosystem] || 1000;
      counted.add(manager.ecosystem);
    }
  }

  return total;
}

/**
 * Update tool runner when new packages are installed
 */
async function updateToolRunner() {
  try {
    // Re-detect system programs to include newly installed tools
    const { SystemProgramDetector } = require("../src/tools/system/detector");
    const systemDetector = new SystemProgramDetector();
    
    const programs = await systemDetector.detectAll();
    await systemDetector.saveDetectionResults(programs);
    
    console.log("🔄 Updated system tool registry");
  } catch (error) {
    console.warn("Failed to update tool runner:", error.message);
  }
}

// Initialize on module load
initializePackageManagers();

module.exports = {
  getPackageManagers,
  searchPackages, 
  installPackage,
  uninstallPackage,
  getPackageInfo,
  getInstalledPackages,
  initializePackageManagers
};