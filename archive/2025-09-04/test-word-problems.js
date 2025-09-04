#!/usr/bin/env node
"use strict";

const { NLMathPreprocessor } = require("./src/agent/nl-math-preprocessor");
const jitTool = require("./src/tools/jit-executor");

async function testWordProblem(query) {
  console.log(`\n📝 Word Problem: "${query}"`);
  console.log("─".repeat(60));
  
  const preprocessor = new NLMathPreprocessor({
    provider: "openai",
    confidenceThreshold: 0.5
  });
  
  try {
    // Step 1: Convert to @calc
    const result = await preprocessor.process(query);
    
    if (result.converted) {
      console.log(`🤖 AI Conversion: ${result.processedText}`);
      
      // Step 2: Execute the calculation
      const expression = result.processedText.replace('@calc ', '');
      const calcResult = await jitTool.execute({
        type: 'calc',
        expression: expression
      });
      
      console.log(`💡 Result: ${calcResult.result.toLocaleString()}`);
      
      // Format result based on context
      if (query.includes('percentage') || query.includes('percent') || query.includes('%')) {
        console.log(`📊 Percentage: ${calcResult.result.toFixed(2)}%`);
      } else if (query.includes('rupees') || query.includes('₹')) {
        console.log(`💰 Amount: ₹${calcResult.result.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
      } else if (query.includes('dollars') || query.includes('$')) {
        console.log(`💰 Amount: $${calcResult.result.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      }
      
    } else {
      console.log(`❌ Could not solve - not recognized as a math problem`);
    }
  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
  }
}

async function testAllWordProblems() {
  console.log("📚 Testing Universal Word Problem Solver for Executives\n");
  
  const businessWordProblems = [
    // Revenue & Growth
    "Our company revenue grew from 5 million to 12 million over 3 years. What's our CAGR?",
    
    // Break-even analysis  
    "If our fixed costs are 50000, variable cost per unit is 25, and selling price is 75, how many units to break even?",
    
    // ROI calculations
    "We invested 200000 in marketing and got 350000 additional revenue. What's the ROI percentage?",
    
    // Pricing strategy
    "Our cost is 40 dollars per unit and we want 60% margin. What should be the selling price?",
    
    // Employee calculations
    "We have 150 employees, planning to grow by 25% next year. How many new hires do we need?",
    
    // Financial ratios
    "If net income is 2.5 million and total revenue is 25 million, what's our profit margin percentage?",
    
    // Compound scenarios
    "A client pays us 10000 monthly. If we invest it at 8% annual return, what's the value after 2 years?",
    
    // Market share
    "Our sales are 15 million in a market worth 120 million. What's our market share percentage?",
    
    // Loan calculations
    "What's the monthly payment for a 500000 loan at 7% interest for 20 years?"
  ];
  
  for (const problem of businessWordProblems) {
    await testWordProblem(problem);
  }
  
  console.log("\n🎉 Word Problem Testing Complete!");
}

testAllWordProblems().catch(console.error);