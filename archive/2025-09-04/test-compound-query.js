#!/usr/bin/env node
"use strict";

const { NLMathPreprocessor } = require("./src/agent/nl-math-preprocessor");

async function testCompoundQuery() {
  console.log("🧮 Testing Compound Interest Query\n");
  
  const preprocessor = new NLMathPreprocessor({
    provider: "openai", // Use OpenAI for reliable conversion
    confidenceThreshold: 0.5
  });
  
  const query = "calculate the total amount today of a 50000 rupees in 1995 kept in a deposit fetching 5.6% compound interest p.a.";
  
  console.log(`📝 Testing: "${query}"`);
  
  try {
    const result = await preprocessor.process(query);
    
    if (result.converted) {
      console.log(`✅ Converted to: ${result.processedText}`);
      console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      
      // Calculate the periods (1995 to current year)
      const currentYear = new Date().getFullYear();
      const periods = currentYear - 1995;
      console.log(`📅 Periods (1995 to ${currentYear}): ${periods} years`);
      
      // Expected format should be something like: @calc compound(50000, 0.056, 29)
      console.log(`💡 Manual calculation: @calc compound(50000, 0.056, ${periods})`);
      
    } else {
      console.log(`❌ Not converted - no math detected or conversion failed`);
    }
  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
  }
}

testCompoundQuery().catch(console.error);