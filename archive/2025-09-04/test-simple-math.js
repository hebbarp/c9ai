#!/usr/bin/env node
"use strict";

const { NLMathPreprocessor } = require("./src/agent/nl-math-preprocessor");

async function testSimple() {
  console.log("🧮 Testing Simple Math Conversion\n");
  
  const preprocessor = new NLMathPreprocessor({
    provider: "openai", // Use OpenAI directly for testing
    confidenceThreshold: 0.5
  });
  
  const testCase = "What is 25 plus 17?";
  console.log(`📝 Testing: "${testCase}"`);
  
  try {
    const result = await preprocessor.process(testCase);
    
    if (result.converted) {
      console.log(`✅ Converted: ${result.processedText}`);
      console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    } else {
      console.log(`❌ No math detected or conversion failed`);
    }
  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
  }
}

testSimple().catch(console.error);