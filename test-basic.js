#!/usr/bin/env node

// Quick test script for c9ai basic functionality
const C9AI = require('./src/c9ai-core');

async function test() {
    console.log('🧪 Testing C9 AI Core...\n');
    
    const c9ai = new C9AI();
    
    // Test configuration
    console.log('✅ Testing config...');
    await c9ai.showConfig();
    
    console.log('\n✅ Testing tools registry...');
    await c9ai.listTools();
    
    console.log('\n✅ Testing analytics...');
    await c9ai.showAnalytics();
    
    console.log('\n✅ Testing todos list...');
    await c9ai.handleTodos('list');
    
    console.log('\n🎉 Basic tests completed!');
    console.log('\n💡 To test AI integration, run:');
    console.log('   node src/index.js claude "hello world"');
    console.log('   node src/index.js switch gemini');
    console.log('   node src/index.js interactive');
}

test().catch(console.error);