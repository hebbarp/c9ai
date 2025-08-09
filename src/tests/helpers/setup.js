const fs = require('fs-extra');
const path = require('path');

// Mock fs-extra globally
jest.mock('fs-extra');

// Mock config manager
jest.mock('../../utils/config', () => ({
    load: jest.fn().mockResolvedValue({}),
    save: jest.fn().mockResolvedValue(undefined)
}));

// Mock knowledge base
jest.mock('../../utils/knowledgeBase', () => ({
    load: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    addTopic: jest.fn(),
    getTopic: jest.fn()
}));

// Reset all mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default fs-extra mocks
    fs.exists.mockResolvedValue(true);
    fs.readJson.mockResolvedValue({});
    fs.writeJson.mockResolvedValue(undefined);
    fs.ensureDir.mockResolvedValue(undefined);
});

// Global test constants
global.TEST_CONFIG_DIR = '/mock/.c9ai';
global.TEST_SCRIPTS_DIR = path.join(global.TEST_CONFIG_DIR, 'scripts');
global.TEST_MODELS_DIR = path.join(global.TEST_CONFIG_DIR, 'models');