"use strict";
/**
 * Claude provider for fallback when llama.cpp fails
 */

const fetch = (...a) => import("node-fetch").then(({default:f}) => f(...a));
const { readFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");

function loadApiKey() {
  try {
    const s = JSON.parse(readFileSync(join(homedir(), ".c9ai", "settings.json"), "utf-8"));
    return process.env.ANTHROPIC_API_KEY || s.apiKeys?.ANTHROPIC_API_KEY;
  } catch {
    return process.env.ANTHROPIC_API_KEY;
  }
}

function mapMessages(messages) {
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const anthropicMessages = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? "")
  }));
  
  return { systemMessage, anthropicMessages };
}

async function call(opts) {
  const apiKey = loadApiKey();
  if (!apiKey) {
    throw new Error("No Claude API key found. Set ANTHROPIC_API_KEY or add to settings.json");
  }

  const { systemMessage, anthropicMessages } = mapMessages(opts.messages);
  
  const body = {
    model: opts.model || "claude-3-5-sonnet-latest",
    max_tokens: opts.max_tokens || 1024,
    messages: anthropicMessages,
    temperature: opts.temperature || 0.7,
    ...(systemMessage && { system: systemMessage })
  };

  const url = "https://api.anthropic.com/v1/messages";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.content[0]?.text || "";
  return { text };
}

module.exports = {
  name: "claude",
  defaultModel: "claude-3-5-sonnet-latest", 
  supportsGrammar: false,
  call
};