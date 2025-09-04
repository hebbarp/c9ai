#!/usr/bin/env node
"use strict";
/**
 * Test Natural Language Math Conversion
 */

const { NLMathPreprocessor } = require("./src/agent/nl-math-preprocessor");

async function testNLMath() {
  console.log("🧮 Testing Natural Language Math Conversion\n");
  
  const preprocessor = new NLMathPreprocessor({
    provider: "llamacpp",
    fallbackProvider: "openai",
    confidenceThreshold: 0.6
  });
  
  const testCases = [
    // Basic arithmetic
    "What is 25 plus 17?",
    "Calculate 45 times 8",
    "What's 144 divided by 12?",
    "Find 25% of 200",
    
    // Business calculations  
    "If I invested 50000 and got back 75000, what's my ROI?",
    "Calculate compound growth of $10000 at 7% for 10 years",
    "What's the present value of 300000 at 5% monthly rate for 360 periods?",
    
    // Mathematical functions
    "What's the square root of 144?",
    "Calculate 2 to the power of 8",
    "Find the average of 10, 20, 30, 40, 50",
    
    // Advanced financial
    "Calculate NPV for cash flows -100000, 20000, 30000, 40000, 50000 at 10% discount",
    "Find CAGR from 10000 to 25000 over 5 years",
    
    // Non-math queries (should not convert)
    "Hello, how are you today?",
    "What's the weather like?",
    "Tell me about artificial intelligence"
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📝 Testing: "${testCase}"`);
    
    try {
      const result = await preprocessor.process(testCase);
      
      if (result.converted) {
        console.log(`✅ Converted: ${result.processedText}`);
        console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        if (result.usedFallback) {
          console.log(`🌐 Used fallback provider`);
        }
      } else {
        console.log(`❌ No math detected`);
      }
    } catch (error) {
      console.log(`💥 Error: ${error.message}`);
    }
  }
  
  console.log("\n🎉 Test completed!");
}

// Run the test
if (require.main === module) {
  testNLMath().catch(console.error);
}

module.exports = { testNLMath };