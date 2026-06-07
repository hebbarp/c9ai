import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { listInstalledOllamaModels } from '../providers/ollama.js';
import { listCorpus, loadModel, readEvalQuestions, readSystemPrompt } from './registry.js';
import { listPairs, pairsFile, type TrainingPair } from './pairs.js';
import { listEvalRuns } from './review.js';

export interface PairAuditIssue {
  level: 'warn' | 'fail';
  code: string;
  message: string;
}

export interface PairAuditResult {
  pairCount: number;
  pairHash: string | null;
  issues: PairAuditIssue[];
}

export interface ModelStatus {
  name: string;
  dir: string;
  ollamaModel: string;
  corpusCount: number;
  corpusBytes: number;
  pairCount: number;
  pairHash: string | null;
  systemPrompt: boolean;
  evalQuestionCount: number;
  evalRunCount: number;
  reviewedEvalRunCount: number;
  buildModelfile: string | null;
  trainDataset: string | null;
  trainMetadata: string | null;
  trainMetrics: string | null;
  adapterHash: string | null;
  packageMetadata: string | null;
  ggufHash: string | null;
  pairIssues: PairAuditIssue[];
}

export interface DoctorCheck {
  level: 'ok' | 'warn' | 'fail';
  name: string;
  detail: string;
}

export interface DoctorResult {
  checks: DoctorCheck[];
}

export interface ExportResult {
  exportDir: string;
  manifestPath: string;
  fileCount: number;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function sha256File(p: string): Promise<string | null> {
  try {
    const hash = createHash('sha256');
    hash.update(await fs.readFile(p));
    return hash.digest('hex');
  } catch {
    return null;
  }
}

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export async function hashFiles(files: string[]): Promise<string | null> {
  const hash = createHash('sha256');
  let used = 0;
  for (const file of files.sort((a, b) => a.localeCompare(b))) {
    try {
      hash.update(file.replace(/\\/g, '/'));
      hash.update('\0');
      hash.update(await fs.readFile(file));
      hash.update('\0');
      used++;
    } catch {
      // Ignore files that disappear during the scan.
    }
  }
  return used > 0 ? hash.digest('hex') : null;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function shortHash(hash: string | null): string {
  return hash ? hash.slice(0, 12) : '(none)';
}

export async function auditPairs(name: string): Promise<PairAuditResult> {
  const { file, pairs } = await listPairs(name);
  const issues: PairAuditIssue[] = [];
  const promptSeen = new Map<string, number>();
  const completionSeen = new Map<string, number>();
  const sourceSeen = new Map<string, number>();

  pairs.forEach((pair, i) => {
    const index = i + 1;
    const prompt = pair.prompt.trim();
    const completion = pair.completion.trim();
    if (prompt.length < 4) {
      issues.push({ level: 'fail', code: 'prompt-short', message: `pair ${index}: prompt is too short` });
    }
    if (prompt.length > 240) {
      issues.push({ level: 'warn', code: 'prompt-long', message: `pair ${index}: prompt is long (${prompt.length} chars)` });
    }
    if (completion.length < 40) {
      issues.push({ level: 'warn', code: 'completion-short', message: `pair ${index}: completion is short (${completion.length} chars)` });
    }
    if (completion.length > 8000) {
      issues.push({ level: 'warn', code: 'completion-long', message: `pair ${index}: completion is long (${completion.length} chars)` });
    }
    if (!pair.source.trim()) {
      issues.push({ level: 'fail', code: 'source-missing', message: `pair ${index}: source is missing` });
    }

    const promptKey = normalizeText(prompt);
    const completionKey = normalizeText(completion);
    const sourceKey = pair.source.trim().toLowerCase();
    const promptFirst = promptSeen.get(promptKey);
    const completionFirst = completionSeen.get(completionKey);
    const sourceFirst = sourceSeen.get(sourceKey);
    if (promptFirst) {
      issues.push({ level: 'warn', code: 'prompt-duplicate', message: `pair ${index}: duplicate prompt from pair ${promptFirst}` });
    } else {
      promptSeen.set(promptKey, index);
    }
    if (completionFirst) {
      issues.push({ level: 'fail', code: 'completion-duplicate', message: `pair ${index}: duplicate completion from pair ${completionFirst}` });
    } else {
      completionSeen.set(completionKey, index);
    }
    if (sourceFirst) {
      issues.push({ level: 'fail', code: 'source-duplicate', message: `pair ${index}: duplicate source from pair ${sourceFirst}` });
    } else if (sourceKey) {
      sourceSeen.set(sourceKey, index);
    }
  });

  return {
    pairCount: pairs.length,
    pairHash: pairs.length > 0 ? (await sha256File(file)) : null,
    issues,
  };
}

async function collectFiles(root: string, opts: { includeWeights: boolean }): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (rel === 'train/out' && !opts.includeWeights) continue;
        if (entry.name === '.venv' || entry.name === '__pycache__') continue;
        await walk(full);
      } else if (entry.isFile()) {
        if (!opts.includeWeights && (entry.name.endsWith('.gguf') || entry.name.endsWith('.safetensors'))) continue;
        out.push(full);
      }
    }
  }
  await walk(root);
  return out.sort((a, b) => a.localeCompare(b));
}

