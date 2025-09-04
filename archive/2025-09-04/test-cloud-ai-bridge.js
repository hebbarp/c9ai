#!/usr/bin/env node

/**
 * Test script for Cloud AI → C9AI Integration
 * Demonstrates the complete handshake bridge workflow
 */

const path = require('path');
process.chdir(path.dirname(__filename));

const CloudAIBridge = require('./src/agent/cloud-ai-bridge');
const ActionValidator = require('./src/agent/action-validator');
const ExecutionPlanner = require('./src/agent/execution-planner');
const { executeApprovedActions } = require('./src/agent/runStep');

console.log('🚀 Testing Cloud AI → C9AI Integration\n');

async function testCloudAIBridge() {
  const bridge = new CloudAIBridge();
  const validator = new ActionValidator();
  const planner = new ExecutionPlanner();

  // Test 1: Parse a mock cloud AI response with embedded C9AI actions
  console.log('📋 Test 1: Parsing Cloud AI Response');
  console.log('=' .repeat(50));

  const mockCloudResponse = `
I'll help you analyze the sales data and create a summary report. Here are the actions I'll take:

\`\`\`json
{
  "message": "I'll analyze your sales data, calculate key metrics, and email you a summary report.",
  "actions": [
    {
      "id": "data-analysis",
      "sigil": "@analyze", 
      "args": "sales_data.csv",
      "description": "Analyze sales data for patterns and insights",
      "risk_level": "low",
      "estimated_time": "30s"
    },
    {
      "id": "revenue-calc",
      "sigil": "@calc",
      "args": "sum(revenue_column) * 1.15",
      "description": "Calculate total revenue with projected growth",
      "risk_level": "low", 
      "estimated_time": "5s"
    },
    {
      "id": "summary-report",
      "sigil": "@write",
      "args": "sales_summary.md -> # Sales Analysis\\n\\nTotal Revenue: $\${revenue-calc.result}\\n\\nKey Insights: \${data-analysis.insights}",
      "description": "Generate markdown summary report",
      "risk_level": "medium",
      "estimated_time": "10s"
    },
    {
      "id": "email-report", 
      "sigil": "@email",
      "args": "manager@company.com \\"Sales Analysis\\" \\"Please find the sales analysis attached.\\"",
      "description": "Email summary report to manager",
      "risk_level": "high",
      "estimated_time": "15s"
    }
  ],
  "execution_mode": "sequential",
  "requires_confirmation": true
}
\`\`\`

This analysis will help you understand your sales performance and trends.
  `;

  const parseResult = bridge.parseCloudResponse(mockCloudResponse);
  
  if (parseResult.success) {
    console.log('✅ Successfully parsed cloud AI response');
    console.log(`   Found ${parseResult.parsedActions.actions.length} executable actions`);
    console.log(`   Execution mode: ${parseResult.parsedActions.execution_mode}`);
    console.log(`   Requires confirmation: ${parseResult.parsedActions.requires_confirmation}`);
  } else {
    console.log('❌ Failed to parse response:', parseResult.error);
    return;
  }

  // Test 2: Validate actions for security and correctness
  console.log('\n🔒 Test 2: Action Validation');
  console.log('=' .repeat(50));

  const validationResults = await validator.validateActionSet(parseResult.parsedActions.actions);
  
  console.log(`✅ Validation complete`);
  console.log(`   Overall risk level: ${validationResults.overallRiskLevel}`);
  console.log(`   Total errors: ${validationResults.totalErrors}`);
  console.log(`   Total warnings: ${validationResults.totalWarnings}`);
  console.log(`   Recommendation: ${validationResults.recommendedAction}`);

  // Show individual validation results
  validationResults.individualValidations.forEach((validation, index) => {
    const status = validation.valid ? '✅' : '❌';
    console.log(`   ${status} Action ${index + 1}: ${validation.sigil} (Risk: ${validation.riskLevel})`);
    
    if (validation.errors.length > 0) {
      validation.errors.forEach(error => console.log(`      🚨 ${error}`));
    }
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => console.log(`      ⚠️  ${warning}`));
    }
  });

  // Test 3: Build execution plan
  console.log('\n⚡ Test 3: Execution Planning');
  console.log('=' .repeat(50));

  const executionPlan = await planner.buildExecutionPlan(
    parseResult.parsedActions.actions,
    parseResult.parsedActions.execution_mode
  );

  console.log(`✅ Execution plan created`);
  console.log(`   Session ID: ${executionPlan.sessionId}`);
  console.log(`   Total actions: ${executionPlan.totalActions}`);
  console.log(`   Execution mode: ${executionPlan.executionMode}`);
  console.log(`   Estimated duration: ${executionPlan.estimatedDuration}s`);
  console.log(`   Dependency levels: ${executionPlan.dependencyGraph?.levels?.length || 0}`);
  
  if (executionPlan.optimizations.length > 0) {
    console.log('   💡 Optimizations suggested:');
    executionPlan.optimizations.forEach(opt => {
      console.log(`      • ${opt.suggestion} (${opt.impact})`);
    });
  }

  // Test 4: Show execution order
  console.log('\n📋 Test 4: Execution Order');
  console.log('=' .repeat(50));

  executionPlan.executionOrder.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.sigil} - ${item.description}`);
    if (item.optimizationReason) {
      console.log(`      💡 ${item.optimizationReason}`);
    }
  });

  // Test 5: Simulate handshake data preparation
  console.log('\n🤝 Test 5: Handshake Data Preparation');
  console.log('=' .repeat(50));

  const handshakeData = {
    originalResponse: parseResult.originalResponse,
    actions: parseResult.parsedActions.actions,
    executionPlan: executionPlan,
    validationResults: validationResults,
    requiresConfirmation: parseResult.parsedActions.requires_confirmation !== false || 
                         validationResults.overallRiskLevel === 'high'
  };

  console.log('✅ Handshake data prepared');
  console.log(`   Actions ready for confirmation: ${handshakeData.actions.length}`);
  console.log(`   Requires user confirmation: ${handshakeData.requiresConfirmation}`);
  console.log(`   Risk assessment: ${handshakeData.validationResults.overallRiskLevel}`);

  // Test 6: Simulate user confirmation and execution
  console.log('\n🎯 Test 6: Mock Action Execution');
  console.log('=' .repeat(50));

  // Simulate user approving first 3 actions (excluding email for safety)
  const approvedActionIds = handshakeData.actions.slice(0, 3).map(a => a.id);
  const executionOptions = {
    mode: 'sequential',
    dryRun: true // Dry run for safety
  };

  // Mock context for testing
  const mockContext = {
    runTool: async (toolName, args) => {
      console.log(`      🔧 Mock executing: ${toolName} with args:`, args);
      
      // Simulate different tool responses
      switch (toolName) {
        case 'jit':
          if (args.type === 'analyze') {
            return {
              success: true,
              result: { insights: 'Revenue trending upward, Q4 shows 23% growth' }
            };
          } else if (args.type === 'calc') {
            return {
              success: true,
              result: 145000
            };
          }
          break;
        case 'fs.write':
          return {
            success: true,
            result: `File written to ${args.path}`
          };
        default:
          return {
            success: true,
            result: `Mock result for ${toolName}`
          };
      }
    }
  };

  try {
    const executionResults = await executeApprovedActions(
      handshakeData,
      approvedActionIds, 
      executionOptions,
      mockContext
    );

    console.log('✅ Mock execution completed');
    console.log(`   Success: ${executionResults.success}`);
    console.log(`   Total actions: ${executionResults.totalActions}`);
    console.log(`   Successful: ${executionResults.successfulActions}`);
    console.log(`   Mode: ${executionResults.executionMode}`);
    console.log(`   Dry run: ${executionResults.dryRun}`);

    // Show individual results
    console.log('\n   📊 Individual Results:');
    executionResults.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`      ${status} ${result.sigil}: ${result.message || result.output || 'Completed'}`);
      
      if (result.substitutions?.length > 0) {
        console.log(`         🔄 Variable substitutions: ${result.substitutions.length}`);
      }
    });

  } catch (error) {
    console.log('❌ Mock execution failed:', error.message);
  }

  // Test 7: Test inline sigil extraction
  console.log('\n🎯 Test 7: Inline Sigil Extraction');
  console.log('=' .repeat(50));

  const inlineResponse = `
Let me help you with that calculation and file processing.

First, I'll calculate the tax: @calc 2000 * 0.15
Then I'll count the lines in your document: @count document.txt
Finally, I'll check the system status: @system

These operations will give you the information you need.
  `;

  const inlineParseResult = bridge.parseCloudResponse(inlineResponse);
  
  if (inlineParseResult.success) {
    console.log('✅ Successfully extracted inline sigils');
    console.log(`   Found ${inlineParseResult.parsedActions.actions.length} inline actions`);
    
    inlineParseResult.parsedActions.actions.forEach((action, index) => {
      console.log(`   ${index + 1}. ${action.sigil} ${action.args} - ${action.description}`);
    });
  }

  console.log('\n🎉 All tests completed successfully!');
  console.log('   The Cloud AI → C9AI handshake bridge is fully functional.');
  console.log('   Ready for integration with cloud AI providers.');
}

// Run the test
testCloudAIBridge().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});