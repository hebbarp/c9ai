#!/usr/bin/env node
"use strict";

/**
 * PDF Generator Tool Installation Script
 * Handles dependencies, validation, and setup
 */

const fs = require("fs-extra");
const path = require("path");
const { execSync } = require("child_process");

async function install(toolDir, config = {}) {
  console.log("📦 Installing PDF Generator tool...");
  
  try {
    // Read tool manifest
    const manifestPath = path.join(toolDir, "c9ai.json");
    const manifest = await fs.readJSON(manifestPath);
    
    console.log(`📄 Installing ${manifest.name} v${manifest.version}`);
    
    // Check Node.js version
    const nodeVersion = process.version;
    const requiredVersion = manifest.engines.node;
    console.log(`🔍 Node.js version: ${nodeVersion} (required: ${requiredVersion})`);
    
    // Install npm dependencies
    if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
      console.log("📦 Installing npm dependencies...");
      
      const packageJson = {
        name: `c9ai-tool-${manifest.name}`,
        version: manifest.version,
        private: true,
        dependencies: manifest.dependencies
      };
      
      await fs.writeJSON(path.join(toolDir, "package.json"), packageJson, { spaces: 2 });
      
      execSync("npm install --production", {
        cwd: toolDir,
        stdio: "inherit"
      });
      
      console.log("✅ Dependencies installed successfully");
    }
    
    // Validate tool implementation
    console.log("🔍 Validating tool implementation...");
    const toolClass = require(path.join(toolDir, "src", "index.js"));
    
    if (!toolClass.PDFGenerator) {
      throw new Error("Tool must export a class matching the tool name");
    }
    
    // Test instantiation
    const tool = new toolClass.PDFGenerator(config);
    if (typeof tool.execute !== "function") {
      throw new Error("Tool must have an execute() method");
    }
    
    console.log("✅ Tool validation passed");
    
    // Create tool runner entry point
    const runnerCode = `
"use strict";

const { PDFGenerator } = require("./src/index");

let toolInstance;

async function execute(args) {
  if (!toolInstance) {
    toolInstance = new PDFGenerator(${JSON.stringify(config)});
  }
  
  return await toolInstance.execute(args);
}

module.exports = { execute };
`;
    
    await fs.writeFile(path.join(toolDir, "index.js"), runnerCode.trim());
    
    console.log("✅ PDF Generator tool installed successfully!");
    
    return {
      success: true,
      tool: {
        id: manifest.name,
        name: manifest.name,
        version: manifest.version,
        entryPoint: path.join(toolDir, "index.js"),
        config,
        installedAt: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error("❌ Installation failed:", error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// CLI usage
if (require.main === module) {
  const toolDir = process.argv[2] || __dirname;
  const config = process.argv[3] ? JSON.parse(process.argv[3]) : {};
  
  install(toolDir, config)
    .then(result => {
      if (result.success) {
        console.log("🎉 Installation completed successfully!");
        process.exit(0);
      } else {
        console.error("💥 Installation failed");
        process.exit(1);
      }
    })
    .catch(error => {
      console.error("💥 Installation error:", error);
      process.exit(1);
    });
}

module.exports = { install };