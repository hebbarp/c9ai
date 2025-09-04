"use strict";

// Collapse immediate sentence/line repetitions and clamp length.
function collapseRepeats(text, { lineMaxRepeats = 2 } = {}) {
  const lines = String(text).split(/\r?\n/);
  const out = [];
  let last = null, count = 0;
  for (const ln of lines) {
    const cur = ln.trim();
    if (cur.length === 0) { out.push(ln); last = null; count = 0; continue; }
    if (cur === last) {
      count++;
      if (count < lineMaxRepeats) out.push(ln);
    } else {
      last = cur; count = 0; out.push(ln);
    }
  }
  return out.join("\n");
}

// Simple runaway detector: if the last window is >80% comprised of a 3–6 char motif repeated.
function isRunaway(text) {
  const s = (text || "").slice(-400);
  if (s.length < 60) return false;
  for (let m = 3; m <= 6; m++) {
    const motif = s.slice(0, m);
    if (!motif.trim()) continue;
    const repeats = Math.floor(s.length / m);
    let built = "";
    for (let i = 0; i < repeats; i++) built += motif;
    // measure overlap
    let same = 0;
    for (let i = 0; i < s.length && i < built.length; i++) if (s[i] === built[i]) same++;
    if (same / s.length >= 0.8) return true;
  }
  return false;
}

function hardClamp(text, maxChars = 2000) {
  const s = String(text);
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "\n… [truncated]";
}

// --- Summary-specific cleanup ---
function cleanupSummary(text) {
  if (!text) return "";
  let s = String(text);
  // Normalize line endings & trim
  s = s.replace(/\r/g, "").trim();
  // Collapse repeated lines first
  s = collapseRepeats(s, { lineMaxRepeats: 1 });
  // Split and filter junk
  const lines = s.split(/\n+/);
  const out = [];
  const seen = new Set();
  for (let raw of lines) {
    let ln = raw.trim();
    if (!ln) continue;
    // Strip leading bullets/nums and re-bullet later
    ln = ln.replace(/^[\-\*\u2022]\s+/, "").replace(/^\d+\.\s+/, "");
    // Drop orphan 1–2 word lines unless they contain digits or ':' (likely a key)
    const words = ln.split(/\s+/);
    if (words.length <= 2 && !/[0-9:]/.test(ln)) continue;
    // De-duplicate near-identical short headings
    const key = ln.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (key.length <= 6 && seen.has(key)) continue;
    if (key.length <= 6) seen.add(key);
    out.push(ln);
    if (out.length >= 12) break; // cap bullets
  }
  // Re-bullet and clamp length per line
  const bulleted = out.map(x => `- ${x.length > 220 ? x.slice(0, 220).trimEnd() + "…" : x}`);
  return bulleted.join("\n");
}

module.exports = { collapseRepeats, isRunaway, hardClamp, cleanupSummary };