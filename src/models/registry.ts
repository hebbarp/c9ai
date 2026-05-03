import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS_DIR } from '../core/config.js';

export interface SmallModelSpec {
  name: string;
  displayName: string;
  type: 'small-language-model';
  runtime: 'ollama';
  ollamaModel: string;
  baseModel?: string;
  huggingfaceModel?: string;
  language?: string;
  description?: string;
  training?: {
    epochs?: number;
    learningRate?: number;
    loraRank?: number;
    loraAlpha?: number;
    loraDropout?: number;
    maxSeqLen?: number;
    validationSplit?: number;
    perDeviceTrainBatchSize?: number;
    gradientAccumulationSteps?: number;
    saveTotalLimit?: number;
  };
  packaging?: {
    outType?: 'f32' | 'f16' | 'bf16' | 'q8_0' | 'auto';
  };
  createdAt: string;
}

export interface SampleModel {
  name: string;
  path: string;
  spec: SmallModelSpec;
}

export interface CorpusFile {
  rel: string;
  bytes: number;
}

export interface EvalQuestion {
  id: string;
  prompt: string;
}

const CORPUS_EXTS = new Set(['.md', '.txt']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.cache']);

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function modelDir(name: string): string {
  return path.join(MODELS_DIR, slug(name));
}

function samplesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', 'samples', 'models');
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(p: string): Promise<T> {
  return JSON.parse(await fs.readFile(p, 'utf8')) as T;
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

function uniqueDest(baseDir: string, fileName: string, used: Set<string>): string {
  const parsed = path.parse(fileName);
  let candidate = fileName;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${parsed.name}-${n}${parsed.ext}`;
    n += 1;
  }
  used.add(candidate);
  return path.join(baseDir, candidate);
}

async function collectCorpusFiles(inputPath: string): Promise<string[]> {
  const out: string[] = [];
  const stat = await fs.stat(inputPath);
  if (stat.isFile()) {
    if (CORPUS_EXTS.has(path.extname(inputPath).toLowerCase())) out.push(inputPath);
    return out;
  }
  if (!stat.isDirectory()) return out;
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile() && CORPUS_EXTS.has(path.extname(entry.name).toLowerCase())) {
        out.push(full);
      }
    }
  }
  await walk(inputPath);
  return out.sort((a, b) => a.localeCompare(b));
}

export async function listSamples(): Promise<SampleModel[]> {
  const root = samplesDir();
  if (!(await pathExists(root))) return [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  const out: SampleModel[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const specPath = path.join(dir, 'model.json');
    if (!(await pathExists(specPath))) continue;
    out.push({ name: entry.name, path: dir, spec: await readJson<SmallModelSpec>(specPath) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function initModel(
  name: string,
  ollamaModel: string,
  opts: { sample?: string } = {}
): Promise<{ dir: string; spec: SmallModelSpec; created: boolean }> {
  const safeName = slug(name);
  if (!safeName) throw new Error('model name must contain letters or numbers');
  const dir = modelDir(safeName);
  const specPath = path.join(dir, 'model.json');
  if (await pathExists(specPath)) {
    return { dir, spec: await readJson<SmallModelSpec>(specPath), created: false };
  }

  if (opts.sample) {
    const sample = (await listSamples()).find(s => s.name === opts.sample);
    if (!sample) throw new Error(`sample not found: ${opts.sample}`);
    await copyDir(sample.path, dir);
  } else {
    await fs.mkdir(path.join(dir, 'prompts'), { recursive: true });
    await fs.mkdir(path.join(dir, 'corpus'), { recursive: true });
    await fs.mkdir(path.join(dir, 'eval'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'prompts', 'system.md'),
      `You are ${safeName}, a small local language model registered in c9ai.\n`,
      'utf8'
    );
    await fs.writeFile(path.join(dir, 'notes.md'), `# ${safeName}\n\n`, 'utf8');
  }

  const baseSpec = opts.sample && (await pathExists(specPath))
    ? await readJson<SmallModelSpec>(specPath)
    : null;
  const spec: SmallModelSpec = {
    ...(baseSpec ?? {}),
    name: safeName,
    displayName: baseSpec?.displayName ?? safeName,
    type: 'small-language-model',
    runtime: 'ollama',
    ollamaModel,
    createdAt: baseSpec?.createdAt ?? new Date().toISOString(),
  };
  await fs.writeFile(specPath, JSON.stringify(spec, null, 2) + '\n', 'utf8');
  return { dir, spec, created: true };
}

export async function listModels(): Promise<Array<{ dir: string; spec: SmallModelSpec }>> {
  if (!(await pathExists(MODELS_DIR))) return [];
  const entries = await fs.readdir(MODELS_DIR, { withFileTypes: true });
  const out: Array<{ dir: string; spec: SmallModelSpec }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(MODELS_DIR, entry.name);
    const specPath = path.join(dir, 'model.json');
    if (!(await pathExists(specPath))) continue;
    out.push({ dir, spec: await readJson<SmallModelSpec>(specPath) });
  }
  return out.sort((a, b) => a.spec.name.localeCompare(b.spec.name));
}

