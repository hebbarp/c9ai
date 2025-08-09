module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/electron/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['./src/tests/helpers/setup.js'],
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
  verbose: true,
  clearMocks: true,
  transformIgnorePatterns: [
    'node_modules/(?!(node-llama-cpp)/)'
  ],
  moduleNameMapper: {
    '^node-llama-cpp$': '<rootDir>/src/tests/helpers/mockLlama.js'
  }
}