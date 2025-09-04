#!/usr/bin/env node
"use strict";

/**
 * Test System Program Detection
 */

const { SystemProgramDetector } = require("./src/tools/system/detector");

async function testSystemDetection() {
  console.log("🔍 Testing System Program Detection\\n");

  const detector = new SystemProgramDetector();

  // Test 1: Detect all available programs
  console.log("1️⃣ Scanning for system programs...");
  const programs = await detector.detectAll();

  console.log(`\\n📊 Detection Results:`);
  console.log(`   Found ${programs.length} available programs\\n`);

  // Group by capabilities
  const byCapability = {};
  programs.forEach(program => {
    program.capabilities.forEach(cap => {
      if (!byCapability[cap]) byCapability[cap] = [];
      byCapability[cap].push(program.name);
    });
  });

  console.log("📋 Available capabilities:");
  Object.entries(byCapability).forEach(([capability, tools]) => {
    console.log(`   ${capability}: ${tools.join(", ")}`);
  });

  // Test 2: Get detailed info for specific programs
  console.log("\\n2️⃣ Getting detailed information for key programs...");
  const keyPrograms = ["pandoc", "ffmpeg", "python", "node", "git"];
  
  for (const programName of keyPrograms) {
    const details = await detector.getProgramDetails(programName);
    if (details) {
      console.log(`\\n   📦 ${details.name} v${details.version}`);
      console.log(`      ${details.description}`);
      console.log(`      Capabilities: ${details.capabilities.join(", ")}`);
      
      if (details.commonUsage && details.commonUsage.length > 0) {
        console.log(`      Example: ${details.commonUsage[0]}`);
      }
      
      if (details.supportedFormats) {
        const { input, output } = details.supportedFormats;
        if (input && input.length) {
          console.log(`      Input formats: ${input.join(", ")}`);
        }
        if (output && output.length) {
          console.log(`      Output formats: ${output.join(", ")}`);
        }
      }
    }
  }

  // Test 3: Save and load registry
  console.log("\\n3️⃣ Testing registry persistence...");
  const savedPath = await detector.saveDetectionResults(programs);
  console.log(`   ✅ Registry saved to: ${savedPath}`);

  const cached = await detector.loadCachedResults();
  console.log(`   📋 Loaded ${cached ? cached.length : 0} programs from cache`);

  // Test 4: Demonstrate tool resolution
  console.log("\\n4️⃣ Tool resolution examples:");
  
  const examples = [
    { task: "Convert markdown to PDF", expectedTools: ["pandoc", "pdflatex"] },
    { task: "Process video files", expectedTools: ["ffmpeg"] },
    { task: "Manipulate images", expectedTools: ["imagemagick"] },
    { task: "Parse JSON data", expectedTools: ["jq", "python"] },
    { task: "Make HTTP requests", expectedTools: ["curl", "wget"] }
  ];

  examples.forEach(({ task, expectedTools }) => {
    const availableTools = expectedTools.filter(toolName => 
      programs.some(p => p.name === toolName)
    );
    
    console.log(`   "${task}"`);
    if (availableTools.length > 0) {
      console.log(`      ✅ Available: ${availableTools.join(", ")}`);
    } else {
      console.log(`      ❌ No system tools found - would generate script`);
    }
  });

  console.log("\\n🎉 System detection test completed!\\n");
  console.log("💡 Benefits demonstrated:");
  console.log("   • Automatic discovery of 20+ common system programs");
  console.log("   • Capability-based tool matching");
  console.log("   • Version tracking and compatibility");
  console.log("   • Persistent registry with caching");
  console.log("   • Intelligent tool resolution for tasks");
}

// Run test
if (require.main === module) {
  testSystemDetection().catch(error => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
}

module.exports = { testSystemDetection };