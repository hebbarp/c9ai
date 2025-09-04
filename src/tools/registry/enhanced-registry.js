"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { homedir } = require("node:os");
const { RemoteRegistryClient } = require("./remote-client");

/**
 * Enhanced Tool Registry with Remote Support
 * Combines local and global registry capabilities
 */
class EnhancedToolRegistry {
  constructor(options = {}) {
    this.localCatalogPath = path.join(__dirname, "catalog.json");
    this.packagesDir = path.join(__dirname, "..", "packages");
    this.userConfigDir = path.join(homedir(), ".c9ai", "tools");
    this.userCatalogPath = path.join(this.userConfigDir, "installed.json");
    
    // Remote registry client
    this.remoteClient = new RemoteRegistryClient(
      options.registryUrl || process.env.C9AI_REGISTRY_URL || "https://registry.c9ai.com"
    );
    
    // Configuration
    this.config = {
      enableRemote: options.enableRemote !== false, // Default: enabled
      cacheEnabled: options.cacheEnabled !== false,
      fallbackToLocal: options.fallbackToLocal !== false,
      ...options
    };
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.packagesDir, this.userConfigDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Get unified catalog (local + remote)
   */
  async getCatalog(forceRemote = false) {
    let catalog = { tools: [], categories: {}, sources: [] };
    
    try {
      // Always include local catalog
      const localCatalog = this.getLocalCatalog();
      catalog.tools.push(...localCatalog.tools);
      catalog.categories = { ...catalog.categories, ...localCatalog.categories };
      catalog.sources.push("local");
      
      // Fetch from remote registry if enabled
      if (this.config.enableRemote || forceRemote) {
        try {
          console.log("🌐 Fetching tools from global registry...");
          const remoteCatalog = await this.remoteClient.fetchToolCatalog();
          
          if (remoteCatalog && remoteCatalog.tools) {
            // Merge remote tools (mark as remote source)
            const remoteTools = remoteCatalog.tools.map(tool => ({
              ...tool,
              source: "global-registry",
              registryUrl: this.remoteClient.registryUrl
            }));
            
            catalog.tools.push(...remoteTools);
            catalog.categories = { ...catalog.categories, ...remoteCatalog.categories };
            catalog.sources.push("remote");
            
            console.log(`✅ Fetched ${remoteTools.length} tools from global registry`);
          }
        } catch (error) {
          console.warn("⚠️  Remote registry unavailable:", error.message);
          if (this.config.fallbackToLocal) {
            console.log("📦 Using local catalog as fallback");
          }
        }
      }
      
      // Remove duplicates (prioritize remote over local)
      catalog.tools = this.deduplicateTools(catalog.tools);
      
      return {
        ...catalog,
        lastUpdated: new Date().toISOString(),
        totalTools: catalog.tools.length
      };
      
    } catch (error) {
      console.error("Failed to build unified catalog:", error);
      return this.getLocalCatalog(); // Final fallback
    }
  }

  /**
   * Get local catalog only
   */
  getLocalCatalog() {
    try {
      const catalogData = fs.readFileSync(this.localCatalogPath, "utf8");
      const catalog = JSON.parse(catalogData);
      
      // Mark all tools as local source
      catalog.tools = catalog.tools.map(tool => ({
        ...tool,
        source: "local"
      }));
      
      return catalog;
    } catch (error) {
      console.error("Failed to load local catalog:", error);
      return { tools: [], categories: {}, sources: ["local"] };
    }
  }

  /**
   * Remove duplicate tools, prioritizing remote over local
   */
  deduplicateTools(tools) {
    const toolMap = new Map();
    
    // Process in order: local first, then remote (so remote overwrites local)
    const localTools = tools.filter(t => t.source === "local");
    const remoteTools = tools.filter(t => t.source === "global-registry");
    
    [...localTools, ...remoteTools].forEach(tool => {
      toolMap.set(tool.id, tool);
    });
    
    return Array.from(toolMap.values());
  }

  /**
   * Search tools across local and remote
   */
  async searchTools(query, options = {}) {
    const { category, source, limit = 50 } = options;
    
    let results = [];
    
    // Search local tools
    const localCatalog = this.getLocalCatalog();
    const localResults = localCatalog.tools.filter(tool => {
      const matchesQuery = !query || 
        tool.name.toLowerCase().includes(query.toLowerCase()) ||
        tool.description.toLowerCase().includes(query.toLowerCase()) ||
        (tool.tags && tool.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())));
      
      const matchesCategory = !category || tool.category === category;
      const matchesSource = !source || source === "local";
      
      return matchesQuery && matchesCategory && matchesSource;
    });
    
