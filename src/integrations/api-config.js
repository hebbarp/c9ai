/**
 * External API Configuration and Authentication Management
 */

"use strict";

const { readFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");

class APIConfig {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const settingsPath = join(homedir(), ".c9ai", "settings.json");
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      
      return {
        // Internal APIs (KnoblyCream)
        creamApiKey: process.env.CREAM_API_KEY || settings.apiKeys?.CREAM_API_KEY,
        creamToken: process.env.CREAM_TOKEN || settings.apiKeys?.CREAM_TOKEN,
        creamBaseUrl: "https://knoblycream.com/api",
        
        // External APIs
        youtubeApiKey: process.env.YOUTUBE_API_KEY || settings.apiKeys?.YOUTUBE_API_KEY || 'AIzaSyBEnBr6YRKeAm9OuOZkidA7OJnrZjg4rAM',
        
        // Existing APIs
        anthropicApiKey: process.env.ANTHROPIC_API_KEY || settings.apiKeys?.ANTHROPIC_API_KEY,
        geminiApiKey: process.env.GEMINI_API_KEY || settings.apiKeys?.GEMINI_API_KEY,
        openaiApiKey: process.env.OPENAI_API_KEY || settings.apiKeys?.OPENAI_API_KEY,
        serpApiKey: process.env.SERPAPI_KEY || settings.apiKeys?.SERPAPI_KEY
      };
    } catch (error) {
      console.warn('Could not load API config, using environment variables only');
      return {
        creamApiKey: process.env.CREAM_API_KEY,
        creamToken: process.env.CREAM_TOKEN,
        creamBaseUrl: "https://knoblycream.com/api",
        youtubeApiKey: process.env.YOUTUBE_API_KEY || 'AIzaSyBEnBr6YRKeAm9OuOZkidA7OJnrZjg4rAM',
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        geminiApiKey: process.env.GEMINI_API_KEY,
        openaiApiKey: process.env.OPENAI_API_KEY,
        serpApiKey: process.env.SERPAPI_KEY
      };
    }
  }

  getCreamHeaders() {
    // Prefer token over API key for Bearer authentication
    const authToken = this.config.creamToken || this.config.creamApiKey;
    
    if (!authToken) {
      throw new Error('CREAM_TOKEN or CREAM_API_KEY not configured. Add either to settings.json or environment variables.');
    }
    
    return {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'C9AI/1.0'
    };
  }

  getCreamMultipartHeaders() {
    // Prefer token over API key for Bearer authentication
    const authToken = this.config.creamToken || this.config.creamApiKey;
    
    if (!authToken) {
      throw new Error('CREAM_TOKEN or CREAM_API_KEY not configured. Add either to settings.json or environment variables.');
    }
    
    return {
      'Authorization': `Bearer ${authToken}`
      // Note: Content-Type will be set automatically by FormData
    };
  }

  getYouTubeApiKey() {
    if (!this.config.youtubeApiKey) {
      throw new Error('YOUTUBE_API_KEY not configured. Add it to settings.json or environment variables.');
    }
    return this.config.youtubeApiKey;
  }

  // Helper to build URLs with API key
  buildCreamUrl(endpoint, includeApiKey = false) {
    const baseUrl = `${this.config.creamBaseUrl}/${endpoint}`;
    if (includeApiKey && this.config.creamApiKey) {
      return `${baseUrl}?accesskey=${this.config.creamApiKey}`;
    }
    return baseUrl;
  }
}

module.exports = { APIConfig };