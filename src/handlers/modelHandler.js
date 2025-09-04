const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const Logger = require('../utils/logger');
const config = require('../utils/config');
const { ensureLocalStack } = require('../utils/llamacpp');

function findLocalModels() {
  const home = require('os').homedir();
  const roots = [
    path.join(home, '.c9ai', 'models'),
    path.join(process.cwd(), 'models'),
    process.cwd()
  ];
  const out = [];
  for (const dir of roots) {
    try {
      for (const e of fs.readdirSync(dir)) {
        if (e.toLowerCase().endsWith('.gguf')) out.push(path.join(dir, e));
      }
    } catch {}
  }
  return out;
}

class ModelHandler {
  constructor(c9ai, logger = Logger) {
    this.c9ai = c9ai;
    this.logger = logger;
    this.validModels = ['claude', 'gemini', 'local'];
  }

  async handle(args) {
    const [sub, ...rest] = args || [];
    if (!sub) return this.logger.warn("Usage: models <action>. Try 'models list'.");

    switch ((sub || '').toLowerCase()) {
      case 'list':
        return this.listModels();
      case 'use-local': {
        const hint = rest.join(' ').trim();
        return this.setLocalModel(hint);
      }
      case 'list-local': {
        const models = findLocalModels();
        if (models.length === 0) return this.logger.warn('No .gguf models found in ~/.c9ai/models, ./models or CWD.');
        console.log('Local .gguf models:');
        for (const m of models) console.log(`- ${m}`);
        return;
      }
      default:
        return this.logger.warn(`Unknown models command: ${sub}. Try 'models list', 'models list-local', or 'models use-local <path-or-name-substring>'.`);
    }
  }

  async switchModel(modelName) {
    const next = (modelName || '').toLowerCase();
    if (!this.validModels.includes(next)) {
      return this.logger.error(`Invalid model: ${modelName}. Choose from: ${this.validModels.join(', ')}`);
    }

    this.c9ai.currentModel = next;
    this.logger.info(`Switched to ${next} model.`);

    // persist
    try {
      await config.load();
      config.set ? config.set('currentModel', next) : (config.config.currentModel = next);
      if (config.save) await config.save();
    } catch (e) {
      this.logger.warn(`Could not persist model: ${e.message}`);
    }

    if (next === 'local') {
      try {
        const { baseUrl, started } = await ensureLocalStack({
          modelPath: this.c9ai.localModelPath // pass preferred phi-3 if set
        });
        this.c9ai.llamacppBaseUrl = baseUrl;
        this.logger.info(started ? `Started llama.cpp at ${baseUrl}` : `Using llama.cpp at ${baseUrl}`);
      } catch (e) {
        this.logger.warn(`Could not verify local stack: ${e.message}`);
      }
    }
  }

  async setLocalModel(hint) {
    const models = findLocalModels();
    if (models.length === 0) return this.logger.warn('No .gguf models found.');
    if (!hint) {
      this.logger.info('Usage: models use-local <path-or-name-substring>');
      this.logger.info('Examples:\n  models use-local phi-3\n  models use-local /Users/me/.c9ai/models/phi-3-mini.gguf');
      return;
    }

    // exact path or substring match
    let chosen = null;
    if (fs.existsSync(hint) && hint.toLowerCase().endsWith('.gguf')) {
      chosen = path.resolve(hint);
    } else {
      const lc = hint.toLowerCase();
      chosen = models.find(p => path.basename(p).toLowerCase().includes(lc)) || null;
    }

    if (!chosen) return this.logger.error(`No matching .gguf for "${hint}"`);

    this.c9ai.localModelPath = chosen;
    this.logger.success(`Set local model: ${chosen}`);

    // persist
    try {
      await config.load();
      config.set ? config.set('localModelPath', chosen) : (config.config.localModelPath = chosen);
      if (config.save) await config.save();
    } catch (e) {
      this.logger.warn(`Could not persist local model path: ${e.message}`);
    }
  }

  listModels() {
    this.logger.info('Available models:');
    for (const m of this.validModels) {
      const tag = this.c9ai.currentModel === m ? ' (current)' : '';
      console.log(`- ${m}${tag}`);
    }
  }
}

module.exports = ModelHandler;