export async function getModelStatus(name: string): Promise<ModelStatus> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const corpus = await listCorpus(name);
  const pairs = await listPairs(name);
  const audit = await auditPairs(name);
  const evalQuestions = await readEvalQuestions(name);
  const evalRuns = await listEvalRuns(name);
  const buildModelfile = path.join(model.dir, 'build', 'Modelfile');
  const trainDataset = path.join(model.dir, 'train', 'dataset.jsonl');
  const trainMetadata = path.join(model.dir, 'train', 'metadata.json');
  const trainMetrics = path.join(model.dir, 'train', 'metrics.json');
  const adapterPath = path.join(model.dir, 'train', 'out', 'adapter_model.safetensors');
  const packageMetadata = path.join(model.dir, 'package', 'metadata.json');
  const packageDir = path.join(model.dir, 'package');
  const packageFiles = await fs.readdir(packageDir).catch(() => []);
  const ggufFile = packageFiles.find(f => f.endsWith('.gguf'));
  const ggufPath = ggufFile ? path.join(packageDir, ggufFile) : null;

  return {
    name: model.spec.name,
    dir: model.dir,
    ollamaModel: model.spec.ollamaModel,
    corpusCount: corpus.files.length,
    corpusBytes: corpus.files.reduce((sum, f) => sum + f.bytes, 0),
    pairCount: pairs.pairs.length,
    pairHash: audit.pairHash,
    systemPrompt: Boolean(await readSystemPrompt(name)),
    evalQuestionCount: evalQuestions.length,
    evalRunCount: evalRuns.length,
    reviewedEvalRunCount: evalRuns.filter(r => r.reviewed).length,
    buildModelfile: (await pathExists(buildModelfile)) ? buildModelfile : null,
    trainDataset: (await pathExists(trainDataset)) ? trainDataset : null,
    trainMetadata: (await pathExists(trainMetadata)) ? trainMetadata : null,
    trainMetrics: (await pathExists(trainMetrics)) ? trainMetrics : null,
    adapterHash: await sha256File(adapterPath),
    packageMetadata: (await pathExists(packageMetadata)) ? packageMetadata : null,
    ggufHash: ggufPath ? await sha256File(ggufPath) : null,
    pairIssues: audit.issues,
  };
}

/**
 * Where to find llama.cpp's convert_lora_to_gguf.py.
 * Precedence: C9AI_LLAMA_CPP env (either the checkout dir or the script path
 * itself) > ./external/llama.cpp relative to the current working directory.
 */
