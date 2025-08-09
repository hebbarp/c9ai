const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const Logger = require('../utils/logger');
const config = require('../utils/config');

class ModelHandler {
    constructor(c9ai, logger) {
        this.c9ai = c9ai;
        this.logger = logger || Logger;
        this.validModels = ['claude', 'gemini', 'local'];
    }

    // Handles sub-commands like "models list"
    async handle(args) {
        const [subCommand] = args;

        // If no subcommand is given, provide a usage hint.
        if (!subCommand) {
            return this.logger.warn("Usage: models <action>. Try 'models list'.");
        }

        switch (subCommand.toLowerCase()) {
            case 'list':
                return await this.listModels();
            case 'install':
                const modelName = args[1];
                if (!modelName) {
                    return this.logger.warn('Usage: models install <model-name>');
                }
                return await this.installModel(modelName);
            default:
                this.logger.warn(`Unknown models command: ${subCommand}. Try 'models list' or 'models install <model-name>'.`);
        }
    }

    async switchModel(modelName) {
        if (!modelName) {
            return this.logger.warn('Usage: switch <model_name>');
        }

        if (!this.validModels.includes(modelName.toLowerCase())) {
            return this.logger.error(`Invalid model: ${modelName}. Choose from: ${this.validModels.join(', ')}`);
        }

        this.c9ai.currentModel = modelName.toLowerCase();
        
        // Handle different model types
        switch (modelName.toLowerCase()) {
            case 'local':
                const { initLocalModel } = require('../models/localModel');
                console.log(chalk.yellow('Initializing local model...'));
                this.c9ai.localModel = await initLocalModel(this.c9ai.modelsDir);
                if (this.c9ai.localModel) {
                    console.log(chalk.green(`Local model ready: ${this.c9ai.localModel.modelFile}`));
                } else {
                    console.log(chalk.red('Failed to initialize local model'));
                    return;
                }
                break;
                
            case 'claude':
                if (!config.hasClaudeApiKey()) {
                    console.log(chalk.yellow('⚠️  No Claude API key found'));
                    console.log(chalk.gray('Set ANTHROPIC_API_KEY in .env or use: config set claude-api-key <key>'));
                    console.log(chalk.gray('Using demo responses until API key is configured'));
                }
                break;
                
            case 'gemini':
                if (!config.hasGeminiApiKey()) {
                    console.log(chalk.yellow('⚠️  No Gemini API key found'));
                    console.log(chalk.gray('Set GOOGLE_AI_API_KEY in .env or use: config set gemini-api-key <key>'));
                    console.log(chalk.gray('Using demo responses until API key is configured'));
                }
                break;
        }
        
        this.logger.info(`Switched to ${this.c9ai.currentModel} model.`);
    }

    async listModels() {
        // Show basic models first
        console.log(chalk.cyan('\n🤖 C9AI Models'));
        console.log(chalk.gray('='.repeat(30)));
        
        this.validModels.forEach(model => {
            const isCurrent = this.c9ai.currentModel === model ? chalk.green(' (current)') : '';
            console.log(`${chalk.white('  • ' + model)}${isCurrent}`);
        });

        // Show detailed local model information
        await this.listLocalModels();
    }

