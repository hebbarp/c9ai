#!/usr/bin/env node
"use strict";

const { EnhancedMathProcessor } = require("./src/agent/enhanced-math-processor");

async function testEnhancedProcessor() {
  console.log("🚀 Testing Enhanced Math Processor with Transparency\n");
  
  let currentPhase = "";
  
  const processor = new EnhancedMathProcessor({
    provider: "openai", // Use OpenAI for reliable conversion
    confidenceThreshold: 0.5,
    
    // Progress callback - shows all internal workings
    onProgress: (type, message) => {
      const timestamp = new Date().toLocaleTimeString();
      
      switch(type) {
        case 'start':
          console.log(`\n🎯 [${timestamp}] ${message}`);
          console.log("─".repeat(60));
          break;
        case 'phase':
          currentPhase = message;
          console.log(`\n📋 [${timestamp}] ${message}`);
          console.log("   " + "▪".repeat(40));
          break;
        case 'status':
          console.log(`   ⏳ [${timestamp}] ${message}`);
          break;
        case 'ai':
          console.log(`   🤖 [${timestamp}] ${message}`);
          break;
        case 'debug':
          console.log(`   🔍 [${timestamp}] ${message}`);
          break;
        case 'success':
          console.log(`   ✅ [${timestamp}] ${message}`);
          break;
        case 'warning':
          console.log(`   ⚠️  [${timestamp}] ${message}`);
          break;
        case 'error':
          console.log(`   ❌ [${timestamp}] ${message}`);
          break;
        default:
          console.log(`   📝 [${timestamp}] ${message}`);
      }
    },
    
    // User input callback - simulates user interaction
    onUserInput: async (question) => {
      console.log(`\n🤔 USER PROMPT: ${question}`);
      console.log("   [Simulating user clicking 'Yes'...]");
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("   ✅ User approved");
      return true;
    }
  });
  
  // Test cases with different complexity
  const testCases = [
    {
      name: "Standard Calculation",
      query: "compound interest: 50000 rupees from 1995 at 5.6% annually"
    },
    {
      name: "Dynamic Function Generation", 
      query: "calculate prime numbers up to 50"
    },
    {
      name: "Fibonacci Sequence",
      query: "find the 15th fibonacci number"
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n\n${"=".repeat(80)}`);
    console.log(`🧪 TEST CASE: ${testCase.name}`);
    console.log(`${"=".repeat(80)}`);
    
    // Add ESC handler simulation
    let aborted = false;
    const abortHandler = () => {
      console.log("\n\n⚠️  ESC KEY PRESSED - ABORTING OPERATION");
      processor.abort();
      aborted = true;
    };
    
    // Simulate ESC after 3 seconds for the prime numbers test
    let escTimeout;
    if (testCase.query.includes("prime")) {
      escTimeout = setTimeout(abortHandler, 3000);
    }
    
    try {
      const result = await processor.process(testCase.query);
      
      if (escTimeout) clearTimeout(escTimeout);
      
      if (aborted) {
        console.log("\n🛑 OPERATION ABORTED BY USER");
        continue;
      }
      
      console.log(`\n\n🎉 FINAL RESULT:`);
      console.log(`${"─".repeat(40)}`);
      
      if (result.converted) {
        console.log(`✅ Successfully processed`);
        console.log(`📊 Method: ${result.method}`);
        console.log(`🔧 Functions: ${result.functions?.join(', ') || 'none'}`);
        
        if (result.generatedFunctions) {
          console.log(`🆕 Generated: ${result.generatedFunctions.join(', ')}`);
        }
        
        if (Array.isArray(result.result)) {
          console.log(`🔢 Result: [${result.result.slice(0, 10).join(', ')}${result.result.length > 10 ? ', ...' : ''}]`);
          console.log(`📈 Count: ${result.result.length} items`);
        } else {
          console.log(`💰 Result: ${result.result?.toLocaleString()}`);
        }
        
        console.log(`📝 Expression: ${result.calcExpression}`);
        
      } else {
        console.log(`❌ Not processed: ${result.reason}`);
      }
      
    } catch (error) {
      if (escTimeout) clearTimeout(escTimeout);
      console.log(`\n💥 ERROR: ${error.message}`);
    }
    
    // Reset for next test
    processor.reset();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n\n${"=".repeat(80)}`);
  console.log("🎉 Enhanced Math Processor Testing Complete!");
  console.log(`${"=".repeat(80)}`);
  console.log("\n🔍 What you saw:");
  console.log("   • Complete transparency of AI reasoning");
  console.log("   • Dynamic function generation for missing capabilities");
  console.log("   • User confirmation for code execution");
  console.log("   • Abort capability (ESC key simulation)");
  console.log("   • Progress tracking through all phases");
  console.log("\n🚀 Ready for production use!");
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Process interrupted by user (Ctrl+C)');
  process.exit(0);
});

testEnhancedProcessor().catch(console.error);