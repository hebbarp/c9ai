"use strict";
/**
 * Universal Provider System with Hybrid Support
 * Supports local, cloud, and hybrid providers
 */

const { HybridProvider } = require("./hybrid");

// Provider registries
const LOCAL_PROVIDERS = {
  llamacpp: () => require("./local-llamacpp"),
  ollama: () => require("./local-ollama"),
  "node-llama-cpp": () => require("./localProvider")
};

const CLOUD_PROVIDERS = {
  claude: () => require("./claude"),
  gemini: () => require("./gemini"),
  openai: () => require("./openai"),
  deepseek: () => require("./deepseek")
};

function getLocalProvider(which = "llamacpp") {
  const provider = LOCAL_PROVIDERS[which];
  if (!provider) {
    throw new Error(`Unknown local provider: ${which}`);
  }
  return provider();
}

function getCloudProvider(which) {
  const provider = CLOUD_PROVIDERS[which];
  if (!provider) {
    throw new Error(`Unknown cloud provider: ${which}`);
  }
  return provider();
}

function getProvider(which = "llamacpp") {
  // Handle hybrid providers
  if (which.endsWith('-hybrid')) {
    const cloudProviderId = which.replace('-hybrid', '');
    const cloudProvider = getCloudProvider(cloudProviderId);
    const localProvider = getLocalProvider("llamacpp"); // Default local provider
    return new HybridProvider(cloudProvider, localProvider);
  }
  
  // Handle cloud providers
  if (CLOUD_PROVIDERS[which]) {
    return getCloudProvider(which);
  }
  
  // Handle local providers
  if (LOCAL_PROVIDERS[which]) {
    return getLocalProvider(which);
  }
  
  // Default to llamacpp
  return getLocalProvider("llamacpp");
}

function isHybridProvider(providerId) {
  return providerId.endsWith('-hybrid');
}

function isCloudProvider(providerId) {
  return CLOUD_PROVIDERS.hasOwnProperty(providerId.replace('-hybrid', ''));
}

function isLocalProvider(providerId) {
  return LOCAL_PROVIDERS.hasOwnProperty(providerId);
}

function getAvailableProviders() {
  const local = Object.keys(LOCAL_PROVIDERS);
  const cloud = Object.keys(CLOUD_PROVIDERS);
  const hybrid = cloud.map(c => `${c}-hybrid`);
  
  return {
    local,
    cloud, 
    hybrid,
    all: [...local, ...cloud, ...hybrid]
  };
}

module.exports = { 
  getLocalProvider, 
  getProvider, 
  getCloudProvider,
  isHybridProvider,
  isCloudProvider, 
  isLocalProvider,
  getAvailableProviders,
  // Keep createFallbackProvider for backward compatibility, but prefer hybrid providers
  createFallbackProvider: (primaryProvider = "llamacpp") => {
    console.warn("createFallbackProvider is deprecated. Use hybrid providers instead (e.g., 'claude-hybrid')");
    return getProvider(primaryProvider);
  }
};