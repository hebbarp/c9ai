/**
 * Mock implementation of node-llama-cpp for testing
 */

class MockLlamaModel {
    constructor(options = {}) {
        this.options = options;
    }

    async load() {
        return true;
    }
}

class MockLlamaContext {
    constructor(options = {}) {
        this.options = options;
    }
}

class MockLlamaChatSession {
    constructor(options = {}) {
        this.options = options;
    }

    async prompt(text) {
        return `Mock response for: ${text}`;
    }
}

module.exports = {
    LlamaModel: MockLlamaModel,
    LlamaContext: MockLlamaContext,
    LlamaChatSession: MockLlamaChatSession
};
