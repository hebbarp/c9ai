"use strict";

function isBulletLine(s) {
  return /^[\s]*([-*•]|\d+\.)\s+/.test(s);
}

function normalizeBullet(s) {
  let t = String(s || "").replace(/^\s*([-*•]|\d+\.)\s+/, "").trim();
  // drop trailing punctuation-heavy clutter
  t = t.replace(/\s*[-–—:,;]+$/g, "").trim();
  return t;
}

function dedupePreserveOrder(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = x.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function cleanBullets(text, { max = 8, minLen = 4 } = {}) {
  const lines = String(text || "").split(/\r?\n/);
  const kept = [];
  for (let ln of lines) {
    if (!isBulletLine(ln)) continue;
    const core = normalizeBullet(ln);
    if (!core || core.length < minLen) continue;
    kept.push(core);
    if (kept.length >= max) break;
  }
  const deduped = dedupePreserveOrder(kept);
  return deduped.map(x => `- ${x}`).join("\n");
}

// live streaming helper: return { done, current, count }
function streamBulletTally(buffer, { max = 8, minLen = 4 } = {}) {
  const lines = buffer.split(/\r?\n/);
  const bullets = [];
  for (const ln of lines) {
    if (!isBulletLine(ln)) continue;
    const core = normalizeBullet(ln);
    if (core.length < minLen) continue;
    bullets.push(core);
    if (bullets.length >= max) {
      return { done: true, current: bullets, count: bullets.length };
    }
  }
  // degeneracy: last 3 bullets < minLen+2 or repeating same word
  if (bullets.length >= 4) {
    const tail = bullets.slice(-3);
    const tooShort = tail.every(x => x.length <= minLen + 2);
    const first = tail[0]?.toLowerCase();
    const allSame = first && tail.every(x => x.toLowerCase() === first);
    if (tooShort || allSame) {
      return { done: true, current: bullets, count: bullets.length };
    }
  }
  return { done: false, current: bullets, count: bullets.length };
}

module.exports = { isBulletLine, normalizeBullet, cleanBullets, streamBulletTally };