export function resolveLlamaCppConverter(): string {
  const envPath = process.env.C9AI_LLAMA_CPP;
  if (envPath) {
    const resolved = path.resolve(envPath);
    if (resolved.toLowerCase().endsWith('.py')) return resolved;
    return path.join(resolved, 'convert_lora_to_gguf.py');
  }
  return path.resolve(process.cwd(), 'external', 'llama.cpp', 'convert_lora_to_gguf.py');
}

async function commandCheck(command: string, args: string[]): Promise<boolean> {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(command, args, { stdio: 'ignore' });
    } catch {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 5000);
    child.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

export async function doctorModel(name: string, providerAvailable: boolean): Promise<DoctorResult> {
  const status = await getModelStatus(name);
  const checks: DoctorCheck[] = [];
  const push = (level: DoctorCheck['level'], checkName: string, detail: string) => {
    checks.push({ level, name: checkName, detail });
  };

  push('ok', 'project', `${status.name} at ${status.dir}`);
  push(status.systemPrompt ? 'ok' : 'warn', 'system prompt', status.systemPrompt ? 'prompts/system.md present' : 'missing prompts/system.md');
  push(status.corpusCount > 0 ? 'ok' : 'fail', 'corpus', `${status.corpusCount} file(s), ${status.corpusBytes} bytes`);
  push(status.pairCount > 0 ? 'ok' : 'fail', 'pairs', `${status.pairCount} pair(s), hash ${shortHash(status.pairHash)}`);
  const pairFails = status.pairIssues.filter(i => i.level === 'fail').length;
  const pairWarnings = status.pairIssues.filter(i => i.level === 'warn').length;
  push(pairFails === 0 ? (pairWarnings === 0 ? 'ok' : 'warn') : 'fail', 'pair audit', `${pairFails} fail, ${pairWarnings} warn`);
  push(providerAvailable ? 'ok' : 'warn', 'pair/eval provider', providerAvailable ? 'current provider is available' : 'current provider is not available');
  push(status.buildModelfile ? 'ok' : 'warn', 'few-shot build', status.buildModelfile ?? 'run models build <name>');
  push(status.evalQuestionCount > 0 ? 'ok' : 'warn', 'eval questions', `${status.evalQuestionCount} question(s)`);
  push(status.reviewedEvalRunCount > 0 ? 'ok' : 'warn', 'reviewed evals', `${status.reviewedEvalRunCount}/${status.evalRunCount} reviewed`);
  push(status.trainDataset ? 'ok' : 'warn', 'training dataset', status.trainDataset ?? 'run models train <name>');
  push(status.trainMetrics ? 'ok' : 'warn', 'training metrics', status.trainMetrics ?? 'metrics.json appears after models train <name> --run completes');
  push(status.adapterHash ? 'ok' : 'warn', 'adapter', status.adapterHash ? `sha256 ${shortHash(status.adapterHash)}` : 'no train/out adapter found');
  push(status.ggufHash ? 'ok' : 'warn', 'package', status.ggufHash ? `gguf sha256 ${shortHash(status.ggufHash)}` : 'no package GGUF found');

  const converter = resolveLlamaCppConverter();
  push(
    (await pathExists(converter)) ? 'ok' : 'warn',
    'llama.cpp converter',
    (await pathExists(converter))
      ? converter
      : `not found: ${converter} (clone llama.cpp there, or set C9AI_LLAMA_CPP)`
  );
  push((await commandCheck('python', ['--version'])) ? 'ok' : 'warn', 'python', 'python --version');
  push((await commandCheck('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'])) ? 'ok' : 'warn', 'gpu', 'nvidia-smi');

  const installed: string[] = await listInstalledOllamaModels().catch(() => [] as string[]);
  push(
    installed.includes(status.ollamaModel) ? 'ok' : 'warn',
    'ollama tag',
    installed.includes(status.ollamaModel) ? `${status.ollamaModel} installed` : `${status.ollamaModel} not listed by Ollama`
  );

  return { checks };
}

