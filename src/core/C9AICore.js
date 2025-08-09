const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const { handleCommand } = require('../handlers/commandHandler');
const configManager = require('../utils/config');
const knowledgeBase = require('../utils/knowledgeBase');
const ModelHandler = require('../handlers/modelHandler');
const Logger = require('../utils/logger');
const { agentStep } = require('../agent/runStep');
const { makeSynthesizer } = require('../agent/synthesize');
const { runTool } = require('../tools/runner');
const { LocalProvider } = require('../providers/localProvider');

class C9AI {
    constructor() {
        this.configDir = path.join(os.homedir(), '.c9ai');
        this.scriptsDir = path.join(this.configDir, 'scripts');
        this.modelsDir = path.join(this.configDir, 'models');
        this.initialized = false;
        this.currentModel = 'claude'; // Always set a default model
        
        // Initialize handlers and utilities
        this.logger = Logger;
        this.modelHandler = new ModelHandler(this, this.logger);
        this.config = {};
    }

    async init() {
        if (this.initialized) {
            return;
        }
        
        try {
            await fs.ensureDir(this.configDir);
            await fs.ensureDir(this.scriptsDir);
            await fs.ensureDir(this.modelsDir);
            await fs.ensureDir(path.join(this.configDir, 'logs'));

            // Load configuration and knowledge base
            await configManager.load();
            this.config = configManager.config;
            await knowledgeBase.load();
            
            this.initialized = true;
            this.logger.info('C9AI initialized successfully.');
        } catch (error) {
            this.logger.error('Failed to initialize C9AI:', error);
        }
    }

    async handleCommand(input) {
        // Pass the fully initialized `this` to the command handler
        return handleCommand(this, input);
    }

    /**
     * Direct agentic interaction for local models
     * This bypasses the conversation handler for tool-capable responses
     */
    async agenticResponse(userPrompt) {
        if (this.currentModel !== 'local' || !this.localModel) {
            throw new Error('Agentic responses only available for local models. Use "switch local" first.');
        }

        const localProvider = new LocalProvider(this);
        
        const response = await agentStep(localProvider, userPrompt, {
            allowedTools: ['shell.run', 'script.run', 'fs.read', 'fs.write'],
            confirmThreshold: 0.6,
            runTool: async (name, args) => {
                Logger.info(`🔧 Running tool: ${name}`);
                const result = await runTool(name, args);
                Logger.debug(`📋 Tool result: ${JSON.stringify(result).substring(0, 100)}...`);
                return result;
            },
            synthesize: makeSynthesizer(localProvider)
        });

        return response;
    }
}

module.exports = C9AI;