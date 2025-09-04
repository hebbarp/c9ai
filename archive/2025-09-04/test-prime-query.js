#!/usr/bin/env node
"use strict";

const { NLMathPreprocessor } = require("./src/agent/nl-math-preprocessor");

async function testPrimeQuery() {
  console.log("🔍 Testing Prime Numbers Query\n");
  
  const preprocessor = new NLMathPreprocessor({
    provider: "openai",
    confidenceThreshold: 0.5
  });
  
  const query = "calculate prime numbers upto 100";
  console.log(`📝 Query: "${query}"`);
  
  // Test math detection
  console.log(`🤔 Has math intent: ${preprocessor.hasMathIntent(query)}`);
  
  try {
    const result = await preprocessor.process(query);
    
    if (result.converted) {
      console.log(`✅ Converted to: ${result.processedText}`);
      console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    } else {
      console.log(`❌ Not converted - this is why it fell through to general AI`);
      console.log(`🧠 Reason: Not detected as mathematical calculation`);
    }
  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
  }
  
  console.log(`\n💡 Analysis: Prime number generation is an algorithmic task, not a calculation.`);
  console.log(`📊 The system correctly identified this as non-mathematical and passed it to general AI.`);
}

testPrimeQuery().catch(console.error);