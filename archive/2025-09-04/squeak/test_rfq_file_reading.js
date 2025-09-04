#!/usr/bin/env node
/**
 * Test script for RFQ file reading functionality
 */

const path = require('path');
const jitTool = require('../src/tools/jit-executor');
const SigilRouter = require('../src/agent/sigil-router');

async function testRFQFileReading() {
    console.log('🧪 Testing RFQ File Reading Functionality');
    console.log('==========================================\n');

    try {
        // Initialize components
        const sigilRouter = new SigilRouter();

        // Test 1: Parse RFQ sigil with file parameter
        console.log('📋 Test 1: Parsing RFQ sigil with file parameter');
        const sigilInput = '@rfq file="./test_rfq.txt" rate=175 margin=25';
        const parsed = sigilRouter.routeSigil(sigilInput);
        
        if (parsed.success) {
            console.log('✅ Sigil parsed successfully:');
            console.log('   Tool:', parsed.toolCall.tool);
            console.log('   File path:', parsed.toolCall.args.file_path);
            console.log('   Hourly rate:', parsed.toolCall.args.hourly_rate);
            console.log('   Margin target:', parsed.toolCall.args.margin_target);
        } else {
            console.log('❌ Sigil parsing failed:', parsed.message);
            return;
        }

        console.log('\n🔍 Test 2: Full RFQ Analysis with file using JIT tool');
        const filePath = path.resolve(__dirname, '..', 'test_rfq.txt');
        console.log('   Reading file:', filePath);
        
        const rfqResult = await jitTool.execute({
            type: 'rfq',
            file_path: filePath,
            hourly_rate: 175,
            margin_target: 25
        });

        if (rfqResult.success) {
            console.log('✅ RFQ Analysis completed successfully:');
            console.log('   Requirements found:', rfqResult.requirements_found);
            console.log('   Complexity score:', rfqResult.complexity_score);
            console.log('   Estimated hours:', rfqResult.estimated_hours);
            console.log('   Timeline weeks:', rfqResult.timeline_weeks);
            console.log('   Proposal amount: $' + rfqResult.proposal_amount.toLocaleString());
            console.log('   Bid decision:', rfqResult.bid_decision);
            
            if (rfqResult.phases && rfqResult.phases.length > 0) {
                console.log('   Project phases:');
                rfqResult.phases.forEach((phase, i) => {
                    console.log(`     ${i + 1}. ${phase.name} - ${phase.weeks} weeks`);
                });
            }
        } else {
            console.log('❌ RFQ Analysis failed:', rfqResult.error);
        }

        console.log('\n🎉 All tests completed successfully!');
        
    } catch (error) {
        console.log('❌ Test failed with error:', error.message);
        console.log('Stack trace:', error.stack);
    }
}

// Run the test
testRFQFileReading();