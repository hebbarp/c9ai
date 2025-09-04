"use strict";
const express = require("express");
const fetch = (...a) => import("node-fetch").then(({default:f}) => f(...a));
const { APIConfig } = require("../src/integrations/api-config");

const router = express.Router();

async function fetchWithTimeout(url, opts = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const elapsed = Date.now() - started;
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, statusText: res.statusText, elapsed, text, json };
  } catch (e) {
    return { ok: false, error: e.message, elapsed: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

// GET /api/cream/debug
router.get('/api/cream/debug', async (req, res) => {
  try {
    const cfg = new APIConfig();
    const base = cfg.config.creamBaseUrl || 'https://knoblycream.com/api';
    const timeoutMs = Number(process.env.CREAM_TIMEOUT_MS || 45000);

    const rssUrl = `${base}/articles.php?rss_id=${encodeURIComponent(req.query.rss_id || 8)}`;
    const streamUrl = `${base}/stream.php`;

    const rss = await fetchWithTimeout(rssUrl, { method: 'GET', headers: { 'User-Agent':'c9ai-client/diag' } }, timeoutMs);
    const stream = await fetchWithTimeout(streamUrl, { method: 'GET', headers: { 'User-Agent':'c9ai-client/diag' } }, timeoutMs);

    const out = {
      base,
      timeoutMs,
      rss: {
        url: rssUrl,
        ok: rss.ok,
        status: rss.status,
        elapsedMs: rss.elapsed,
        sample: (rss.text || '').slice(0, 1000)
      },
      stream: {
        url: streamUrl,
        ok: stream.ok,
        status: stream.status,
        elapsedMs: stream.elapsed,
        sample: (stream.text || '').slice(0, 1000)
      }
    };
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = { creamDebugRouter: router };

// Additional diagnostics for mail and posts
router.get('/api/cream/diag-mail', async (req, res) => {
  try {
    const cfg = new APIConfig();
    const base = cfg.config.creamBaseUrl || 'https://knoblycream.com/api';
    const url = `${base}/mail.php`;
    const headers = cfg.getCreamHeaders();
    headers['Content-Type'] = 'application/json';
    // Harmless payload to validate auth/endpoint (invalid action on purpose)
    const body = JSON.stringify({ action: 'ping' });
    const out = await fetchWithTimeout(url, { method: 'POST', headers, body }, Number(process.env.CREAM_TIMEOUT_MS || 45000));
    return res.json({
      url,
      usedAuth: !!(cfg.config.creamToken || cfg.config.creamApiKey),
      status: out.status,
      ok: out.ok,
      elapsedMs: out.elapsed,
      sample: (out.text || '').slice(0, 800)
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.get('/api/cream/diag-post', async (req, res) => {
  try {
    const cfg = new APIConfig();
    const base = cfg.config.creamBaseUrl || 'https://knoblycream.com/api';
    const includeKey = !!cfg.config.creamApiKey;
    const url = `${base}/posts.php${includeKey ? ('?accesskey=' + encodeURIComponent(cfg.config.creamApiKey)) : ''}`;
    const headers = cfg.getCreamMultipartHeaders();
    // Minimal form-data to trigger validation without creating a real post
    const fd = new (require('form-data'))();
    fd.append('content', ''); // empty to force 400 if auth ok
    fd.append('visibility', 'public');
    const out = await fetchWithTimeout(url, { method: 'POST', headers, body: fd }, Number(process.env.CREAM_TIMEOUT_MS || 45000));
    return res.json({
      url,
      usedAuth: !!(cfg.config.creamToken || cfg.config.creamApiKey),
      status: out.status,
      ok: out.ok,
      elapsedMs: out.elapsed,
      sample: (out.text || '').slice(0, 800)
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
