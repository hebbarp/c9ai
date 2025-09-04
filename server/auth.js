"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const express = require("express");
const crypto = require("node:crypto");

const router = express.Router();
const CONF_DIR = path.join(os.homedir(), ".c9ai");
const USERS_PATH = path.join(CONF_DIR, "users.json");
const SESSIONS_PATH = path.join(CONF_DIR, "sessions.json");

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

function readUsers() {
  try {
    const txt = fs.readFileSync(USERS_PATH, "utf-8");
    return JSON.parse(txt);
  } catch {
    return [];
  }
}

function writeUsers(users) {
  ensureDir(CONF_DIR);
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), "utf-8");
}

function readSessions() {
  try {
    const txt = fs.readFileSync(SESSIONS_PATH, "utf-8");
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

function writeSessions(sessions) {
  ensureDir(CONF_DIR);
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2), "utf-8");
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function verifySession(req) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.session;
  if (!token) return null;
  
  const sessions = readSessions();
  const session = sessions[token];
  
  if (!session || new Date(session.expires) < new Date()) {
    return null;
  }
  
  return session;
}

// Middleware to check authentication
function requireAuth(req, res, next) {
  const session = verifySession(req);
  if (!session) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = session.user;
  next();
}

// POST /api/auth/register
router.post("/api/auth/register", express.json(), (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }
  
  const users = readUsers();
  
  // Check if user already exists
  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'User already exists' });
  }
  
  const newUser = {
    id: Date.now().toString(),
    email,
    name,
    password: hashPassword(password),
    created: new Date().toISOString(),
    subscription: 'free' // Default subscription
  };
  
  users.push(newUser);
  writeUsers(users);
  
  // Remove password from response
  const { password: _, ...userResponse } = newUser;
  res.json({ user: userResponse });
});

// POST /api/auth/login
router.post("/api/auth/login", express.json(), (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  const users = readUsers();
  const user = users.find(u => u.email === email && u.password === hashPassword(password));
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Create session
  const token = generateSessionToken();
  const sessions = readSessions();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  sessions[token] = {
    user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription },
    expires: expires.toISOString(),
    created: new Date().toISOString()
  };
  
  writeSessions(sessions);
  
  res.json({ 
    token,
    user: sessions[token].user,
    expires: sessions[token].expires
  });
});

// POST /api/auth/logout
router.post("/api/auth/logout", express.json(), (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
  
  if (token) {
    const sessions = readSessions();
    delete sessions[token];
    writeSessions(sessions);
  }
  
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/check
router.get("/api/auth/check", (req, res) => {
  const session = verifySession(req);
  res.json({ authenticated: !!session, user: session?.user || null });
});

module.exports = { authRouter: router, requireAuth, verifySession };