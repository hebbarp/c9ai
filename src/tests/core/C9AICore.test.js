const C9AI = require('../../core/C9AICore');
const fs = require('fs-extra');

describe('C9AICore', () => {
  let c9ai;

  beforeEach(async () => {
    c9ai = new C9AI();
    c9ai.configDir = global.TEST_CONFIG_DIR;
    await c9ai.init();
  });

  describe('initialization', () => {
    test('creates required directories', async () => {
      expect(fs.ensureDir).toHaveBeenCalledWith(global.TEST_CONFIG_DIR);
      expect(fs.ensureDir).toHaveBeenCalledWith(global.TEST_SCRIPTS_DIR);
      expect(fs.ensureDir).toHaveBeenCalledWith(global.TEST_MODELS_DIR);
    });

    test('loads configuration', async () => {
      expect(fs.readJson).toHaveBeenCalled();
    });
  });

  describe('command handling', () => {
    test('handles todo commands', async () => {
      const result = await c9ai.handleCommand('todos list');
      expect(result).toBeDefined();
    });

    test('handles model commands', async () => {
      const result = await c9ai.handleCommand('models list');
      expect(result).toBeDefined();
    });

    test('handles tool commands', async () => {
      const result = await c9ai.handleCommand('tools list');
      expect(result).toBeDefined();
    });

    test('handles shell commands', async () => {
      const result = await c9ai.handleCommand('!ls');
      expect(result).toBeDefined();
    });
  });
});