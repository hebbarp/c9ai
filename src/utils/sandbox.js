"use strict";
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

function safePath(p) {
  const abs = path.resolve(ROOT, p);
  if (!abs.startsWith(ROOT)) throw new Error(`Path escapes workspace: ${p}`);
  return abs;
}

function ensureDirFor(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

module.exports = { safePath, ensureDirFor, ROOT };