export async function loadModel(name: string): Promise<{ dir: string; spec: SmallModelSpec } | null> {
  const dir = modelDir(name);
  const specPath = path.join(dir, 'model.json');
  if (!(await pathExists(specPath))) return null;
  return { dir, spec: await readJson<SmallModelSpec>(specPath) };
}

export async function addCorpus(
  name: string,
  inputPath: string,
  cwd: string
): Promise<{ added: CorpusFile[]; skipped: number; dir: string }> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const absInput = path.resolve(cwd, inputPath);
  const files = await collectCorpusFiles(absInput);
  const corpusDir = path.join(model.dir, 'corpus');
  await fs.mkdir(corpusDir, { recursive: true });
  const existing = new Set<string>();
  try {
    for (const entry of await fs.readdir(corpusDir, { withFileTypes: true })) {
      if (entry.isFile()) existing.add(entry.name);
    }
  } catch {
    // mkdir above should have created it; ignore races.
  }
  const added: CorpusFile[] = [];
  for (const file of files) {
    const dest = uniqueDest(corpusDir, path.basename(file), existing);
    await fs.copyFile(file, dest);
    const stat = await fs.stat(dest);
    added.push({ rel: path.relative(model.dir, dest).replace(/\\/g, '/'), bytes: stat.size });
  }
  return { added, skipped: files.length === 0 ? 1 : 0, dir: corpusDir };
}

export async function listCorpus(name: string): Promise<{ dir: string; files: CorpusFile[] }> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const corpusDir = path.join(model.dir, 'corpus');
  const files: CorpusFile[] = [];
  if (!(await pathExists(corpusDir))) return { dir: corpusDir, files };
  const entries = await fs.readdir(corpusDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!CORPUS_EXTS.has(ext)) continue;
    const abs = path.join(corpusDir, entry.name);
    const stat = await fs.stat(abs);
    files.push({ rel: path.relative(model.dir, abs).replace(/\\/g, '/'), bytes: stat.size });
  }
  return { dir: corpusDir, files: files.sort((a, b) => a.rel.localeCompare(b.rel)) };
}

export async function readSystemPrompt(name: string): Promise<string | null> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const p = path.join(model.dir, 'prompts', 'system.md');
  if (!(await pathExists(p))) return null;
  return fs.readFile(p, 'utf8');
}

export async function readEvalQuestions(name: string): Promise<EvalQuestion[]> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const p = path.join(model.dir, 'eval', 'questions.md');
  if (!(await pathExists(p))) return [];
  const raw = await fs.readFile(p, 'utf8');
  const questions: EvalQuestion[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    const m = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (!m) continue;
    questions.push({ id: m[1]!, prompt: m[2]!.trim() });
  }
  return questions;
}

export async function writeEvalRun(
  name: string,
  body: string
): Promise<{ path: string; rel: string }> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const runsDir = path.join(model.dir, 'eval', 'runs');
  await fs.mkdir(runsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const outPath = path.join(runsDir, `${stamp}.md`);
  await fs.writeFile(outPath, body, 'utf8');
  return { path: outPath, rel: path.relative(model.dir, outPath).replace(/\\/g, '/') };
}