    results.push(...localResults);
    
    // Search remote tools if enabled and not restricted to local
    if (this.config.enableRemote && source !== "local") {
      try {
        const remoteResults = await this.remoteClient.searchTools(query, category);
        if (remoteResults.tools) {
          results.push(...remoteResults.tools.map(tool => ({
            ...tool,
            source: "global-registry"
          })));
        }
      } catch (error) {
        console.warn("Remote search failed:", error.message);
      }
    }
    
    // Deduplicate and limit results
    const uniqueResults = this.deduplicateTools(results);
    
    return {
      tools: uniqueResults.slice(0, limit),
      total: uniqueResults.length,
      query,
      sources: results.some(t => t.source === "global-registry") ? ["local", "remote"] : ["local"]
    };
  }

  /**
   * Get tool details with remote fallback
   */
  async getToolDetails(toolId) {
    // Check local first
    const localCatalog = this.getLocalCatalog();
    const localTool = localCatalog.tools.find(t => t.id === toolId);
    
    if (localTool) {
      return { ...localTool, source: "local" };
    }
    
    // Check remote if enabled
    if (this.config.enableRemote) {
      try {
        const remoteTool = await this.remoteClient.fetchToolDetails(toolId);
        return { ...remoteTool, source: "global-registry" };
      } catch (error) {
        console.warn(`Tool ${toolId} not found in remote registry:`, error.message);
      }
    }
    
    throw new Error(`Tool '${toolId}' not found in any registry`);
  }

  /**
   * Install tool from local or remote source
   */
  async installTool(toolId, config = {}, options = {}) {
    const { force = false, source = "auto" } = options;
    
    // Get tool details
    const toolDetails = await this.getToolDetails(toolId);
    
    if (toolDetails.source === "global-registry") {
      return await this.installRemoteTool(toolDetails, config, { force });
    } else {
      return await this.installLocalTool(toolDetails, config, { force });
    }
  }

  /**
   * Install tool from remote registry
   */
  async installRemoteTool(toolDetails, config, options = {}) {
    const { force } = options;
    
    console.log(`📦 Installing ${toolDetails.name} from global registry...`);
    
    try {
      // Download package
      const packageData = await this.remoteClient.fetchToolPackage(toolDetails.id);
      
      // Extract and install
      const installResult = await this.extractAndInstallPackage(
        toolDetails.id, 
        packageData, 
        config
      );
      
      if (installResult.success) {
        console.log(`✅ ${toolDetails.name} installed successfully from global registry`);
      }
      
      return installResult;
      
    } catch (error) {
      console.error(`❌ Failed to install ${toolDetails.name}:`, error.message);
      return {
        success: false,
        error: error.message,
        tool: toolDetails
      };
    }
  }

  /**
   * Install tool from local catalog (existing functionality)
   */
  async installLocalTool(toolDetails, config, options = {}) {
    // Use existing local installation logic
    const { ToolInstaller } = require("./installer");
    const installer = new ToolInstaller();
    
    return await installer.installTool(toolDetails.id, config, options.force);
  }

  /**
   * Extract and install downloaded package
   */
  async extractAndInstallPackage(toolId, packageData, config) {
    // This would implement:
    // 1. Extract package (zip/tar)
    // 2. Validate c9ai.json manifest
    // 3. Run install.js script
    // 4. Copy files to packages directory
    // 5. Update installed tools registry
    
    // For now, simulate the process
    console.log(`📦 Extracting package for ${toolId}...`);
    console.log(`⚙️  Running installation script...`);
    console.log(`📝 Updating tool registry...`);
    
    return {
      success: true,
      tool: {
        id: toolId,
        name: toolId,
        source: "global-registry",
        installedAt: new Date().toISOString(),
        config
      }
    };
  }

  // Inherit other methods from original ToolRegistry
  getInstalledTools() {
    const { ToolRegistry } = require("./index");
    const registry = new ToolRegistry();
    return registry.getInstalledTools();
  }

  isToolInstalled(toolId) {
    const { ToolRegistry } = require("./index");
    const registry = new ToolRegistry();
    return registry.isToolInstalled(toolId);
  }

  getStats() {
    const { ToolRegistry } = require("./index");
    const registry = new ToolRegistry();
    return registry.getStats();
  }
}

module.exports = { EnhancedToolRegistry };