"use strict";

// Auto-generated tool runner - DO NOT EDIT MANUALLY
// Last updated: 2025-08-13T14:28:43.688Z

const fs = require("node:fs");
const path = require("node:path");

// Built-in tools
const { shellRun } = require("./shell");
const { fsRead } = require("./filesystem");
const { fsWrite } = require("./filesystem");
const { webSearch } = require("./web");
const jitExecutor = require("./jit-executor");
const githubFetcher = require("./github-fetcher");
const gdriveFetcher = require("./gdrive-fetcher");

// External API tools
const { 
  rssRead, 
  creamFetch, 
  creamMail, 
  creamPost, 
  youtubeSearch, 
  youtubeTrending, 
  apiStatus 
} = require("./external-apis");

// Installed package tools  
const installedTools = {};

try {
  installedTools["cream.auth"] = require("./packages/cream.auth");
} catch (e) {
  console.warn("Failed to load tool cream.auth:", e.message);
}
try {
  installedTools["cream.social.post"] = require("./packages/cream.social.post");
} catch (e) {
  console.warn("Failed to load tool cream.social.post:", e.message);
}
try {
  installedTools["document.pdf"] = require("./packages/document.pdf");
} catch (e) {
  console.warn("Failed to load tool document.pdf:", e.message);
}
try {
  installedTools["email.send"] = require("./packages/email.send");
} catch (e) {
  console.warn("Failed to load tool email.send:", e.message);
}

/**
 * Run a tool with given arguments
 */
async function runTool(toolName, args = {}) {
  console.log(`🔧 Running tool: ${toolName}`, args);
  
  try {
    // Check built-in tools first
    switch (toolName) {
      case "shell.run":
        return await shellRun(args);
      case "fs.read":
        return await fsRead(args);
      case "fs.write":
        return await fsWrite(args);
      case "web.search":
        return await webSearch(args);
      case "jit":
        console.log(`🛠️  Tool runner calling jitExecutor.execute with:`, args);
        const jitResult = await jitExecutor.execute(args);
        console.log(`🛠️  Tool runner got result from jitExecutor:`, jitResult);
        return jitResult;
      case "github.fetch":
        return await githubFetcher.execute(args);
      case "gdrive.fetch":
        return await gdriveFetcher.execute(args);
      // External API tools
      case "rss.read":
        return await rssRead(args);
      case "cream.fetch":
        return await creamFetch(args);
      case "cream.mail":
        return await creamMail(args);
      case "cream.post":
        return await creamPost(args);
      case "youtube.search":
        return await youtubeSearch(args);
      case "youtube.trending":
        return await youtubeTrending(args);
      case "api.status":
        return await apiStatus(args);
      default:
        // Check installed package tools
        if (installedTools[toolName]) {
          const result = await installedTools[toolName].execute(args);
          return {
            tool: toolName,
            success: true,
            result: result
          };
        }
        
        throw new Error(`Tool '${toolName}' not found. Available tools: ${Object.keys({
          "shell.run": true,
          "fs.read": true,
          "fs.write": true,
          "web.search": true,
          "jit": true,
          "github.fetch": true,
          "gdrive.fetch": true,
          "rss.read": true,
          "cream.fetch": true,
          "cream.mail": true,
          "cream.post": true,
          "youtube.search": true,
          "youtube.trending": true,
          "api.status": true,
          ...installedTools
        }).join(", ")}`);
    }
  } catch (error) {
    console.error(`❌ Tool ${toolName} failed:`, error);
    return {
      tool: toolName,
      success: false,
      error: error.message
    };
  }
}

module.exports = { runTool };
