#!/usr/bin/env node
"use strict";

const { NLMathPreprocessor } = require("./src/agent/nl-math-preprocessor");
const jitTool = require("./src/tools/jit-executor");

async function testFullConversion() {
  console.log("💰 Testing Full Natural Language to Calculation Pipeline\n");
  
  const preprocessor = new NLMathPreprocessor({
    provider: "openai",
    confidenceThreshold: 0.5
  });
  
  // Use the JIT tool execute function
  
  const query = "calculate the total amount today of a 50000 rupees in 1995 kept in a deposit fetching 5.6% compound interest p.a.";
  
  console.log(`📝 Original Query: "${query}"\n`);
  
  try {
    // Step 1: Convert to @calc
    const result = await preprocessor.process(query);
    
    if (result.converted) {
      console.log(`✅ Step 1 - AI Conversion: ${result.processedText}`);
      console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`);
      
      // Step 2: Execute the calculation
      const expression = result.processedText.replace('@calc ', '');
      console.log(`🔢 Step 2 - Executing: ${expression}`);
      
      const calcResult = await jitTool.execute({
        type: 'calc',
        expression: expression
      });
      
      console.log(`💰 Final Result: ₹${calcResult.result.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
      console.log(`📈 Growth: ${((calcResult.result / 50000 - 1) * 100).toFixed(2)}% over 30 years`);
      console.log(`📊 Variables:`, calcResult.variables);
      
    } else {
      console.log(`❌ Conversion failed - no math detected`);
    }
  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
  }
}

testFullConversion().catch(console.error);