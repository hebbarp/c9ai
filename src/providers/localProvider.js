"use strict";
const { runLocalAI } = require('../models/localModel');

/**
 * Provider adapter for local LLM (Gemma via node-llama-cpp)
 * Optimized for agentic tool-use with grammar constraints
 */
class LocalProvider {
    constructor(c9ai) {
        this.c9ai = c9ai;
        this.defaultModel = c9ai.localModel?.modelFile || 'local';
        this.supportsGrammar = false; // Disable grammar constraints for node-llama-cpp (compatibility issues)
    }

    async call(options) {
        const { messages, temperature = 0.7, max_tokens = 512, grammar, top_p = 1 } = options;
        
        if (!this.c9ai.localModel) {
            throw new Error('Local model not initialized. Please run "switch local" first.');
        }

        // Convert messages to optimized prompt format for tool-use
        const systemMsg = messages.find(m => m.role === 'system');
        const userMsgs = messages.filter(m => m.role === 'user');
        const assistantMsgs = messages.filter(m => m.role === 'assistant');
        
        let prompt = '';
        if (systemMsg) {
            prompt += `<system>\n${systemMsg.content}\n</system>\n\n`;
        }
        
        // Interleave user/assistant messages
        const conversation = [];
        for (let i = 0; i < Math.max(userMsgs.length, assistantMsgs.length); i++) {
            if (userMsgs[i]) conversation.push(`<user>\n${userMsgs[i].content}\n</user>`);
            if (assistantMsgs[i]) conversation.push(`<assistant>\n${assistantMsgs[i].content}\n</assistant>`);
        }
        
        prompt += conversation.join('\n\n');
        prompt += '\n\n<assistant>\n';

        try {
            // Try to use grammar constraints if provided, but fall back gracefully
            let response;
            if (grammar) {
                try {
                    // Attempt to use grammar constraints - this might not work with all node-llama-cpp versions
                    response = await this.c9ai.localModel.session.prompt(prompt, {
                        grammar: grammar,
                        temperature: temperature,
                        maxTokens: max_tokens,
                        topP: top_p
                    });
                } catch (grammarError) {
                    console.log(`⚠️  Grammar constraints not supported: ${grammarError.message}`);
                    // Fall back to regular generation without grammar
                    response = await runLocalAI(this.c9ai.localModel, prompt);
                }
            } else {
                // Fallback to existing runLocalAI
                response = await runLocalAI(this.c9ai.localModel, prompt);
            }
            
            // Clean up the response (remove assistant tags if present)
            const cleaned = response.replace(/^<assistant>\s*/, '').replace(/\s*<\/assistant>$/, '');
            
            return { text: cleaned.trim() };
        } catch (error) {
            console.error(`🚨 LocalProvider error details:`, error);
            throw new Error(`Local model error: ${error.message}`);
        }
    }
}

module.exports = { LocalProvider };