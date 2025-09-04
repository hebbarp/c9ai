#!/usr/bin/env node
"use strict";

const { globalContextManager } = require("./src/agent/context-manager");

async function testYourExactProblem() {
  console.log("🔧 Testing Your Exact Rhombus Problem\n");
  
  const sessionId = "your_session";
  
  // Simulate your exact sequence
  console.log("=".repeat(60));
  console.log("SIMULATING YOUR EXACT CONVERSATION");
  console.log("=".repeat(60));
  
  // Step 1: Your first message about rhombus
  const rhombusQuery = "what is the area of a rhombus with one side 2 cm";
  const rhombusResponse = `To find the area of a rhombus, you need to know the length of one of its diagonals, because the area of a rhombus can be calculated using the formula:

Area = (d1 * d2) / 2

where d1 and d2 are the lengths of the diagonals.

Since you only have the length of one side of the rhombus (2 cm), we cannot directly calculate the area without additional information. If you can provide the length of the diagonal, or the measure of the angles between the sides, or any other relevant information, I can help you calculate the area.`;

  console.log(`\n1️⃣ USER: "${rhombusQuery}"`);
  console.log(`🤖 AI: Asks for diagonal information...`);
  
  // Add to context
  globalContextManager.addMessage(sessionId, 'user', rhombusQuery);
  globalContextManager.addMessage(sessionId, 'assistant', rhombusResponse);
  
  // Check for incomplete
  const incomplete = globalContextManager.detectIncompleteProblems(rhombusQuery, rhombusResponse);
  console.log(`\n🔍 System detects incomplete: ${incomplete.isIncomplete}`);
  
  if (incomplete.isIncomplete) {
    globalContextManager.setPendingContext(sessionId, {
      problem: rhombusQuery,
      missingInfo: incomplete.missingInfo,
      timestamp: Date.now()
    });
    console.log(`✅ Context saved for continuation`);
  }
  
  // Step 2: Your diagonal values
  const diagonalQuery = "d1 = 4 cm and d2 = 6 cm";
  console.log(`\n2️⃣ USER: "${diagonalQuery}"`);
  
  // Test the exact pattern
  const testPattern = /^d1\s*=.*d2\s*=/i;
  const patternMatch = testPattern.test(diagonalQuery);
  console.log(`🔍 Pattern /^d1\\s*=.*d2\\s*=/i matches: ${patternMatch}`);
  
  // Check continuation
  const isContinuation = globalContextManager.isContinuation(sessionId, diagonalQuery);
  console.log(`🔗 System recognizes continuation: ${isContinuation}`);
  
  if (isContinuation) {
    const contextResult = globalContextManager.buildContextualPrompt(sessionId, diagonalQuery);
    console.log(`\n✅ SUCCESS - Would combine to:`);
    console.log(`"${contextResult.contextualQuery}"`);
    console.log(`\n🧮 Expected AI conversion:`);
    console.log(`"@calc (4 * 6) / 2"`);
    console.log(`\n🔢 Expected result: 12 cm²`);
  } else {
    console.log(`\n❌ FAILURE - Context lost, treats as separate problem`);
    console.log(`🔧 This is exactly what happened to you!`);
  }
  
  // Test alternative formats that should work
  console.log(`\n${"─".repeat(40)}`);
  console.log(`🔧 TESTING ALTERNATIVE FORMATS:`);
  console.log(`${"─".repeat(40)}`);
  
  const alternatives = [
    "d1=4cm d2=6cm",
    "diagonal 1 is 4 cm and diagonal 2 is 6 cm",  
    "the diagonals are 4 and 6 cm",
    "first diagonal 4cm, second diagonal 6cm"
  ];
  
  for (const alt of alternatives) {
    const works = globalContextManager.isContinuation(sessionId, alt);
    console.log(`${works ? '✅' : '❌'} "${alt}"`);
  }
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`💡 IMMEDIATE FIX FOR YOUR PROBLEM:`);
  console.log(`${"=".repeat(60)}`);
  console.log(`\nInstead of: "d1 = 4 cm and d2 = 6 cm"`);
  console.log(`Try saying: "the first diagonal is 4 cm and the second is 6 cm"`);
  console.log(`Or simply: "4 cm and 6 cm" (numbers + units pattern)`);
  
  // Test the simple format
  const simpleFormat = "4 cm and 6 cm";
  const simpleWorks = globalContextManager.isContinuation(sessionId, simpleFormat);
  console.log(`\n🧪 Testing simple format: "${simpleFormat}"`);
  console.log(`✅ Works: ${simpleWorks}`);
  
  if (simpleWorks) {
    const simpleResult = globalContextManager.buildContextualPrompt(sessionId, simpleFormat);
    console.log(`🔗 Combined query: "${simpleResult.contextualQuery}"`);
  }
}

testYourExactProblem().catch(console.error);