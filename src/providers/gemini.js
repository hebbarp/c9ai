"use strict";
/**
 * Google Gemini provider
 */

const fetch = (...a) => import("node-fetch").then(({default:f}) => f(...a));
const { readFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");

function loadApiKey() {
  try {
    const s = JSON.parse(readFileSync(join(homedir(), ".c9ai", "settings.json"), "utf-8"));
    return process.env.GEMINI_API_KEY || s.apiKeys?.GEMINI_API_KEY;
  } catch {
    return process.env.GEMINI_API_KEY;
  }
}

function mapMessages(messages) {
  // Gemini uses a different message format
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const geminiMessages = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content ?? "") }]
  }));
  
  return { systemMessage, geminiMessages };
}

async function call(opts) {
  const apiKey = loadApiKey();
  if (!apiKey) {
    throw new Error("No Gemini API key found. Set GEMINI_API_KEY or add to settings.json");
  }

  const { systemMessage, geminiMessages } = mapMessages(opts.messages);
  
  // Add system message as first user message if present
  const contents = systemMessage 
    ? [{ role: 'user', parts: [{ text: `System instruction: ${systemMessage}` }] }, ...geminiMessages]
    : geminiMessages;

  const body = {
    contents: contents,
    generationConfig: {
      maxOutputTokens: opts.max_tokens || 1024,
      temperature: opts.temperature || 0.7,
    }
  };

  const model = opts.model || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { text };
}

module.exports = {
  name: "gemini",
  defaultModel: "gemini-1.5-flash",
  supportsGrammar: false,
  call
};