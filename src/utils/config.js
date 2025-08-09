const fs = require('fs-extra');
const path = require('path');
const os = require('os');
require('dotenv').config();

class ConfigManager {
    constructor() {
        this.configDir = path.join(os.homedir(), '.c9ai');
        this.configPath = path.join(this.configDir, 'config.json');
        this.config = {};
    }

    async load() {
        try {
            if (await fs.exists(this.configPath)) {
                this.config = await fs.readJson(this.configPath);
            }
        } catch (error) {
            console.error('Error loading config:', error);
            this.config = {};
        }
    }

    async save() {
        try {
            await fs.writeJson(this.configPath, this.config, { spaces: 2 });
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    getClaudeApiKey() {
        return process.env.ANTHROPIC_API_KEY || this.config.anthropicApiKey;
    }

    getGeminiApiKey() {
        return process.env.GOOGLE_AI_API_KEY || this.config.googleAiApiKey;
    }

    setClaudeApiKey(apiKey) {
        this.config.anthropicApiKey = apiKey;
        return this.save();
    }

    setGeminiApiKey(apiKey) {
        this.config.googleAiApiKey = apiKey;
        return this.save();
    }

    hasClaudeApiKey() {
        return !!(process.env.ANTHROPIC_API_KEY || this.config.anthropicApiKey);
    }

    hasGeminiApiKey() {
        return !!(process.env.GOOGLE_AI_API_KEY || this.config.googleAiApiKey);
    }
}

module.exports = new ConfigManager();