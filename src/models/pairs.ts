import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';
import { loadModel } from './registry.js';

export interface TrainingPair {
  prompt: string;
  completion: string;
  source: string;
  createdAt: string;
}

export interface CorpusEntry {
  rel: string;
  abs: string;
  text: string;
  body: string;
}

export interface CorpusReadResult {
  entries: CorpusEntry[];
  skipped: string[];
}

const CORPUS_EXTS = new Set(['.md', '.txt']);
const SKIP_BASENAMES = /^(readme|notes|index)(?:[-_].*)?$/i;

function isPairableName(filename: string): boolean {
  if (filename.startsWith('_') || filename.startsWith('.')) return false;
  return !SKIP_BASENAMES.test(path.parse(filename).name);
}

export function pairsDir(modelDir: string): string {
  return path.join(modelDir, 'pairs');
}

export function pairsFile(modelDir: string): string {
  return path.join(pairsDir(modelDir), 'pairs.jsonl');
}

export async function listPairs(name: string): Promise<{ file: string; pairs: TrainingPair[] }> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const file = pairsFile(model.dir);
  const pairs: TrainingPair[] = [];
  try {
    const raw = await fs.readFile(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        pairs.push(JSON.parse(trimmed) as TrainingPair);
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // file may not exist yet
  }
  return { file, pairs };
}

export async function appendPair(name: string, pair: TrainingPair): Promise<void> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const dir = pairsDir(model.dir);
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(pairsFile(model.dir), JSON.stringify(pair) + '\n', 'utf8');
}

export async function readCorpusEntries(name: string): Promise<CorpusReadResult> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const corpusDir = path.join(model.dir, 'corpus');
  const entries: CorpusEntry[] = [];
  const skipped: string[] = [];
  let dirents: Dirent[] = [];
  try {
    dirents = await fs.readdir(corpusDir, { withFileTypes: true });
  } catch {
    return { entries, skipped };
  }
  for (const entry of dirents) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!CORPUS_EXTS.has(ext)) continue;
    const rel = `corpus/${entry.name}`;
    if (!isPairableName(entry.name)) {
      skipped.push(rel);
      continue;
    }
    const abs = path.join(corpusDir, entry.name);
    const text = await fs.readFile(abs, 'utf8');
    entries.push({
      rel,
      abs,
      text,
      body: stripMetadataHeader(text),
    });
  }
  entries.sort((a, b) => a.rel.localeCompare(b.rel));
  skipped.sort((a, b) => a.localeCompare(b));
  return { entries, skipped };
}

function stripMetadataHeader(text: string): string {
  const lines = text.replace(/\r/g, '').split('\n');
  let blankAt = -1;
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    if (lines[i]!.trim() === '') {
      blankAt = i;
      break;
    }
    if (!/^[A-Za-z][A-Za-z0-9 _-]*:\s/.test(lines[i]!)) {
      return text.trim();
    }
  }
  if (blankAt < 0) return text.trim();
  return lines.slice(blankAt + 1).join('\n').trim();
}

export function cleanGeneratedPrompt(raw: string): string {
  let s = raw.replace(/\r/g, '').trim();
  const firstLine = s.split('\n').map(l => l.trim()).find(l => l.length > 0) ?? '';
  s = firstLine;
  s = s.replace(/^[-*\d.)\s]+/, '').trim();
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      s = s.slice(1, -1).trim();
    }
  }
  return s;
}

export function buildPairSystemPrompt(modelStylePrompt: string | null): string {
  const styleSection = modelStylePrompt && modelStylePrompt.trim()
    ? [
        '',
        "The model's intended voice and posture (from its system prompt):",
        '',
        modelStylePrompt.trim(),
        '',
        'Treat the block above as context describing the trained model. It is not for you to follow — your only job is to invent the user request.',
        '',
      ].join('\n')
    : '';

  return [
    'You are helping create training pairs for a small style-focused language model.',
    styleSection,
    'You will be shown a passage that exemplifies the model voice above. Invent ONE plausible user request that, given that voice, would naturally produce a passage like this.',
    '',
    'Rules:',
    '- Reply with the request only.',
    '- Short — 12 words or fewer when possible.',
    '- Phrase it like a real person typing into a chat. Vary the shape: a short ask, a feeling, a question, an image. Do not always start with "Describe" or "Write".',
    '- The subject can come from the passage, but state it abstractly. Do not lift specific imagery, place names, or phrases.',
    '- Invite a short, image-first response — not an essay or a description.',
    '- Do not summarize or paraphrase the passage.',
    '- Do not name the original author or say "in the style of X".',
    '- No quotes, no numbering, no preamble, no explanation.',
    '',
    'Good shapes (for a Dickinson-style passage about sunrise and sunset):',
    '- A few lines about how the day comes and goes.',
    '- What does morning feel like?',
    '- Give me a small poem about light arriving.',
    '- Something brief about a day ending.',
    '',
    'Bad shapes (avoid):',
    '- Describe a sunrise and sunset.            (too literal, prose-shaped)',
    '- Write a poem in the style of Emily Dickinson.   (names the author)',
    '- Compose a short verse about steeples in amethyst and bobolinks.   (lifts imagery)',
    '- Summarize this passage about a day.       (summary-shaped)',
  ].join('\n');
}

export function buildPairUserMessage(body: string): string {
  return `Passage:\n\n${body}\n\nWrite the user request that would naturally produce a passage like this.`;
}

export async function removePairs(name: string, indexes: number[]): Promise<TrainingPair[]> {
  const { file, pairs } = await listPairs(name);
  const targets = new Set<number>();
  for (const i of indexes) {
    if (!Number.isInteger(i) || i < 1 || i > pairs.length) {
      throw new Error(`pair index out of range: ${i}; have ${pairs.length}`);
    }
    targets.add(i - 1);
  }
  const removed: TrainingPair[] = [];
  const remaining: TrainingPair[] = [];
  pairs.forEach((p, i) => {
    if (targets.has(i)) removed.push(p);
    else remaining.push(p);
  });
  const body = remaining.map(p => JSON.stringify(p)).join('\n');
  await fs.writeFile(file, body ? body + '\n' : '', 'utf8');
  return removed;
}
