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
const { getLocalProvider } = require('../providers');

class C9AI {
  constructor() {
    this.configDir = path.join(os.homedir(), '.c9ai');
    this.scriptsDir = path.join(this.configDir, 'scripts');
    this.modelsDir = path.join(this.configDir, 'models');
    this.initialized = false;
    this.currentModel = undefined;        // do not hard-default here
    this.localModelPath = undefined;      // persisted path to .gguf if set
    
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
      this.config = configManager.config || {};
      // Load persisted selections with sensible fallback
      this.currentModel = this.config.currentModel || this.currentModel || 'claude';
      this.localModelPath = this.config.localModelPath || this.localModelPath;

      this.initialized = true;
      this.logger.info('C9AI initialized successfully.');
    } catch (error) {
      this.logger.error('Failed to initialize C9AI:', error);
    }
  }

  async handleCommand(input) {
    return handleCommand(this, input);
  }
}

module.exports = C9AI;