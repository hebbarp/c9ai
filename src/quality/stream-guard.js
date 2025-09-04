"use strict";

// Lightweight streaming quality heuristics — no heavy deps.
// Idea: If novelty stays low and repetition stays high for a few windows, stop.
// Optionally, if we have source text (e.g., PDF), monitor drift from source keywords.

function tokenize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function ngrams(tokens, n = 2) {
  const out = [];
  for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(" "));
  return out;
}

function topKeywords(text, k = 40) {
  const stop = new Set([
    "the","and","of","to","a","in","for","is","on","it","that","as","with","at","by",
    "an","be","or","are","from","this","was","but","if","not","we","you","i","they",
    "he","she","them","his","her","their","our","your","so","do","does","did","can",
    "will","would","could","should","have","has","had","about","into","over","than"
  ]);
  const freq = new Map();
  for (const t of tokenize(text)) {
    if (stop.has(t) || t.length <= 2) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return new Set([...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0, k).map(e=>e[0]));
}

class StreamGuard {
  constructor(opts = {}) {
    this.windowChars = opts.windowChars ?? 600;       // rolling window size
    this.minNovelty = opts.minNovelty ?? 0.16;        // unique tokens / total
    this.maxRepeatRate = opts.maxRepeatRate ?? 0.38;  // repeated bigrams / total bigrams
    this.minDriftOverlap = opts.minDriftOverlap ?? 0.08; // overlap vs. source keywords
    this.badWindowsToStop = opts.badWindowsToStop ?? 3;
    this.enableDrift = !!opts.sourceText;
    this.sourceKeys = opts.sourceText ? topKeywords(opts.sourceText, opts.sourceTopK ?? 50) : null;
    this.buffer = "";
    this.badCount = 0;
  }

  // returns {ok:boolean, reason?:string}
  push(chunk) {
    this.buffer += chunk;
    const window = this.buffer.slice(-this.windowChars);
    const toks = tokenize(window);
    if (toks.length < 30) return { ok: true }; // too early to judge

    const uniq = new Set(toks);
    const novelty = uniq.size / toks.length;

    const bi = ngrams(toks, 2);
    const seen = new Set();
    let reps = 0;
    for (const g of bi) {
      if (seen.has(g)) reps++;
      else seen.add(g);
    }
    const repeatRate = bi.length ? (reps / bi.length) : 0;

    let driftOk = true;
    if (this.enableDrift && this.sourceKeys && this.sourceKeys.size) {
      let hits = 0;
      for (const t of uniq) if (this.sourceKeys.has(t)) hits++;
      const overlap = hits / Math.max(1, uniq.size);
      driftOk = overlap >= this.minDriftOverlap;
    }

    const bad = (novelty < this.minNovelty) && (repeatRate > this.maxRepeatRate) && driftOk;
    // if driftOk is false (too off-topic), also treat as bad:
    const trulyBad = bad || (!driftOk && repeatRate > 0.25);
    if (trulyBad) this.badCount++; else this.badCount = Math.max(0, this.badCount - 1);

    if (this.badCount >= this.badWindowsToStop) {
      return { ok: false, reason: `low-novelty/high-repeat (${novelty.toFixed(2)}/${repeatRate.toFixed(2)})` };
    }
    return { ok: true };
  }

  snapshot() { return this.buffer; }
}

module.exports = { StreamGuard };