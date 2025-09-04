"use strict";

const { toolRegistry } = require("../src/tools/registry");

function makeToolUsePrompt(task) {
  const toolDecls = toolRegistry.map(t => `- ${t.name}: ${t.description}`).join("\n");
  return `You are a helpful AI assistant that can use tools. Based on the user's request, select the best tool and arguments. If you can't find a tool, respond to the user directly.

Available tools:
${toolDecls}

User request: ${task}

Tool call:`
}

module.exports = { makeToolUsePrompt };
