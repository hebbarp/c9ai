"use strict";
const express = require("express");
const cp = require("node:child_process");

const router = express.Router();

router.post('/api/terminal/run', express.json(), async (req, res) => {
  try {
    const cmd = String(req.body?.cmd || '').trim();
    if (!cmd) return res.status(400).json({ success: false, error: 'Missing cmd' });
    // Run command with shell, capture output; 30s timeout
    cp.exec(cmd, { timeout: 30000, shell: true }, (err, stdout, stderr) => {
      return res.json({ success: !err, code: err?.code ?? 0, stdout, stderr });
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { terminalRouter: router };

