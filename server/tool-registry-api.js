"use strict";

const { ToolRegistry } = require("../src/tools/registry/index");
const { ToolInstaller } = require("../src/tools/registry/installer");

/**
 * Tool Registry API endpoints
 */

const registry = new ToolRegistry();
const installer = new ToolInstaller();

/**
 * GET /api/tools/catalog - Get full tool catalog
 */
async function getCatalog(req, res) {
  try {
    const catalog = registry.getCatalog();
    res.json(catalog);
  } catch (error) {
    res.status(500).json({ error: "Failed to load catalog", message: error.message });
  }
}

/**
 * GET /api/tools/installed - Get installed tools
 */
async function getInstalledTools(req, res) {
  try {
    const installed = registry.getInstalledTools();
    res.json(installed);
  } catch (error) {
    res.status(500).json({ error: "Failed to load installed tools", message: error.message });
  }
}

/**
 * GET /api/tools/available - Get available (not installed) tools
 */
async function getAvailableTools(req, res) {
  try {
    const available = registry.getAvailableTools();
    res.json({ tools: available });
  } catch (error) {
    res.status(500).json({ error: "Failed to load available tools", message: error.message });
  }
}

/**
 * GET /api/tools/categories - Get tools by category
 */
async function getToolsByCategory(req, res) {
  try {
    const { category } = req.query;
    const tools = registry.getToolsByCategory(category);
    res.json({ category, tools });
  } catch (error) {
    res.status(500).json({ error: "Failed to load tools by category", message: error.message });
  }
}

/**
 * GET /api/tools/stats - Get tool statistics
 */
async function getStats(req, res) {
  try {
    const stats = registry.getStats();
    const status = installer.getInstallationStatus();
    res.json({ ...stats, ...status });
  } catch (error) {
    res.status(500).json({ error: "Failed to load stats", message: error.message });
  }
}

/**
 * POST /api/tools/install - Install a tool
 */
async function installTool(req, res) {
  try {
    const { toolId, config, force } = req.body;
    
    if (!toolId) {
      return res.status(400).json({ error: "toolId is required" });
    }

    const result = await installer.installTool(toolId, config || {}, force || false);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: "Installation failed", message: error.message });
  }
}

/**
 * POST /api/tools/uninstall - Uninstall a tool
 */
async function uninstallTool(req, res) {
  try {
    const { toolId } = req.body;
    
    if (!toolId) {
      return res.status(400).json({ error: "toolId is required" });
    }

    const result = await installer.uninstallTool(toolId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: "Uninstallation failed", message: error.message });
  }
}

/**
 * POST /api/tools/configure - Configure a tool
 */
async function configureTool(req, res) {
  try {
    const { toolId, config } = req.body;
    
    if (!toolId || !config) {
      return res.status(400).json({ error: "toolId and config are required" });
    }

    const result = installer.updateToolConfig(toolId, config);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: "Configuration failed", message: error.message });
  }
}

/**
 * GET /api/tools/:toolId - Get specific tool details
 */
async function getToolDetails(req, res) {
  try {
    const { toolId } = req.params;
    const tool = registry.getTool(toolId);
    
    if (!tool) {
      return res.status(404).json({ error: "Tool not found" });
    }

    const installed = registry.getInstalledTools();
    const toolDetails = {
      ...tool,
      isInstalled: registry.isToolInstalled(toolId),
      installedConfig: installed.tools[toolId]?.config || null,
      installedAt: installed.tools[toolId]?.installedAt || null
    };

    res.json(toolDetails);
  } catch (error) {
    res.status(500).json({ error: "Failed to get tool details", message: error.message });
  }
}

/**
 * POST /api/tools/batch-install - Install multiple tools
 */
async function batchInstall(req, res) {
  try {
    const { tools } = req.body;
    
    if (!Array.isArray(tools)) {
      return res.status(400).json({ error: "tools array is required" });
    }

    const results = await installer.installTools(tools);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: "Batch installation failed", message: error.message });
  }
}

module.exports = {
  getCatalog,
  getInstalledTools,
  getAvailableTools,
  getToolsByCategory,
  getStats,
  installTool,
  uninstallTool,
  configureTool,
  getToolDetails,
  batchInstall
};