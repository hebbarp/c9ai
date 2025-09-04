#!/usr/bin/env node
"use strict";

/**
 * Test the Global Registry System
 * Demonstrates remote registry capabilities
 */

const { EnhancedToolRegistry } = require("./src/tools/registry/enhanced-registry");

async function testGlobalRegistry() {
  console.log("🌍 Testing C9AI Global Registry System\\n");

  // Configure registry (fallback to mock for demo)
  const registry = new EnhancedToolRegistry({
    registryUrl: "https://registry.c9ai.com", // Will fallback to local
    enableRemote: true,
    fallbackToLocal: true
  });

  console.log("1️⃣ Fetching unified catalog (local + remote)...");
  try {
    const catalog = await registry.getCatalog();
    console.log(`   ✅ Found ${catalog.totalTools} tools from sources: ${catalog.sources.join(", ")}`);
    console.log(`   📊 Categories: ${Object.keys(catalog.categories).length}`);
    console.log(`   🕒 Last updated: ${catalog.lastUpdated}`);
  } catch (error) {
    console.log(`   ❌ Catalog fetch failed: ${error.message}`);
  }

  console.log("\\n2️⃣ Testing tool search...");
  try {
    const searchResults = await registry.searchTools("pdf", { limit: 5 });
    console.log(`   🔍 Found ${searchResults.total} tools matching "pdf"`);
    
    searchResults.tools.slice(0, 3).forEach(tool => {
      console.log(`   📦 ${tool.name} (${tool.id}) - ${tool.source}`);
      console.log(`      ${tool.description}`);
    });
  } catch (error) {
    console.log(`   ❌ Search failed: ${error.message}`);
  }

  console.log("\\n3️⃣ Testing tool details fetch...");
  try {
    const toolDetails = await registry.getToolDetails("document.pdf");
    console.log(`   📄 Tool: ${toolDetails.name}`);
    console.log(`   📍 Source: ${toolDetails.source}`);
    console.log(`   📝 Description: ${toolDetails.description}`);
  } catch (error) {
    console.log(`   ❌ Tool details failed: ${error.message}`);
  }

  console.log("\\n4️⃣ Testing remote tool installation (simulation)...");
  try {
    // This will try remote first, fall back to local
    const installResult = await registry.installTool("email.send", {
      provider: "sendgrid",
      api_key: "test_key"
    });
    
    if (installResult.success) {
      console.log(`   ✅ ${installResult.tool.name} installed from ${installResult.tool.source}`);
    } else {
      console.log(`   ❌ Installation failed: ${installResult.error}`);
    }
  } catch (error) {
    console.log(`   ❌ Installation error: ${error.message}`);
  }

  console.log("\\n5️⃣ Current system statistics...");
  try {
    const stats = registry.getStats();
    console.log(`   📊 Total tools: ${stats.total}`);
    console.log(`   ✅ Installed: ${stats.installed}`);
    console.log(`   📦 Available: ${stats.available}`);
    console.log(`   🔧 Built-in: ${stats.builtin}`);
    
    console.log(`   📁 Categories:`);
    Object.entries(stats.categories).forEach(([category, data]) => {
      console.log(`      ${category}: ${data.installed}/${data.total} installed`);
    });
  } catch (error) {
    console.log(`   ❌ Stats failed: ${error.message}`);
  }

  console.log("\\n🎉 Global Registry test completed!\\n");
  console.log("💡 Next steps for production:");
  console.log("   • Deploy registry.c9ai.com with real tool packages");
  console.log("   • Implement package signing and verification");
  console.log("   • Create tool submission workflow for developers");
  console.log("   • Add tool analytics and popularity tracking");
  console.log("   • Build web interface for registry browsing");
  console.log("\\n🌐 Architecture benefits:");
  console.log("   ✅ Centralized tool curation like npm/brew");
  console.log("   ✅ Automatic updates and dependency management");
  console.log("   ✅ Fallback to local catalog when offline");
  console.log("   ✅ Unified search across local + remote tools");
  console.log("   ✅ Version management and rollback support");
}

// Run test
if (require.main === module) {
  testGlobalRegistry().catch(error => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
}

module.exports = { testGlobalRegistry };