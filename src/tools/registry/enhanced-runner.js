"use strict";

const { ToolRegistry } = require("./index");
const { runTool: originalRunTool } = require("../runner");
const path = require("node:path");

class EnhancedToolRunner {
  constructor() {
    this.registry = new ToolRegistry();
    this.installedToolsCache = new Map();
  }

  /**
   * Enhanced runTool that checks registry first, then falls back to original
   */
  async runTool(name, args = {}, context = {}) {
    console.log(`🔧 Enhanced runner: ${name}`, args);

    try {
      // First, check if it's an installed package tool
      if (await this.isPackageToolInstalled(name)) {
        return await this.runPackageTool(name, args, context);
      }

      // Fall back to original built-in tools
      return await originalRunTool(name, args, context);
    } catch (error) {
      // If tool not found, provide helpful suggestions
      if (error.message.includes("Unknown tool")) {
        const suggestions = await this.suggestTools(name);
        const enhancedError = new Error(
          `${error.message}. ${suggestions.length > 0 
            ? `Did you mean: ${suggestions.join(", ")}? Use the Tool Package Manager to install additional tools.`
            : "Use the Tool Package Manager to discover and install additional tools."
          }`
        );
        throw enhancedError;
      }
      throw error;
    }
  }

  /**
   * Check if a package tool is installed
   */
  async isPackageToolInstalled(toolName) {
    if (this.installedToolsCache.has(toolName)) {
      return this.installedToolsCache.get(toolName);
    }

    const isInstalled = this.registry.isToolInstalled(toolName);
    this.installedToolsCache.set(toolName, isInstalled);
    
    // Cache expires after 5 minutes
    setTimeout(() => {
      this.installedToolsCache.delete(toolName);
    }, 5 * 60 * 1000);

    return isInstalled;
  }

  /**
   * Run a package tool
   */
  async runPackageTool(toolName, args, context) {
    const toolDir = path.join(this.registry.packagesDir, toolName);
    const toolPath = path.join(toolDir, "index.js");

    try {
      // Clear require cache to get fresh tool implementation
      delete require.cache[require.resolve(toolPath)];
      
      const toolModule = require(toolPath);
      const result = await toolModule.execute(args);

      return {
        tool: toolName,
        success: true,
        result: result,
        source: "package"
      };
    } catch (error) {
      console.error(`❌ Package tool ${toolName} failed:`, error);
      return {
        tool: toolName,
        success: false,
        error: error.message,
        source: "package"
      };
    }
  }

  /**
   * Suggest similar tool names
   */
  async suggestTools(toolName) {
    const catalog = this.registry.getCatalog();
    const allTools = catalog.tools.map(t => t.id);
    
    // Simple fuzzy matching
    const suggestions = allTools.filter(t => 
      t.includes(toolName) || 
      toolName.includes(t.split('.')[0]) ||
      this.levenshteinDistance(t, toolName) <= 2
    );

    return suggestions.slice(0, 3);
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  /**
   * Get available tools (built-in + installed)
   */
  getAvailableTools() {
    const catalog = this.registry.getCatalog();
    const installed = this.registry.getInstalledTools();
    
    const builtinTools = catalog.tools.filter(t => t.builtin || t.status === "installed");
    const packageTools = Object.values(installed.tools);
    
    return {
      builtin: builtinTools,
      packages: packageTools,
      total: builtinTools.length + packageTools.length
    };
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.installedToolsCache.clear();
  }
}

// Create singleton instance
const enhancedRunner = new EnhancedToolRunner();

// Export enhanced runTool function
async function runTool(name, args = {}, context = {}) {
  return await enhancedRunner.runTool(name, args, context);
}

module.exports = { 
  runTool,
  EnhancedToolRunner,
  enhancedRunner 
};