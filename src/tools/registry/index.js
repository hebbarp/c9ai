"use strict";

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { homedir } = require("node:os");

class ToolRegistry {
  constructor() {
    this.catalogPath = path.join(__dirname, "catalog.json");
    this.packagesDir = path.join(__dirname, "..", "packages");
    this.userConfigDir = path.join(homedir(), ".c9ai", "tools");
    this.userCatalogPath = path.join(this.userConfigDir, "installed.json");
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    // Ensure packages directory exists
    if (!fs.existsSync(this.packagesDir)) {
      fs.mkdirSync(this.packagesDir, { recursive: true });
    }
    
    // Ensure user config directory exists
    if (!fs.existsSync(this.userConfigDir)) {
      fs.mkdirSync(this.userConfigDir, { recursive: true });
    }
  }

  /**
   * Load the tool catalog with all available tools
   */
  getCatalog() {
    try {
      const catalogData = fs.readFileSync(this.catalogPath, "utf8");
      return JSON.parse(catalogData);
    } catch (error) {
      console.error("Failed to load tool catalog:", error);
      return { tools: [], categories: {} };
    }
  }

  /**
   * Get installed tools configuration
   */
  getInstalledTools() {
    try {
      if (fs.existsSync(this.userCatalogPath)) {
        const installedData = fs.readFileSync(this.userCatalogPath, "utf8");
        return JSON.parse(installedData);
      }
    } catch (error) {
      console.error("Failed to load installed tools:", error);
    }
    return { tools: {} };
  }

  /**
   * Save installed tools configuration
   */
  saveInstalledTools(installedData) {
    try {
      fs.writeFileSync(this.userCatalogPath, JSON.stringify(installedData, null, 2));
    } catch (error) {
      console.error("Failed to save installed tools:", error);
      throw error;
    }
  }

  /**
   * Get tools filtered by category
   */
  getToolsByCategory(category = null) {
    const catalog = this.getCatalog();
    
    if (!category) {
      return catalog.tools;
    }
    
    return catalog.tools.filter(tool => tool.category === category);
  }

  /**
   * Get available (not installed) tools
   */
  getAvailableTools() {
    const catalog = this.getCatalog();
    return catalog.tools.filter(tool => tool.status === "available");
  }

  /**
   * Get tool by ID
   */
  getTool(toolId) {
    const catalog = this.getCatalog();
    return catalog.tools.find(tool => tool.id === toolId);
  }

  /**
   * Check if a tool is installed
   */
  isToolInstalled(toolId) {
    const installed = this.getInstalledTools();
    return installed.tools[toolId] && installed.tools[toolId].status === "installed";
  }

