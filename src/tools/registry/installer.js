"use strict";

const { ToolRegistry } = require("./index");
const path = require("node:path");
const fs = require("node:fs");

class ToolInstaller {
  constructor() {
    this.registry = new ToolRegistry();
  }

  /**
   * Install tool with validation and dependency resolution
   */
  async installTool(toolId, config = {}, force = false) {
    try {
      // Validate tool exists
      const tool = this.registry.getTool(toolId);
      if (!tool) {
        throw new Error(`Tool '${toolId}' not found in catalog`);
      }

      // Check if already installed
      if (this.registry.isToolInstalled(toolId) && !force) {
        return {
          success: true,
          message: `Tool '${tool.name}' is already installed`,
          tool: tool
        };
      }

      // Validate required configuration
      if (tool.config) {
        const missingConfig = this.validateConfig(tool.config, config);
        if (missingConfig.length > 0) {
          throw new Error(`Missing required configuration: ${missingConfig.join(", ")}`);
        }
      }

      // Install the tool
      const result = await this.registry.installTool(toolId, config);
      
      // Update the tool runner to include new tools
      await this.updateToolRunner();
      
      return result;
    } catch (error) {
      console.error(`Failed to install tool ${toolId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Batch install multiple tools
   */
  async installTools(tools) {
    const results = [];
    
    for (const { toolId, config } of tools) {
      const result = await this.installTool(toolId, config);
      results.push({ toolId, ...result });
    }
    
    return results;
  }

  /**
   * Uninstall tool
   */
  async uninstallTool(toolId) {
    try {
      const result = await this.registry.uninstallTool(toolId);
      await this.updateToolRunner();
      return result;
    } catch (error) {
      console.error(`Failed to uninstall tool ${toolId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update tool configuration
   */
  updateToolConfig(toolId, config) {
    try {
      return this.registry.configureTool(toolId, config);
    } catch (error) {
      console.error(`Failed to configure tool ${toolId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate tool configuration against requirements
   */
  validateConfig(configSchema, providedConfig) {
    const missing = [];
    
    Object.entries(configSchema).forEach(([key, spec]) => {
      if (spec.required && !providedConfig[key]) {
        missing.push(key);
      }
    });
    
    return missing;
  }

  /**
   * Update the tool runner to dynamically load installed tools
   */
  async updateToolRunner() {
    const runnerPath = path.join(__dirname, "..", "runner.js");
    
    // Read existing runner
    let runnerCode = "";
    if (fs.existsSync(runnerPath)) {
      runnerCode = fs.readFileSync(runnerPath, "utf8");
    }
    
    // Generate updated runner code
    const updatedCode = this.generateUpdatedRunnerCode();
    
    // Write updated runner
    fs.writeFileSync(runnerPath, updatedCode);
    
    // Clear require cache to reload tools
    delete require.cache[require.resolve("../runner.js")];
    
    console.log("✅ Tool runner updated with new tools");
  }

  /**
   * Generate updated tool runner code that includes all installed tools
   */
  generateUpdatedRunnerCode() {
    const installed = this.registry.getInstalledTools();
    const builtinTools = this.registry.getCatalog().tools.filter(t => t.builtin);
    
    return `"use strict";

// Auto-generated tool runner - DO NOT EDIT MANUALLY
// Last updated: ${new Date().toISOString()}

const fs = require("node:fs");
const path = require("node:path");

// Built-in tools
${this.generateBuiltinToolImports(builtinTools)}

// Installed package tools  
const installedTools = {};
${this.generateInstalledToolImports(installed.tools)}

/**
 * Run a tool with given arguments
 */
async function runTool(toolName, args = {}) {
  console.log(\`🔧 Running tool: \${toolName}\`, args);
  
  try {
    // Check built-in tools first
    switch (toolName) {
${this.generateBuiltinToolCases(builtinTools)}
      default:
        // Check installed package tools
        if (installedTools[toolName]) {
          const result = await installedTools[toolName].execute(args);
          return {
            tool: toolName,
            success: true,
            result: result
          };
        }
        
        throw new Error(\`Tool '\${toolName}' not found. Available tools: \${Object.keys({
          ${builtinTools.map(t => `"${t.id}": true`).join(",\n          ")},
          ...installedTools
        }).join(", ")}\`);
    }
  } catch (error) {
    console.error(\`❌ Tool \${toolName} failed:\`, error);
    return {
      tool: toolName,
      success: false,
      error: error.message
    };
  }
}

module.exports = { runTool };
`;
  }

  generateBuiltinToolImports(builtinTools) {
    return builtinTools.map(tool => {
      // Map to existing built-in tools
      switch (tool.id) {
        case "shell.run":
          return 'const { shellRun } = require("./shell");';
        case "fs.read":
          return 'const { fsRead } = require("./filesystem");';
        case "fs.write":
          return 'const { fsWrite } = require("./filesystem");';
        case "web.search":
          return 'const { webSearch } = require("./web");';
        default:
          return `// ${tool.id} - built-in tool`;
      }
    }).join("\n");
  }

  generateInstalledToolImports(installedTools) {
    return Object.keys(installedTools).map(toolId => {
      return `
try {
  installedTools["${toolId}"] = require("./packages/${toolId}");
} catch (e) {
  console.warn("Failed to load tool ${toolId}:", e.message);
}`;
    }).join("");
  }

  generateBuiltinToolCases(builtinTools) {
    return builtinTools.map(tool => {
      switch (tool.id) {
        case "shell.run":
          return `      case "shell.run":
        return await shellRun(args);`;
        case "fs.read":
          return `      case "fs.read":
        return await fsRead(args);`;
        case "fs.write":
          return `      case "fs.write":
        return await fsWrite(args);`;
        case "web.search":
          return `      case "web.search":
        return await webSearch(args);`;
        default:
          return `      case "${tool.id}":
        throw new Error("Built-in tool ${tool.id} implementation pending");`;
      }
    }).join("\n");
  }

  /**
   * Get installation status and recommendations
   */
  getInstallationStatus() {
    const stats = this.registry.getStats();
    const catalog = this.registry.getCatalog();
    const installed = this.registry.getInstalledTools();
    
    return {
      stats,
      recommendations: this.generateRecommendations(catalog, installed),
      recentlyInstalled: this.getRecentlyInstalledTools(installed)
    };
  }

  generateRecommendations(catalog, installed) {
    // Simple recommendation logic
    const recommendations = [];
    
    // Recommend popular tools
    const popularTools = ["cream.social.post", "document.pdf", "email.send"];
    popularTools.forEach(toolId => {
      if (!installed.tools[toolId]) {
        const tool = catalog.tools.find(t => t.id === toolId);
        if (tool) {
          recommendations.push({
            tool,
            reason: "Popular tool for common workflows"
          });
        }
      }
    });
    
    return recommendations.slice(0, 3);
  }

  getRecentlyInstalledTools(installed) {
    return Object.values(installed.tools)
      .filter(tool => tool.installedAt)
      .sort((a, b) => new Date(b.installedAt) - new Date(a.installedAt))
      .slice(0, 5);
  }
}

module.exports = { ToolInstaller };