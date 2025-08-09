const mockTodoFile = `
- [ ] Implement user authentication
- [x] Set up database connection
- [ ] Add error handling
`;

const mockConfig = {
  currentModel: 'claude',
  apiKeys: {
    openai: 'test-key'
  }
};

const mockTools = [
  {
    name: 'git-commit',
    description: 'Create a git commit',
    pattern: 'git commit -m "{message}"'
  }
];

module.exports = {
  mockTodoFile,
  mockConfig,
  mockTools
};