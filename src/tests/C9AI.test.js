const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const C9AI = require('../core/C9AICore');
const configManager = require('../utils/config');
const knowledgeBase = require('../utils/knowledgeBase');
const { handleCommand } = require('../handlers/commandHandler');

// Mock the command handler
jest.mock('../handlers/commandHandler', () => ({
  handleCommand: jest.fn().mockImplementation((c9ai, input) => {
    if (input.startsWith('todos')) return 'Todo command handled';
    if (input.startsWith('!')) return 'Shell command executed';
    return 'Command handled';
  })
}));

describe('C9AI Core', () => {
  let c9ai;
  const mockConfigDir = '/mock/.c9ai';
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Override os.homedir() for consistent testing
    jest.spyOn(os, 'homedir').mockReturnValue('/mock');
    
    // Create new instance
    c9ai = new C9AI();
    
    // Don't auto-init in constructor
    c9ai.initialized = false;
    
    // Override paths
    c9ai.configDir = mockConfigDir;
    c9ai.scriptsDir = path.join(mockConfigDir, 'scripts');
    c9ai.modelsDir = path.join(mockConfigDir, 'models');
    
    // Now initialize
    await c9ai.init();
  });

  describe('Basic Setup', () => {
    test('has default configuration', () => {
      expect(c9ai.currentModel).toBe('claude');
      expect(c9ai.initialized).toBeTruthy();
    });
  });

  describe('Command Handling', () => {
    test('handles todo command', async () => {
      const result = await c9ai.handleCommand('todos list');
      expect(result).toBe('Todo command handled');
      expect(handleCommand).toHaveBeenCalledWith(c9ai, 'todos list');
    });

    test('handles shell command', async () => {
      const result = await c9ai.handleCommand('!ls');
      expect(result).toBe('Shell command executed');
      expect(handleCommand).toHaveBeenCalledWith(c9ai, '!ls');
    });

    test('handles other commands', async () => {
      const result = await c9ai.handleCommand('hello');
      expect(result).toBe('Command handled');
      expect(handleCommand).toHaveBeenCalledWith(c9ai, 'hello');
    });
  });

  describe('Initialization', () => {
    test('loads configuration and knowledge base', async () => {
      expect(configManager.load).toHaveBeenCalled();
      expect(knowledgeBase.load).toHaveBeenCalled();
    });

    test('creates required directories', async () => {
      expect(fs.ensureDir).toHaveBeenCalledWith(mockConfigDir);
      expect(fs.ensureDir).toHaveBeenCalledWith(path.join(mockConfigDir, 'scripts'));
      expect(fs.ensureDir).toHaveBeenCalledWith(path.join(mockConfigDir, 'models'));
      expect(fs.ensureDir).toHaveBeenCalledWith(path.join(mockConfigDir, 'logs'));
    });

    test('initializes only once', async () => {
      const previousCallCount = fs.ensureDir.mock.calls.length;
      await c9ai.init();
      expect(fs.ensureDir.mock.calls.length).toBe(previousCallCount);
    });
  });
});