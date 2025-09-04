#!/usr/bin/env node
"use strict";

/**
 * Test the Tool Registry System
 */

const { ToolRegistry } = require("./src/tools/registry/index");
const { ToolInstaller } = require("./src/tools/registry/installer");

async function testToolRegistry() {
  console.log("🧪 Testing Tool Package Manager System\n");

  const registry = new ToolRegistry();
  const installer = new ToolInstaller();

  // Test 1: Load Catalog
  console.log("1️⃣ Loading tool catalog...");
  const catalog = registry.getCatalog();
  console.log(`   ✅ Loaded ${catalog.tools.length} tools in ${Object.keys(catalog.categories).length} categories`);
  
  // Test 2: Show Available Tools
  console.log("\n2️⃣ Available tools to install:");
  const availableTools = registry.getAvailableTools();
  availableTools.slice(0, 3).forEach(tool => {
    console.log(`   📦 ${tool.name} (${tool.id}) - ${tool.description}`);
  });
  console.log(`   ... and ${availableTools.length - 3} more tools available`);

  // Test 3: Install a Tool
  console.log("\n3️⃣ Installing Cream Social Media tool...");
  try {
    const result = await installer.installTool("cream.social.post", {
      api_key: "test_key_123",
      base_url: "https://api.cream.dev"
    });
    
    if (result.success) {
      console.log(`   ✅ ${result.tool.name} installed successfully!`);
    } else {
      console.log(`   ❌ Installation failed: ${result.error}`);
    }
  } catch (error) {
    console.log(`   ❌ Installation error: ${error.message}`);
  }

  // Test 4: Check Installed Tools
  console.log("\n4️⃣ Checking installed tools...");
  const installed = registry.getInstalledTools();
  const installedCount = Object.keys(installed.tools).length;
  console.log(`   📊 ${installedCount} tools currently installed`);
  
  Object.values(installed.tools).forEach(tool => {
    console.log(`   ✅ ${tool.name} (${tool.id}) - installed ${new Date(tool.installedAt).toLocaleString()}`);
  });

  // Test 5: Get Statistics
  console.log("\n5️⃣ Tool statistics:");
  const stats = registry.getStats();
  console.log(`   📊 Total: ${stats.total}, Installed: ${stats.installed}, Available: ${stats.available}, Built-in: ${stats.builtin}`);
  
  Object.entries(stats.categories).forEach(([category, data]) => {
    console.log(`   📁 ${category}: ${data.installed}/${data.total} installed`);
  });

  // Test 6: Test Tool Execution (if installed)
  if (registry.isToolInstalled("cream.social.post")) {
    console.log("\n6️⃣ Testing tool execution...");
    try {
      const { runTool } = require("./src/tools/registry/enhanced-runner");
      const result = await runTool("cream.social.post", {
        platform: "twitter",
        content: "Hello from the Tool Package Manager! 🚀",
        schedule: new Date(Date.now() + 60000).toISOString()
      });
      
      console.log(`   ✅ Tool execution result:`, result);
    } catch (error) {
      console.log(`   ❌ Tool execution failed: ${error.message}`);
    }
  }

  console.log("\n🎉 Tool Package Manager test completed!");
  console.log("\n💡 Next steps:");
  console.log("   • Open http://127.0.0.1:8787 and navigate to Tool Manager");
  console.log("   • Browse available tools and install more packages");
  console.log("   • Configure API keys for external tools");
  console.log("   • Create workflows using installed tools");
}

// Run the test
if (require.main === module) {
  testToolRegistry().catch(error => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
}

module.exports = { testToolRegistry };