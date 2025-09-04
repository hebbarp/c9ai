#!/usr/bin/env node
"use strict";

/**
 * Test Credit System Implementation
 * Demonstrates Claude Code style pay-as-you-go pricing
 */

const { CreditSystem, InsufficientCreditsError } = require("./src/billing/credit-system");

async function testCreditSystem() {
  console.log("💳 Testing C9AI Credit System (Claude Code Style)\\n");

  const credits = new CreditSystem();

  // Test 1: Create workshop participant account
  console.log("1️⃣ Creating workshop participant account...");
  const activation = await credits.activateWorkshopAccount(
    "participant@company.com",
    "WORKSHOP2025",
    { workshopName: "AI Tools Mastery Workshop" }
  );
  
  console.log(`   ✅ Workshop account activated`);
  console.log(`   📧 Email: participant@company.com`);
  console.log(`   🆔 User ID: ${activation.userId}`);
  console.log(`   💰 Free credits: ${activation.credits}`);
  console.log(`   🔑 Activation code: ${activation.activationCode}`);

  const userId = activation.userId;

  // Test 2: Check operation costs
  console.log("\\n2️⃣ Operation costs overview...");
  const operationCosts = credits.getOperationCosts();
  
  console.log("   💚 FREE operations:");
  Object.entries(operationCosts).filter(([_, cost]) => cost === 0).forEach(([op, cost]) => {
    console.log(`      ${op}: ${cost} credits`);
  });
  
  console.log("   💙 BASIC operations:");
  Object.entries(operationCosts).filter(([_, cost]) => cost > 0 && cost <= 1).forEach(([op, cost]) => {
    console.log(`      ${op}: ${cost} credits`);
  });
  
  console.log("   🤖 AI-POWERED operations:");
  Object.entries(operationCosts).filter(([_, cost]) => cost > 1 && cost <= 10).forEach(([op, cost]) => {
    console.log(`      ${op}: ${cost} credits`);
  });
  
  console.log("   ⭐ PREMIUM operations:");
  Object.entries(operationCosts).filter(([_, cost]) => cost > 10).forEach(([op, cost]) => {
    console.log(`      ${op}: ${cost} credits`);
  });

  // Test 3: Simulate workshop usage
  console.log("\\n3️⃣ Simulating workshop usage...");
  
  const workshopOperations = [
    { op: "system.tool.execute", desc: "Run pandoc command", qty: 5 },
    { op: "package.search", desc: "Search for tools", qty: 10 },
    { op: "package.install", desc: "Install ffmpeg", qty: 3 },
    { op: "script.generate", desc: "Generate Python script", qty: 2 },
    { op: "ai.chat.message", desc: "Ask AI questions", qty: 15 },
    { op: "tool.recommend", desc: "Get tool suggestions", qty: 4 }
  ];
  
  let totalCost = 0;
  for (const { op, desc, qty } of workshopOperations) {
    try {
      const result = await credits.deductCredits(userId, op, qty, { 
        description: desc,
        workshop: "WORKSHOP2025" 
      });
      
      console.log(`   ✅ ${desc} (×${qty}): -${result.creditsDeducted} credits (balance: ${result.remainingBalance})`);
      totalCost += result.creditsDeducted;
      
    } catch (error) {
      console.log(`   ❌ ${desc}: ${error.message}`);
    }
  }
  
  console.log(`   📊 Total workshop usage: ${totalCost} credits`);

  // Test 4: Check account summary
  console.log("\\n4️⃣ Account summary after workshop...");
  const summary = await credits.getUserSummary(userId);
  console.log(`   💰 Current balance: ${summary.credits.balance} credits`);
  console.log(`   📈 Total used: ${summary.credits.totalUsed} credits`);
  console.log(`   📊 Most used operations:`);
  summary.estimatedUsageCost.mostUsedOperations.forEach(({ operation, credits: used }) => {
    console.log(`      ${operation}: ${used} credits`);
  });

  // Test 5: Purchase more credits
  console.log("\\n5️⃣ Testing credit purchase...");
  const packages = credits.getCreditPackages();
  console.log("   📦 Available packages:");
  packages.forEach(pkg => {
    console.log(`      ${pkg.id}: ${pkg.totalCredits} credits for $${pkg.price} ($${pkg.pricePerCredit.toFixed(4)}/credit)`);
  });
  
  try {
    const purchase = await credits.purchaseCredits(userId, "developer", {
      paymentMethod: "demo_card_1234"
    });
    
    console.log(`   ✅ Purchased ${purchase.creditsAdded} credits`);
    console.log(`   💰 New balance: ${purchase.newBalance} credits`);
    
  } catch (error) {
    console.log(`   ❌ Purchase failed: ${error.message}`);
  }

  // Test 6: Auto-recharge configuration
  console.log("\\n6️⃣ Testing auto-recharge setup...");
  const user = await credits.getOrCreateUser(userId);
  user.autoRecharge = {
    enabled: true,
    threshold: 100,
    packageId: "starter",
    paymentMethod: "demo_card_1234"
  };
  
  const users = await credits.loadUsers();
  users[userId] = user;
  await credits.saveUsers(users);
  
  console.log("   ✅ Auto-recharge configured:");
  console.log(`      Threshold: ${user.autoRecharge.threshold} credits`);
  console.log(`      Package: ${user.autoRecharge.packageId}`);
  console.log(`      Enabled: ${user.autoRecharge.enabled}`);

  // Test 7: Simulate low balance scenario
  console.log("\\n7️⃣ Testing insufficient credits scenario...");
  
  // Use up most credits
  try {
    await credits.deductCredits(userId, "workflow.create", 50, { 
      description: "Large workflow generation" 
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      console.log(`   ⚠️  Insufficient credits detected: ${error.message}`);
      
      // Check if auto-recharge would trigger
      const currentUser = await credits.getOrCreateUser(userId);
      if (currentUser.credits.balance <= currentUser.autoRecharge.threshold) {
        console.log(`   🔄 Auto-recharge would trigger (balance: ${currentUser.credits.balance} ≤ threshold: ${currentUser.autoRecharge.threshold})`);
        
        try {
          const recharge = await credits.attemptAutoRecharge(userId);
          if (recharge.success) {
            console.log(`   ✅ Auto-recharge successful: +${recharge.creditsAdded} credits`);
          } else {
            console.log(`   ❌ Auto-recharge failed: ${recharge.reason}`);
          }
        } catch (rechargeError) {
          console.log(`   ❌ Auto-recharge error: ${rechargeError.message}`);
        }
      }
    }
  }

  // Test 8: Final account status
  console.log("\\n8️⃣ Final account status...");
  const finalSummary = await credits.getUserSummary(userId);
  console.log(`   👤 User: ${finalSummary.email}`);
  console.log(`   💰 Balance: ${finalSummary.credits.balance} credits`);
  console.log(`   💳 Total purchased: ${finalSummary.credits.totalPurchased} credits`);
  console.log(`   📊 Total used: ${finalSummary.credits.totalUsed} credits`);
  console.log(`   💰 Account value: $${finalSummary.accountValue}`);
  console.log(`   📅 Member since: ${new Date(finalSummary.joinDate).toLocaleDateString()}`);

  console.log("\\n🎉 Credit System test completed!\\n");
  
  console.log("💡 Key Benefits Demonstrated:");
  console.log("   ✅ Claude Code style pay-as-you-go pricing");
  console.log("   ✅ Workshop participants get free starter credits");
  console.log("   ✅ System tools are FREE (orchestration model)");
  console.log("   ✅ AI features cost credits (sustainable revenue)");
  console.log("   ✅ Auto-recharge prevents service interruption");
  console.log("   ✅ Transparent usage tracking and billing");
  console.log("   ✅ Fair pricing aligned with value delivered");

  console.log("\\n🚀 Business Model Benefits:");
  console.log("   💰 Recurring revenue through credit purchases");
  console.log("   🎯 Workshop-driven customer acquisition"); 
  console.log("   📈 Usage-based scaling (heavy users pay more)");
  console.log("   🔄 Auto-recharge ensures continuous service");
  console.log("   💎 Premium features drive higher credit consumption");

  return {
    userId,
    finalBalance: finalSummary.credits.balance,
    totalUsed: finalSummary.credits.totalUsed,
    accountValue: finalSummary.accountValue
  };
}

// Run test
if (require.main === module) {
  testCreditSystem().catch(error => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
}

module.exports = { testCreditSystem };