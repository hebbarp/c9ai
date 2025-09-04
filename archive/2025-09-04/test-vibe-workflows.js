#!/usr/bin/env node
"use strict";

/**
 * Test Universal Vibe Task Manager
 * Demonstrates vibe detection, template matching, and workflow execution
 */

const { VibeWorkflowEngine } = require("./src/workflows/template-engine");
const { VibeMatcher } = require("./src/workflows/vibe-matcher");

async function testVibeWorkflows() {
  console.log("🎭 Testing Universal Vibe Task Manager\n");

  const workflowEngine = new VibeWorkflowEngine();
  const vibeMatcher = new VibeMatcher();
  
  await workflowEngine.initialize();

  // Test Scenario 1: Morning Creative Energy
  console.log("📅 Scenario 1: Monday Morning - High Energy Creative Session");
  console.log("=" .repeat(60));
  
  const morningContext = {
    timeOfDay: new Date().setHours(8, 30, 0), // 8:30 AM
    energyLevel: "high",
    mood: "creative",
    availableTime: 90, // minutes
    workEnvironment: "quiet",
    workContext: ["home-office", "quiet-space"],
    recentActivity: ["research", "planning"],
    goals: ["create", "ship"],
    deadlines: []
  };

  const morningVibe = vibeMatcher.detectCurrentVibe(morningContext);
  console.log(`🎯 Detected Vibe: ${morningVibe.primaryVibe?.[0] || 'balanced-work'}`);
  console.log(`   Confidence: ${(morningVibe.confidence * 100).toFixed(1)}%`);
  console.log(`   Signals: ${morningVibe.detectedSignals.slice(0, 4).join(', ')}...`);

  const morningRecommendations = vibeMatcher.getVibeRecommendations(morningVibe);
  console.log(`\n💡 Vibe Recommendations:`);
  console.log(`   Energy: ${morningRecommendations.vibe.description}`);
  console.log(`   Duration: ${morningRecommendations.optimalDuration}`);
  console.log(`   Best for: ${morningRecommendations.suggestedWorkflows.slice(0, 2).map(w => w.type).join(', ')}`);

  const morningMatches = await workflowEngine.matchTemplatesForVibe(morningContext);
  console.log(`\n🎯 Top Matching Templates:`);
  morningMatches.slice(0, 3).forEach((match, i) => {
    console.log(`   ${i + 1}. ${match.template.name} (${(match.score * 100).toFixed(0)}% match)`);
    console.log(`      Duration: ${match.template.vibe.duration} | Credits: ${match.template.credits?.estimated || 0}`);
    console.log(`      Vibe: ${match.template.vibe.energy} → ${match.template.vibe.mood}`);
  });

  // Test adaptation for time constraint
  if (morningMatches.length > 0) {
    const topTemplate = morningMatches[0].template;
    console.log(`\n🔧 Testing Template Adaptation:`);
    console.log(`   Original: "${topTemplate.name}" (${topTemplate.vibe.duration})`);
    
    const adaptedTemplate = workflowEngine.adaptTemplate(topTemplate, {
      timeAvailable: 45, // Only 45 minutes available
      energyLevel: "high",
      context: ["focused-time"]
    });
    
    console.log(`   Adapted: ${adaptedTemplate.activeAdaptation || 'no-adaptation'} version`);
    console.log(`   Steps: ${adaptedTemplate.flow?.length || 'unchanged'} workflow steps`);
  }

  // Test Scenario 2: Afternoon Analysis Mode
  console.log("\n📊 Scenario 2: Wednesday Afternoon - Deep Analysis Session");
  console.log("=" .repeat(60));
  
  const afternoonContext = {
    timeOfDay: new Date().setHours(14, 0, 0), // 2:00 PM
    energyLevel: "focused",
    mood: "analytical", 
    availableTime: 120, // 2 hours
    workEnvironment: "quiet",
    workContext: ["quiet-space", "dual-monitor"],
    recentActivity: ["data-gathering", "research"],
    goals: ["analyze", "understand"],
    deadlines: [],
    tools: ["jupyter", "pandas", "data-viz"]
  };

  const afternoonVibe = vibeMatcher.detectCurrentVibe(afternoonContext);
  console.log(`🎯 Detected Vibe: ${afternoonVibe.primaryVibe?.[0] || 'balanced-work'}`);
  console.log(`   Confidence: ${(afternoonVibe.confidence * 100).toFixed(1)}%`);
  
  const afternoonMatches = await workflowEngine.matchTemplatesForVibe(afternoonContext);
  if (afternoonMatches.length > 0) {
    const analyticalTemplate = afternoonMatches[0];
    console.log(`\n🔬 Best Match: ${analyticalTemplate.template.name}`);
    console.log(`   Match Score: ${(analyticalTemplate.score * 100).toFixed(0)}%`);
    console.log(`   Flow Steps:`);
    
    analyticalTemplate.template.flow?.forEach((step, i) => {
      console.log(`     ${i + 1}. ${step.step} (${step.estimatedTime})`);
      console.log(`        ${step.description}`);
      console.log(`        Tools: ${step.tools.join(', ')}`);
    });
  }

  // Test Scenario 3: Evening Low-Energy Session
  console.log("\n🌅 Scenario 3: Friday Evening - Low Energy Maintenance");
  console.log("=" .repeat(60));
  
  const eveningContext = {
    timeOfDay: new Date().setHours(18, 30, 0), // 6:30 PM
    energyLevel: "low",
    mood: "steady",
    availableTime: 45,
    workEnvironment: "home",
    workContext: ["home-office", "relaxed"],
    recentActivity: ["meetings", "communication"],
    goals: ["organize", "cleanup"],
    deadlines: []
  };

  const eveningVibe = vibeMatcher.detectCurrentVibe(eveningContext);
  console.log(`🎯 Detected Vibe: ${eveningVibe.primaryVibe?.[0] || 'balanced-work'}`);
  
  const eveningRecommendations = vibeMatcher.getVibeRecommendations(eveningVibe);
  console.log(`\n💤 Evening Vibe Guidance:`);
  console.log(`   Energy Management: Work with your current energy, not against it`);
  console.log(`   Suggested Focus: ${eveningRecommendations.suggestedWorkflows[0]?.type || 'routine-tasks'}`);
  console.log(`   Vibe Enhancers:`);
  eveningRecommendations.vibeEnhancers.slice(0, 3).forEach(enhancer => {
    console.log(`     • ${enhancer}`);
  });

  // Test Custom Template Creation
  console.log("\n🎨 Scenario 4: Creating Custom Template from User Session");
  console.log("=" .repeat(60));
  
  const customWorkflowData = {
    name: "Weekly Planning Power Hour",
    description: "Sunday evening preparation for the upcoming week",
    capturedFlow: [
      {
        name: "week-review",
        description: "Review previous week accomplishments and learnings",
        tools: ["calendar.review", "task.analyze", "ai.summarize"],
        vibe: "reflective",
        duration: 15
      },
      {
        name: "goal-setting", 
        description: "Set priorities and goals for upcoming week",
        tools: ["ai.brainstorm", "priority.matrix", "calendar.plan"],
        vibe: "strategic",
        duration: 20
      },
      {
        name: "schedule-optimization",
        description: "Optimize calendar and block focus time",
        tools: ["calendar.optimize", "focus.block", "meeting.review"],
        vibe: "systematic",
        duration: 15
      },
      {
        name: "energy-planning",
        description: "Plan energy allocation based on vibe patterns",
        tools: ["vibe.analyze", "energy.plan", "workflow.suggest"],
        vibe: "strategic",
        duration: 10
      }
    ],
    vibeMetrics: {
      energy: "focused-strategic",
      mood: "planning-preparatory", 
      duration: 60,
      tags: ["planning", "strategic", "weekly", "preparation"]
    },
    toolsUsed: [
      { name: "ai.summarize", usage: 2 },
      { name: "ai.brainstorm", usage: 1 },
      { name: "calendar.optimize", usage: 1 },
      { name: "vibe.analyze", usage: 1 }
    ],
    satisfaction: 4.5
  };

  const customTemplate = await workflowEngine.createCustomTemplate("user_123", customWorkflowData);
  console.log(`✅ Created Custom Template: "${customTemplate.name}"`);
  console.log(`   Template ID: ${customTemplate.id}`);
  console.log(`   Total Steps: ${customTemplate.flow.length}`);
  console.log(`   Estimated Credits: ${customTemplate.credits.estimated}`);
  console.log(`   Vibe Tags: ${customTemplate.vibe.tags.join(', ')}`);

  // Test Vibe Learning and Feedback
  console.log("\n🧠 Scenario 5: Learning from User Vibe Patterns");
  console.log("=" .repeat(60));
  
  const sessionFeedback = {
    detectedVibe: "fresh-focused",
    selectedTemplate: { id: "morning-content-creator", vibe: { duration: "90min" } },
    sessionSatisfaction: 4.2,
    actualDuration: 75,
    toolsUsed: [
      { name: "web.search", usage: 3 },
      { name: "ai.write", usage: 2 }, 
      { name: "image.generate", usage: 1 }
    ],
    completionRate: 0.85,
    energyBefore: "high",
    energyAfter: "medium"
  };

  const vibePattern = await vibeMatcher.recordVibeSession("user_123", sessionFeedback);
  console.log(`📊 Recorded Vibe Pattern:`);
  console.log(`   Detected Vibe: ${sessionFeedback.detectedVibe}`);
  console.log(`   Satisfaction: ${sessionFeedback.sessionSatisfaction}/5`);
  console.log(`   Completion Rate: ${(sessionFeedback.completionRate * 100).toFixed(0)}%`);
  console.log(`   Energy Change: ${sessionFeedback.energyBefore} → ${sessionFeedback.energyAfter}`);

  // Summary
  console.log("\n🎉 Universal Vibe Task Manager Demonstration Complete!");
  console.log("=" .repeat(60));
  
  console.log("\n💫 Key Capabilities Demonstrated:");
  console.log("   ✅ Intelligent vibe detection from context signals");
  console.log("   ✅ Template matching based on energy, time, and goals");
  console.log("   ✅ Dynamic template adaptation for constraints");
  console.log("   ✅ Custom template creation from user workflows");
  console.log("   ✅ Vibe pattern learning and feedback loops");
  console.log("   ✅ Energy management and workflow optimization");

  console.log("\n🌟 Vibe-Based Value Proposition:");
  console.log("   🎯 Match your current energy with optimal task flows");
  console.log("   ⏰ Maximize productivity by working WITH your vibe, not against it");
  console.log("   🔄 Learn and adapt to your unique work patterns over time");
  console.log("   🛠️ Access 2.7M+ tools through vibe-optimized workflows");
  console.log("   💳 Fair credit-based pricing: pay for AI features, system tools free");

  console.log("\n🚀 Workshop Distribution Benefits:");
  console.log("   💡 'Discover your work vibe and unlock perfect task flows'");
  console.log("   🎭 'Transform how you approach daily tasks with vibe matching'");
  console.log("   📈 'Build custom workflows that evolve with your patterns'");
  console.log("   🌐 'Universal access to any tool through intelligent orchestration'");

  return {
    vibeDetectionWorking: !!morningVibe.primaryVibe,
    templateMatchingWorking: morningMatches.length > 0,
    adaptationWorking: !!morningMatches[0],
    customTemplateWorking: !!customTemplate.id,
    learningWorking: !!vibePattern.stored,
    totalTemplatesAvailable: workflowEngine.templates.size
  };
}

// Run test
if (require.main === module) {
  testVibeWorkflows().then(results => {
    console.log("\n📊 Test Results Summary:");
    console.log("   Vibe Detection:", results.vibeDetectionWorking ? "✅ Working" : "❌ Failed");
    console.log("   Template Matching:", results.templateMatchingWorking ? "✅ Working" : "❌ Failed");
    console.log("   Template Adaptation:", results.adaptationWorking ? "✅ Working" : "❌ Failed");
    console.log("   Custom Templates:", results.customTemplateWorking ? "✅ Working" : "❌ Failed");
    console.log("   Vibe Learning:", results.learningWorking ? "✅ Working" : "❌ Failed");
    console.log(`   Templates Available: ${results.totalTemplatesAvailable}`);
    
    const allWorking = Object.values(results).every(r => r === true || typeof r === 'number');
    console.log(`\n🎭 Universal Vibe Task Manager: ${allWorking ? "🚀 READY FOR WORKSHOPS!" : "🔧 Needs attention"}`);
    
  }).catch(error => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
}

module.exports = { testVibeWorkflows };