export function formatStatus(status: ModelStatus): string {
  const pairFails = status.pairIssues.filter(i => i.level === 'fail').length;
  const pairWarnings = status.pairIssues.filter(i => i.level === 'warn').length;
  return [
    `model:      ${status.name}`,
    `path:       ${status.dir}`,
    `ollama:     ${status.ollamaModel}`,
    `corpus:     ${status.corpusCount} file(s), ${status.corpusBytes} bytes`,
    `pairs:      ${status.pairCount} (sha256 ${shortHash(status.pairHash)})`,
    `pair audit: ${pairFails} fail, ${pairWarnings} warn`,
    `system:     ${status.systemPrompt ? 'present' : 'missing'}`,
    `build:      ${status.buildModelfile ?? '(none)'}`,
    `train:      ${status.trainDataset ?? '(none)'}`,
    `adapter:    ${shortHash(status.adapterHash)}`,
    `package:    ${status.ggufHash ? `gguf sha256 ${shortHash(status.ggufHash)}` : '(none)'}`,
    `evals:      ${status.evalRunCount} run(s), ${status.reviewedEvalRunCount} reviewed, ${status.evalQuestionCount} question(s)`,
    `metadata:   train=${status.trainMetadata ? 'yes' : 'no'} metrics=${status.trainMetrics ? 'yes' : 'no'} package=${status.packageMetadata ? 'yes' : 'no'}`,
  ].join('\n');
}

export function formatDoctor(result: DoctorResult): string {
  return result.checks.map(c => `${c.level.padEnd(4)} ${c.name.padEnd(18)} ${c.detail}`).join('\n');
}

export async function exportModelProject(
  name: string,
  opts: { outDir?: string; includeWeights?: boolean } = {}
): Promise<ExportResult> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const exportDir = path.resolve(opts.outDir ?? path.join(model.dir, 'exports', `${model.spec.name}-${stamp}`));
  await fs.mkdir(exportDir, { recursive: true });

  const files = await collectFiles(model.dir, { includeWeights: Boolean(opts.includeWeights) });
  let copied = 0;
  const manifestFiles: Array<{ path: string; sha256: string | null; bytes: number }> = [];
  for (const file of files) {
    const rel = path.relative(model.dir, file).replace(/\\/g, '/');
    if (rel.startsWith('exports/')) continue;
    const dest = path.join(exportDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(file, dest);
    const stat = await fs.stat(file);
    manifestFiles.push({ path: rel, sha256: await sha256File(file), bytes: stat.size });
    copied++;
  }

  const pairs = await listPairs(name);
  const corpus = await listCorpus(name);
  const audit = await auditPairs(name);
  const manifest = {
    exportedAt: new Date().toISOString(),
    includeWeights: Boolean(opts.includeWeights),
    model: model.spec,
    corpus: { count: corpus.files.length, files: corpus.files },
    pairs: { count: pairs.pairs.length, sha256: audit.pairHash, audit: audit.issues },
    files: manifestFiles,
  };
  const manifestPath = path.join(exportDir, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await fs.writeFile(
    path.join(exportDir, 'MODEL_CARD.md'),
    [
      `# ${model.spec.displayName}`,
      '',
      `Name: ${model.spec.name}`,
      `Runtime: ${model.spec.runtime}`,
      `Ollama tag: ${model.spec.ollamaModel}`,
      `Language: ${model.spec.language ?? '(unspecified)'}`,
      `Description: ${model.spec.description ?? '(none)'}`,
      '',
      '## Data',
      '',
      `Corpus files: ${corpus.files.length}`,
      `Training pairs: ${pairs.pairs.length}`,
      `Pair hash: ${audit.pairHash ?? '(none)'}`,
      '',
      '## License Posture',
      '',
      'Review corpus provenance before sharing weights or generated bundles publicly.',
      opts.includeWeights
        ? 'This export includes weight artifacts because --include-weights was passed.'
        : 'This export excludes GGUF and adapter weight artifacts by default.',
      '',
    ].join('\n'),
    'utf8'
  );
  return { exportDir, manifestPath, fileCount: copied + 1 };
}
