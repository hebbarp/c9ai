"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const express = require("express");
const { toolRegistry } = require("../src/tools/registry");

const router = express.Router();
const CONF_DIR = path.join(os.homedir(), ".c9ai");
const SETTINGS_PATH = path.join(CONF_DIR, "settings.json");

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}
function readSettings() {
  try {
    const txt = fs.readFileSync(SETTINGS_PATH, "utf-8");
    return JSON.parse(txt);
  } catch {
    return {
      provider: "llamacpp",
      confirmThreshold: 0.6,
      allowedTools: ["shell.run","script.run","fs.read","fs.write","web.search","jit"],
      apiKeys: {},  // e.g. { SERPAPI_KEY: "" }
      style: { conciseness: 0.6, bulletMax: 8 },
      // New routing and privacy settings
      defaultMode: "hybrid",           // local | hybrid | cloud
      privacyProfile: "ask_before_cloud", // strict_local | ask_before_cloud | cloud_preferred
      codingProvider: "claude"         // preferred coding model when not strict_local
    };
  }
}
function writeSettings(obj) {
  ensureDir(CONF_DIR);
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(obj, null, 2), "utf-8");
}

// GET /api/settings
router.get("/api/settings", (_req, res) => {
  const s = readSettings();
  res.json(s);
});

// PUT /api/settings
router.put("/api/settings", express.json(), (req, res) => {
  const cur = readSettings();
  const next = { ...cur, ...req.body };
  next.apiKeys = { ...cur.apiKeys, ...req.body.apiKeys };
  // basic normalization
  if (!Array.isArray(next.allowedTools)) next.allowedTools = cur.allowedTools;
  if (typeof next.confirmThreshold !== "number") next.confirmThreshold = cur.confirmThreshold;
  if (typeof next.provider !== "string") next.provider = cur.provider;
  if (typeof next.apiKeys !== "object" || next.apiKeys == null) next.apiKeys = cur.apiKeys;
  // normalize new fields
  const validModes = new Set(["local","hybrid","cloud"]);
  if (!validModes.has(next.defaultMode)) next.defaultMode = cur.defaultMode || "hybrid";
  const validPrivacy = new Set(["strict_local","ask_before_cloud","cloud_preferred"]);
  if (!validPrivacy.has(next.privacyProfile)) next.privacyProfile = cur.privacyProfile || "ask_before_cloud";
  const validCodingProviders = new Set(["llamacpp","claude","gemini","openai","deepseek"]);
  if (!validCodingProviders.has(next.codingProvider)) next.codingProvider = cur.codingProvider || "claude";
  writeSettings(next);
  res.json({ ok: true });
});

// GET /api/tools  (useful for Help page later)
router.get("/api/tools", (_req, res) => {
  const items = toolRegistry.map(t => ({ name: t.name, description: t.description || "" }));
  res.json({ tools: items });
});

// Conversation storage
const CONVERSATIONS_PATH = path.join(CONF_DIR, "conversations.json");

function readConversations() {
  try {
    const txt = fs.readFileSync(CONVERSATIONS_PATH, "utf-8");
    return JSON.parse(txt);
  } catch {
    return [];
  }
}

function writeConversations(conversations) {
  ensureDir(CONF_DIR);
  fs.writeFileSync(CONVERSATIONS_PATH, JSON.stringify(conversations, null, 2), "utf-8");
}

// GET /api/conversations
router.get("/api/conversations", (_req, res) => {
  const conversations = readConversations();
  res.json({ conversations });
});

// POST /api/conversations
router.post("/api/conversations", express.json(), (req, res) => {
  const conversations = readConversations();
  const newConversation = {
    id: Date.now().toString(),
    title: req.body.title || 'New Conversation',
    messages: req.body.messages || [],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    ...req.body
  };
  
  conversations.unshift(newConversation);
  writeConversations(conversations);
  res.json({ conversation: newConversation });
});

// PUT /api/conversations/:id
router.put("/api/conversations/:id", express.json(), (req, res) => {
  const conversations = readConversations();
  const index = conversations.findIndex(c => c.id === req.params.id);
  
  if (index === -1) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  
  conversations[index] = {
    ...conversations[index],
    ...req.body,
    updated: new Date().toISOString()
  };
  
  writeConversations(conversations);
  res.json({ conversation: conversations[index] });
});

// DELETE /api/conversations/:id
router.delete("/api/conversations/:id", (_req, res) => {
  const conversations = readConversations();
  const filtered = conversations.filter(c => c.id !== _req.params.id);
  
  if (filtered.length === conversations.length) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  
  writeConversations(filtered);
  res.json({ ok: true });
});

module.exports = { settingsRouter: router, SETTINGS_PATH, CONVERSATIONS_PATH };
