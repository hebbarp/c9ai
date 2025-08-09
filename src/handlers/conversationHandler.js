const ora = require('ora');
const chalk = require('chalk');
const Logger = require('../utils/logger');
const { initLocalModel, runLocalAI } = require('../models/localModel');

async function handleConversation(c9ai, input) {
    const model = c9ai.currentModel || 'claude'; // Default if not set
    console.log(chalk.yellow(`Thinking with ${model}...`));

    try {
        // Handle local model specifically
        if (model === 'local') {
            return await handleLocalModel(c9ai, input);
        }

        // Basic math evaluation for simple expressions
        if (/^[\d\+\-\*\/\(\)\s]+$/.test(input)) {
            try {
                const result = eval(input);
                const response = `(${model}): ${input} = ${result}`;
                console.log(chalk.green('✔ AI response:'));
                console.log(chalk.cyanBright(response));
                return response;
            } catch {
                // Fall through to default response
            }
        }
        
        // Default conversational response for non-local models
        const response = `(${model}): I understand you said "${input}". This is a demo response.`;
        console.log(chalk.green('✔ AI response:'));
        console.log(chalk.cyanBright(response));
        return response;
    } catch (error) {
        console.log(chalk.red('✖ Failed to get response.'));
        Logger.error(error.message);
        throw error;
    }
}

async function handleLocalModel(c9ai, input) {
    try {
        // Check if local model is initialized
        if (!c9ai.localModel) {
            throw new Error('Local model not initialized. Please run "switch local" first.');
        }

        const modelName = c9ai.localModel.modelFile.replace('.gguf', '').replace('.bin', '');
        
        // Use the core's agentic response method
        const response = await c9ai.agenticResponse(input);

        console.log(chalk.green('✔ AI response:'));
        console.log(chalk.cyanBright(`(${modelName}): ${response}`));
        return `(${modelName}): ${response}`;
    } catch (error) {
        Logger.error('Local model error:', error.message);
        console.log(chalk.red('✖ Local model failed, using fallback response'));
        const fallback = `(local-fallback): I understand you said "${input}". Local model is currently unavailable.`;
        console.log(chalk.cyanBright(fallback));
        return fallback;
    }
}

module.exports = { handleConversation };