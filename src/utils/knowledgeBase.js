const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const os = require('os');

class KnowledgeBase {
    constructor() {
        this.topics = {};
        this.fallbacks = {};
        this.configDir = path.join(os.homedir(), '.c9ai');
        this.dbPath = path.join(this.configDir, 'knowledge.json');
    }

    async load() {
        try {
            if (await fs.exists(this.dbPath)) {
                const data = await fs.readJson(this.dbPath);
                this.topics = data.topics || {};
                this.fallbacks = data.fallbacks || {};
            }
        } catch (error) {
            console.error(chalk.red('Error loading knowledge base:', error.message));
        }
    }

    async save() {
        try {
            await fs.writeJson(this.dbPath, {
                topics: this.topics,
                fallbacks: this.fallbacks,
                lastUpdated: new Date().toISOString()
            }, { spaces: 2 });
        } catch (error) {
            console.error(chalk.red('Error saving knowledge base:', error.message));
        }
    }

    addTopic(topic, content) {
        this.topics[topic] = {
            content,
            updatedAt: new Date().toISOString()
        };
    }

    getTopic(topic) {
        return this.topics[topic]?.content;
    }
}

module.exports = new KnowledgeBase();