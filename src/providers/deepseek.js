"use strict";
/**
 * DeepSeek provider - Cost-effective AI alternative
 */

const fetch = (...a) => import("node-fetch").then(({default:f}) => f(...a));
const { readFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");

function loadApiKey() {
  try {
    const s = JSON.parse(readFileSync(join(homedir(), ".c9ai", "settings.json"), "utf-8"));
    return process.env.DEEPSEEK_API_KEY || s.apiKeys?.DEEPSEEK_API_KEY;
  } catch {
    return process.env.DEEPSEEK_API_KEY;
  }
}

function mapMessages(messages) {
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const deepSeekMessages = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? "")
  }));
  
  return { systemMessage, deepSeekMessages };
}

async function call(opts) {
  const apiKey = loadApiKey();
  if (!apiKey) {
    throw new Error("No DeepSeek API key found. Set DEEPSEEK_API_KEY or add to settings.json");
  }

  const { systemMessage, deepSeekMessages } = mapMessages(opts.messages);
  
  // If there's a system message, add it as the first user message with special formatting
  const messages = systemMessage 
    ? [{ role: "user", content: `System: ${systemMessage}` }, ...deepSeekMessages]
    : deepSeekMessages;

  const body = {
    model: opts.model || "deepseek-chat",
    messages: messages,
    max_tokens: opts.max_tokens || 1024,
    temperature: opts.temperature || 0.7,
    stream: false
  };

  const url = "https://api.deepseek.com/v1/chat/completions";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return { text };
}

module.exports = {
  name: "deepseek",
  defaultModel: "deepseek-chat",
  supportsGrammar: false,
  call
};