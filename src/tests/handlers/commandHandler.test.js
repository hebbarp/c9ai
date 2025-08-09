const { handleCommand } = require('../../handlers/commandHandler');
const chalk = require('chalk');

// Mock chalk to avoid console color issues in tests
jest.mock('chalk', () => ({
  red: jest.fn(text => text),
  cyan: jest.fn(text => text),
  yellow: jest.fn(text => text),
  blue: jest.fn(text => text),
  green: jest.fn(text => text),
  magenta: jest.fn(text => text),
  white: jest.fn(text => text),
  gray: jest.fn(text => text)
}));

describe('CommandHandler', () => {
  let mockC9AI;

  beforeEach(() => {
    mockC9AI = {
      handleTodos: jest.fn().mockResolvedValue('Todos handled'),
      handleTools: jest.fn().mockResolvedValue('Tools handled'),
      handleModels: jest.fn().mockResolvedValue('Models handled'),
      runShellCommand: jest.fn().mockResolvedValue('Command executed'),
      handleConversation: jest.fn().mockResolvedValue('Conversation handled')
    };
    
    // Clear chalk mock calls
    jest.clearAllMocks();
  });

  test('routes todo commands correctly', async () => {
    const result = await handleCommand(mockC9AI, 'todos list');
    expect(mockC9AI.handleTodos).toHaveBeenCalledWith('list', []);
    expect(result).toBe('Todos handled');
  });

  test('routes shell commands correctly', async () => {
    const result = await handleCommand(mockC9AI, '!ls -la');
    expect(mockC9AI.runShellCommand).toHaveBeenCalledWith('ls -la');
    expect(result).toBe('Command executed');
  });

  test('handles invalid commands gracefully', async () => {
    const result = await handleCommand(mockC9AI, 'invalid command');
    expect(mockC9AI.handleConversation).toHaveBeenCalledWith('invalid command');
    expect(result).toBe('Conversation handled');
  });

  test('routes to conversation handler for unrecognized input', async () => {
    const result = await handleCommand(mockC9AI, 'how are you?');
    expect(mockC9AI.handleConversation).toHaveBeenCalledWith('how are you?');
    expect(result).toBe('Conversation handled');
  });

  test('handles errors gracefully', async () => {
    mockC9AI.handleTodos.mockRejectedValue(new Error('Test error'));
    const result = await handleCommand(mockC9AI, 'todos list');
    expect(chalk.red).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});