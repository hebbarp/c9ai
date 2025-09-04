#!/usr/bin/env node
"use strict";

const { globalContextManager } = require("./src/agent/context-manager");

async function testRhombusContext() {
  console.log("📐 Testing Rhombus Context Recognition\n");
  
  const sessionId = "rhombus_test_session";
  
  // Step 1: Initial incomplete rhombus query
  const query1 = "To find the area of a rhombus, you need to know the length of one of its diagonals";
  const response1 = `To find the area of a rhombus, you need to know the length of one of its diagonals, because the area of a rhombus can be calculated using the formula:

Area = (d1 * d2) / 2

where d1 and d2 are the lengths of the diagonals.

Since you only have the length of one side of the rhombus (2 cm), we cannot directly calculate the area without additional information. If you can provide the length of the diagonal, or the measure of the angles between the sides, or any other relevant information, I can help you calculate the area.`;

  console.log("Step 1: Initial Rhombus Query");
  console.log("─".repeat(50));
  console.log(`User: "Find area of rhombus with side 2 cm"`);
  console.log(`AI: "${response1.substring(0, 100)}..."`);
  
  // Add to context
  globalContextManager.addMessage(sessionId, 'user', 'Find area of rhombus with side 2 cm');
  globalContextManager.addMessage(sessionId, 'assistant', response1);
  
  // Check for incomplete problem
  const incomplete1 = globalContextManager.detectIncompleteProblems('Find area of rhombus with side 2 cm', response1);
  console.log(`\n🔍 Incomplete detected: ${incomplete1.isIncomplete}`);
  
  if (incomplete1.isIncomplete) {
    console.log(`⏳ Missing info detected: ${incomplete1.missingInfo.map(m => m.term).join(', ')}`);
    
    globalContextManager.setPendingContext(sessionId, {
      problem: 'Find area of rhombus with side 2 cm',
      missingInfo: incomplete1.missingInfo,
      timestamp: Date.now()
    });
    console.log(`✅ Context set for continuation`);
  }
  
  // Step 2: Test different continuation formats
  const continuationTests = [
    "d1 = 4 cm and d2 = 6 cm",
    "diagonal 1 = 4 cm, diagonal 2 = 6 cm", 
    "first diagonal 4 cm second diagonal 6 cm",
    "it is 4 cm and 6 cm",
    "the diagonals are 4 cm and 6 cm"
  ];
  
  console.log("\n" + "=".repeat(60));
  console.log("Step 2: Testing Continuation Recognition");
  console.log("=".repeat(60));
  
  for (const testQuery of continuationTests) {
    console.log(`\n📝 Testing: "${testQuery}"`);
    
    // Check if continuation
    const isContinuation = globalContextManager.isContinuation(sessionId, testQuery);
    console.log(`🔗 Recognized as continuation: ${isContinuation}`);
    
    if (isContinuation) {
      // Build contextual prompt
      const contextResult = globalContextManager.buildContextualPrompt(sessionId, testQuery);
      console.log(`🧠 Original: "${contextResult.originalQuery}"`);
      console.log(`🔗 Contextual: "${contextResult.contextualQuery}"`);
      console.log(`✅ Expected result: @calc (4 * 6) / 2 = 12 cm²`);
    } else {
      console.log(`❌ Not recognized - would lose context!`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 CONTEXT RECOGNITION RESULTS");
  console.log("=".repeat(60));
  
  const successfulFormats = continuationTests.filter(query => 
    globalContextManager.isContinuation(sessionId, query)
  );
  
  console.log(`\n✅ Successful recognition: ${successfulFormats.length}/${continuationTests.length}`);
  console.log(`📈 Success rate: ${(successfulFormats.length / continuationTests.length * 100).toFixed(1)}%`);
  
  console.log(`\n🎯 Recognized formats:`);
  successfulFormats.forEach(format => {
    console.log(`   ✅ "${format}"`);
  });
  
  const failedFormats = continuationTests.filter(query => 
    !globalContextManager.isContinuation(sessionId, query)
  );
  
  if (failedFormats.length > 0) {
    console.log(`\n⚠️  Unrecognized formats:`);
    failedFormats.forEach(format => {
      console.log(`   ❌ "${format}"`);
    });
  }
  
  console.log(`\n🚀 Recommended Solution:`);
  console.log(`   📐 For geometry problems: Always recognize d1/d2 format`);
  console.log(`   🔗 Improve pattern matching for measurement continuations`);
  console.log(`   🧠 Better context hints in incomplete responses`);
}

testRhombusContext().catch(console.error);