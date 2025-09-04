"use strict";
/**
 * OpenAI provider
 */

const fetch = (...a) => import("node-fetch").then(({default:f}) => f(...a));
const { readFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");

function loadApiKey() {
  try {
    const s = JSON.parse(readFileSync(join(homedir(), ".c9ai", "settings.json"), "utf-8"));
    return process.env.OPENAI_API_KEY || s.apiKeys?.OPENAI_API_KEY;
  } catch {
    return process.env.OPENAI_API_KEY;
  }
}

function mapMessages(messages) {
  return messages.map(m => ({
    role: m.role,
    content: String(m.content ?? "")
  }));
}

async function call(opts) {
  const apiKey = loadApiKey();
  if (!apiKey) {
    throw new Error("No OpenAI API key found. Set OPENAI_API_KEY or add to settings.json");
  }

  const body = {
    model: opts.model || "gpt-4o-mini",
    messages: mapMessages(opts.messages),
    max_tokens: opts.max_tokens || 1024,
    temperature: opts.temperature || 0.7,
  };

  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com";
  const url = `${baseUrl}/v1/chat/completions`;
  
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
    throw new Error(`OpenAI API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return { text };
}

module.exports = {
  name: "openai",
  defaultModel: "gpt-4o-mini",
  supportsGrammar: false,
  call
};