  /**
   * Install a tool
   */
  async installTool(toolId, config = {}) {
    const tool = this.getTool(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found in catalog`);
    }

    if (tool.builtin) {
      throw new Error(`Tool ${toolId} is built-in and already available`);
    }

    console.log(`Installing tool: ${tool.name} (${toolId})`);

    // Check dependencies
    if (tool.dependencies && tool.dependencies.length > 0) {
      for (const dep of tool.dependencies) {
        if (!this.isToolInstalled(dep)) {
          console.log(`Installing dependency: ${dep}`);
          await this.installTool(dep);
        }
      }
    }

    // Create tool package directory
    const toolDir = path.join(this.packagesDir, toolId);
    if (!fs.existsSync(toolDir)) {
      fs.mkdirSync(toolDir, { recursive: true });
    }

    // Download or create tool implementation
    if (tool.source) {
      // For now, create a basic implementation
      // In a real system, this would download from the source
      await this.createToolImplementation(tool, toolDir, config);
    } else {
      // Create local implementation
      await this.createToolImplementation(tool, toolDir, config);
    }

    // Update installed tools registry
    const installed = this.getInstalledTools();
    installed.tools[toolId] = {
      ...tool,
      status: "installed",
      installedAt: new Date().toISOString(),
      config: config
    };

    this.saveInstalledTools(installed);
    
    console.log(`✅ Tool ${tool.name} installed successfully`);
    return { success: true, tool: installed.tools[toolId] };
  }

  /**
   * Uninstall a tool
   */
  async uninstallTool(toolId) {
    const tool = this.getTool(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    if (tool.builtin) {
      throw new Error(`Cannot uninstall built-in tool ${toolId}`);
    }

    console.log(`Uninstalling tool: ${tool.name} (${toolId})`);

    // Remove tool directory
    const toolDir = path.join(this.packagesDir, toolId);
    if (fs.existsSync(toolDir)) {
      fs.rmSync(toolDir, { recursive: true, force: true });
    }

    // Update installed tools registry
    const installed = this.getInstalledTools();
    delete installed.tools[toolId];
    this.saveInstalledTools(installed);

    console.log(`✅ Tool ${tool.name} uninstalled successfully`);
    return { success: true };
  }

  /**
   * Configure a tool
   */
  configureTool(toolId, config) {
    const installed = this.getInstalledTools();
    if (!installed.tools[toolId]) {
      throw new Error(`Tool ${toolId} is not installed`);
    }

    installed.tools[toolId].config = { ...installed.tools[toolId].config, ...config };
    this.saveInstalledTools(installed);

    return { success: true, config: installed.tools[toolId].config };
  }

  /**
   * Create tool implementation file
   */
  async createToolImplementation(tool, toolDir, config) {
    const implementationCode = this.generateToolImplementation(tool, config);
    const implementationPath = path.join(toolDir, "index.js");
    
    fs.writeFileSync(implementationPath, implementationCode);

    // Create package.json for the tool
    const packageJson = {
      name: tool.id,
      version: tool.version,
      description: tool.description,
      main: "index.js",
      category: tool.category,
      author: tool.author || "C9AI",
      dependencies: tool.dependencies || []
    };

    fs.writeFileSync(path.join(toolDir, "package.json"), JSON.stringify(packageJson, null, 2));
  }

  /**
   * Generate basic tool implementation
   */
  generateToolImplementation(tool, config) {
    // This creates a basic tool implementation
    // In production, you'd have more sophisticated implementations
    
    return `"use strict";

/**
 * ${tool.name} - ${tool.description}
 * Category: ${tool.category}
 * Version: ${tool.version}
 */

const toolConfig = ${JSON.stringify(config || {}, null, 2)};

async function execute(args = {}) {
  console.log('Executing ${tool.id} with args:', args);
  
  // TODO: Implement actual tool logic
  // This is a placeholder implementation
  
  switch ("${tool.id}") {
    case "cream.social.post":
      return await executeCreamSocialPost(args);
    case "finance.calculate":
      return await executeFinanceCalculate(args);
    case "document.pdf":
      return await executeDocumentPdf(args);
    case "email.send":
      return await executeEmailSend(args);
    case "chart.generate":
      return await executeChartGenerate(args);
    default:
      return {
        success: false,
        error: "Tool implementation not yet available",
        message: "This tool is registered but implementation is pending"
      };
  }
}

// Placeholder implementations - these would be replaced with real logic

async function executeCreamSocialPost(args) {
  // Mock Cream API integration
  return {
    success: true,
    message: \`Posted to \${args.platform}: "\${args.content}"\`,
    postId: "mock_" + Date.now(),
    platform: args.platform
  };
}

async function executeFinanceCalculate(args) {
  // Mock financial calculations
  return {
    success: true,
    calculation: args.type,
    result: Math.random() * 1000,
    currency: "USD"
  };
}

async function executeDocumentPdf(args) {
  // Mock PDF generation
  return {
    success: true,
    message: "PDF generated successfully",
    filename: args.filename || "document.pdf",
    pages: 1
  };
}

async function executeEmailSend(args) {
  // Mock email sending
  return {
    success: true,
    message: \`Email sent to \${args.to.length} recipient(s)\`,
    messageId: "mock_" + Date.now()
  };
}

async function executeChartGenerate(args) {
  // Mock chart generation
  return {
    success: true,
    message: "Chart generated successfully",
    filename: args.filename || "chart.png",
    type: args.type
  };
}

module.exports = { execute };
`;
  }

  /**
   * Get tool statistics
   */
  getStats() {
    const catalog = this.getCatalog();
    const installed = this.getInstalledTools();
    
    const stats = {
      total: catalog.tools.length,
      installed: Object.keys(installed.tools).length,
      available: catalog.tools.filter(t => t.status === "available").length,
      builtin: catalog.tools.filter(t => t.builtin).length,
      categories: {}
    };

    // Count by category
    catalog.tools.forEach(tool => {
      if (!stats.categories[tool.category]) {
        stats.categories[tool.category] = { total: 0, installed: 0 };
      }
      stats.categories[tool.category].total++;
      
      if (installed.tools[tool.id]) {
        stats.categories[tool.category].installed++;
      }
    });

    return stats;
  }
}

module.exports = { ToolRegistry };