    async listLocalModels() {
        console.log(chalk.cyan('\n🛠️ Local AI Models (GGUF)'));
        console.log(chalk.gray('='.repeat(40)));

        const availableModels = {
            'phi-3': {
                name: 'Phi-3-mini',
                size: '2.2GB',
                description: 'Microsoft Phi-3 Mini - Fast, efficient, good reasoning',
                filename: 'phi-3-mini-4k-instruct-q4.gguf'
            },
            'gemma2': {
                name: 'Gemma-2-2B',
                size: '1.6GB',
                description: 'Google Gemma 2 2B - Lightweight, efficient instruction-tuned model',
                filename: 'gemma-2-2b-it-Q4_K_M.gguf'
            },
            'tinyllama': {
                name: 'TinyLlama-1.1B',
                size: '680MB',
                description: 'TinyLlama 1.1B - Ultra lightweight for testing',
                filename: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf'
            },
            'llama2': {
                name: 'Llama-2-7B-Chat',
                size: '3.9GB',
                description: 'Meta Llama 2 7B - Powerful conversational model',
                filename: 'llama-2-7b-chat.q4_0.bin'
            },
            'gpt-oss-20b': {
                name: 'GPT-OSS-20B',
                size: '11.7GB',
                description: 'OpenAI GPT OSS 20B - Advanced reasoning, runs on 16GB+ RAM',
                filename: 'openai_gpt-oss-20b-Q4_K_M.gguf'
            }
        };

        try {
            // Check what's installed in the models directory
            const installedFiles = await fs.readdir(this.c9ai.modelsDir).catch(() => []);
            
            console.log(chalk.green('\n📦 Installed Models:'));
            if (installedFiles.length === 0) {
                console.log(chalk.gray('  None installed yet'));
            } else {
                for (const file of installedFiles) {
                    if (file.endsWith('.gguf') || file.endsWith('.bin')) {
                        const stats = await fs.stat(path.join(this.c9ai.modelsDir, file));
                        const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
                        console.log(chalk.white(`  ✅ ${file} (${sizeMB} MB)`));
                    }
                }
            }

            console.log(chalk.yellow('\n🌐 Available for Download:'));
            for (const [key, model] of Object.entries(availableModels)) {
                const isInstalled = installedFiles.some(f => 
                    f.includes(model.filename.split('.')[0]) || 
                    f === model.filename
                );
                const status = isInstalled ? chalk.green('✅ Installed') : chalk.gray('⬇️  Available');
                console.log(chalk.white(`  ${key.padEnd(12)} - ${model.name} (${model.size}) ${status}`));
                console.log(chalk.gray(`                   ${model.description}`));
            }

            console.log(chalk.cyan('\n💡 Usage: models install <model-name>'));
            console.log(chalk.gray('         switch local  (to use local models)'));
        } catch (error) {
            this.logger.error('Error listing local models:', error.message);
        }
    }

    async installModel(modelName) {
        const models = {
            'phi-3': {
                url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
                filename: 'phi-3-mini-4k-instruct-q4.gguf',
                size: '2.2GB'
            },
            'gemma2': {
                url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
                filename: 'gemma-2-2b-it-Q4_K_M.gguf',
                size: '1.6GB'
            },
            'tinyllama': {
                url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
                filename: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
                size: '680MB'
            },
            'llama2': {
                url: 'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGML/resolve/main/llama-2-7b-chat.q4_0.bin',
                filename: 'llama-2-7b-chat.q4_0.bin',
                size: '3.9GB'
            },
            'gpt-oss-20b': {
                url: 'https://huggingface.co/bartowski/openai_gpt-oss-20b-GGUF/resolve/main/openai_gpt-oss-20b-Q4_K_M.gguf',
                filename: 'openai_gpt-oss-20b-Q4_K_M.gguf',
                size: '11.7GB'
            }
        };

        const model = models[modelName.toLowerCase()];
        if (!model) {
            console.log(chalk.red(`❌ Unknown model: ${modelName}`));
            console.log(chalk.gray('Available models: ' + Object.keys(models).join(', ')));
            return;
        }

        const filePath = path.join(this.c9ai.modelsDir, model.filename);
        
        // Check if already installed
        if (await fs.pathExists(filePath)) {
            console.log(chalk.yellow(`⚠️  ${model.filename} is already installed`));
            return;
        }

        console.log(chalk.cyan(`🚀 Installing ${modelName} (${model.size})...`));
        console.log(chalk.gray(`📥 Downloading from: ${model.url}`));
        console.log(chalk.gray(`📁 Installing to: ${filePath}`));
        console.log(chalk.yellow(`⚠️  This is a placeholder - actual download functionality needs to be implemented`));
        console.log(chalk.gray(`💡 You can manually download the model and place it in: ${this.c9ai.modelsDir}`));
    }
}

module.exports = ModelHandler;