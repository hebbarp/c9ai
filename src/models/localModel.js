const path = require('path');
const Logger = require('../utils/logger');

// These will be populated by the async import
let LlamaModel, LlamaContext, LlamaChatSession;

// Asynchronously load the ESM-only node-llama-cpp module
async function loadLlamaCpp() {
    // Only load it once
    if (LlamaModel) return true;

    try {
        const llamaCpp = await import('node-llama-cpp');
        LlamaModel = llamaCpp.LlamaModel;
        LlamaContext = llamaCpp.LlamaContext;
        LlamaChatSession = llamaCpp.LlamaChatSession;
        return true;
    } catch (error) {
        Logger.warn('Could not load node-llama-cpp. Local model functionality will be disabled.');
        Logger.error(error.message);
        return false;
    }
}

async function initLocalModel(modelsDir) {
    const isLoaded = await loadLlamaCpp();
    if (!isLoaded) {
        throw new Error("Local model support is not available. Please check for installation errors.");
    }

    try {
        // Find the first available GGUF or BIN model file
        const fs = require('fs-extra');
        const files = await fs.readdir(modelsDir);
        const modelFile = files.find(f => f.endsWith('.gguf') || f.endsWith('.bin'));
        
        if (!modelFile) {
            throw new Error(`No GGUF or BIN model files found in ${modelsDir}`);
        }

        const modelPath = path.join(modelsDir, modelFile);
        Logger.info(`Loading local model: ${modelFile}`);
        
        const model = new LlamaModel({
            modelPath,
            contextSize: 2048,
            batchSize: 512,
            logLevel: 'warn' // Suppress verbose loading output
        });
        const context = new LlamaContext({ model });
        const session = new LlamaChatSession({ context });
        return { model, context, session, modelFile };
    } catch (error) {
        Logger.error('Failed to initialize local model:', error);
        return null;
    }
}

async function runLocalAI(model, prompt, retryCount = 0) {
    if (!model || !model.session) {
        throw new Error("Local model is not properly initialized.");
    }
    try {
        const response = await model.session.prompt(prompt);
        return response.trim();
    } catch (error) {
        if (retryCount < 3) {
            return runLocalAI(model, prompt, retryCount + 1);
        }
        throw error;
    }
}

module.exports = {
    initLocalModel,
    runLocalAI,
    loadLlamaCpp // Export for pre-loading if needed
};