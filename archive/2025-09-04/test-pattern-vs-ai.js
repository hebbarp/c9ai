#!/usr/bin/env node
"use strict";

const { PatternFirstPreprocessor } = require("./src/agent/pattern-first-preprocessor");

async function testPatternVsAI() {
  console.log("⚡ Testing Pattern-First vs AI Approach\n");
  
  const processor = new PatternFirstPreprocessor();
  
  const executiveQueries = [
    // Should match patterns (no AI needed)
    "What is the area of a triangle with sides 2 cm and 4 cm",
    "Calculate 25% of 200000",
    "ROI if invested 500000 and got back 750000", 
    "Compound interest on 100000 at 7.5% for 10 years",
    "Break even: fixed costs 50000, variable cost 25, price 75",
    "What is 145 plus 67",
    
    // Should need AI (complex/unusual phrasing)
    "Calculate prime numbers up to 100",
    "Find the 15th fibonacci number", 
    "What's the NPV of cash flows -100k, 20k, 30k, 40k at 10% discount",
    "How much runway do we have with 2M in bank burning 500K monthly"
  ];
  
  console.log("🧪 Testing Pattern Coverage:\n");
  
  let patternSuccesses = 0;
  let aiNeeded = 0;
  
  for (const query of executiveQueries) {
    console.log(`📝 Query: "${query}"`);
    
    const result = await processor.processWithPatterns(query);
    
    if (result.success) {
      console.log(`   ✅ PATTERN MATCH: ${result.patternName} (${(result.confidence * 100).toFixed(0)}% confidence)`);
      console.log(`   🔢 Generated: ${result.calcExpression}`);
      console.log(`   🏠 AI Needed: NO\n`);
      patternSuccesses++;
    } else {
      console.log(`   ❌ NO PATTERN: ${result.reason}`);
      console.log(`   🌐 AI Needed: YES\n`);
      aiNeeded++;
    }
  }
  
  // Coverage statistics
  const stats = processor.getCoverageStats(executiveQueries);
  
  console.log("=" .repeat(70));
  console.log("📊 COVERAGE ANALYSIS");
  console.log("=".repeat(70));
  
  console.log(`\n📈 Results:`);
  console.log(`   Total Queries: ${stats.total}`);
  console.log(`   Pattern Covered: ${stats.patternCovered} (${stats.patternCoverage})`);
  console.log(`   AI Required: ${stats.aiRequired} (${stats.aiDependency})`);
  
  console.log(`\n🎯 OpenAI Usage Reduction:`);
  console.log(`   Before: 100% queries go to AI`);
  console.log(`   After: Only ${stats.aiDependency} queries need AI`);
  console.log(`   Savings: ${(100 - parseFloat(stats.aiDependency)).toFixed(1)}% reduction!`);
  
  console.log(`\n🔒 Privacy Improvement:`);
  console.log(`   📊 ${stats.patternCovered}/${stats.total} queries processed locally`);
  console.log(`   🏠 Your business data stays on your machine`);
  console.log(`   ⚡ Faster response (no network calls)`);
  console.log(`   💰 Lower API costs`);
  
  console.log(`\n🚀 Implementation Strategy:`);
  console.log(`   1. 🔍 Try patterns first (instant, local)`);
  console.log(`   2. 🤖 Fall back to local AI if no pattern`);
  console.log(`   3. 🌐 Use OpenAI only as last resort`);
  console.log(`   4. 📈 Learn from successful patterns`);
  
  console.log(`\n✅ Recommended Architecture:`);
  console.log(`   Pattern Match → Local AI → OpenAI Fallback`);
  console.log(`   Expected OpenAI usage: ~20% of queries`);
}

testPatternVsAI().catch(console.error);