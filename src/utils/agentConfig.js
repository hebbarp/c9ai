"use strict";
const fs = require("node:fs");
const path = require("node:path");

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function loadAgentConfig(cwd = process.cwd()) {
  // Priority: .c9airc.json > package.json.c9ai > defaults
  const rcPath = path.join(cwd, ".c9airc.json");
  if (fs.existsSync(rcPath)) {
    const cfg = readJsonSafe(rcPath) || {};
    return cfg;
  }
  const pkgPath = path.join(cwd, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = readJsonSafe(pkgPath) || {};
    if (pkg && pkg.c9ai && typeof pkg.c9ai === "object") return pkg.c9ai;
  }
  return {};
}

module.exports = { loadAgentConfig };