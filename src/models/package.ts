import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadModel, readSystemPrompt } from './registry.js';
import { hashFiles, resolveLlamaCppConverter, sha256File } from './status.js';

export interface PackageLoraOptions {
  pythonBin?: string;
  converterPath?: string;
  baseModel?: string;
  huggingfaceModel?: string;
  outDir?: string;
  outType?: 'f32' | 'f16' | 'bf16' | 'q8_0' | 'auto';
  testTag?: string;
  create?: boolean;
  promote?: boolean;
  backupTag?: string;
  versionedTags?: boolean;
  testPrompt?: string;
}

export interface PackageLoraResult {
  packageDir: string;
  adapterDir: string;
  ggufPath: string;
  modelfilePath: string;
  baseModel: string;
  huggingfaceModel: string;
  converterPath: string;
  pythonBin: string;
  testTag: string;
  projectTag: string;
  backupTag: string;
  createdTestTag: boolean;
  promoted: boolean;
  metadataPath: string;
  ggufHash: string | null;
  packageHash: string | null;
  testExitCode: number | null;
}

interface AdapterConfig {
  base_model_name_or_path?: string;
}

const DEFAULT_BASE = 'qwen2.5:1.5b';
const DEFAULT_HF = 'Qwen/Qwen2.5-1.5B-Instruct';

function tagStem(tag: string): string {
  return tag.replace(/:latest$/, '');
}

function escapeTriple(text: string): string {
  return text.replace(/"""/g, '\\"\\"\\"');
}

function toModelfilePath(p: string): string {
  return path.resolve(p).replace(/\\/g, '/');
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readAdapterConfig(adapterDir: string): Promise<AdapterConfig> {
  const p = path.join(adapterDir, 'adapter_config.json');
  try {
    return JSON.parse(await fs.readFile(p, 'utf8')) as AdapterConfig;
  } catch {
    return {};
  }
}

function hfCacheModelDir(huggingfaceModel: string): string {
  const encoded = `models--${huggingfaceModel.replace(/\//g, '--')}`;
  return path.join(os.homedir(), '.cache', 'huggingface', 'hub', encoded);
}

async function findHfSnapshot(huggingfaceModel: string): Promise<string | null> {
  const snapshots = path.join(hfCacheModelDir(huggingfaceModel), 'snapshots');
  let entries;
  try {
    entries = await fs.readdir(snapshots, { withFileTypes: true });
  } catch {
    return null;
  }
  const candidates = entries.filter(e => e.isDirectory()).map(e => path.join(snapshots, e.name));
  for (const candidate of candidates) {
    if (await pathExists(path.join(candidate, 'config.json'))) return candidate;
  }
  return null;
}

function defaultPythonBin(modelDir: string): string {
  // venv layout differs by platform: Scripts\python.exe on Windows, bin/python elsewhere.
  return process.platform === 'win32'
    ? path.join(modelDir, 'train', '.venv', 'Scripts', 'python.exe')
    : path.join(modelDir, 'train', '.venv', 'bin', 'python');
}

async function runProcess(
  command: string,
  args: string[],
  cwd: string,
  onLine: (line: string) => void
): Promise<number> {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env: {
          ...process.env,
          PYTHONUTF8: process.env.PYTHONUTF8 ?? '1',
          PYTHONIOENCODING: process.env.PYTHONIOENCODING ?? 'utf-8',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      onLine(`error: ${err instanceof Error ? err.message : String(err)}`);
      resolve(1);
      return;
    }

    let buffer = '';
    const flushLines = (chunk: Buffer) => {
      buffer += chunk.toString();
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        if (line.trim()) onLine(line);
      }
    };

    child.stdout?.on('data', flushLines);
    child.stderr?.on('data', flushLines);
    child.on('error', err => {
      onLine(`error: ${err.message}`);
      resolve(1);
    });
    child.on('close', code => {
      const tail = buffer.replace(/\r/g, '').trim();
      if (tail) onLine(tail);
      resolve(code ?? 0);
    });
  });
}

async function runOllama(args: string[], cwd: string, onLine: (line: string) => void): Promise<number> {
  return runProcess('ollama', args, cwd, onLine);
}

export async function packageLoraModel(
  name: string,
  opts: PackageLoraOptions,
  onLine: (line: string) => void
): Promise<PackageLoraResult> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);

  const adapterDir = path.join(model.dir, 'train', 'out');
  if (!(await pathExists(path.join(adapterDir, 'adapter_config.json')))) {
    throw new Error(`missing trained adapter: ${adapterDir}; run models train ${name} --run first`);
  }
  if (!(await pathExists(path.join(adapterDir, 'adapter_model.safetensors')))) {
    throw new Error(`missing adapter weights: ${path.join(adapterDir, 'adapter_model.safetensors')}`);
  }

  const adapterConfig = await readAdapterConfig(adapterDir);
  const huggingfaceModel =
    opts.huggingfaceModel ??
    model.spec.huggingfaceModel ??
    adapterConfig.base_model_name_or_path ??
    DEFAULT_HF;
  const baseModel = opts.baseModel ?? model.spec.baseModel ?? DEFAULT_BASE;
  const pythonBin = opts.pythonBin ?? defaultPythonBin(model.dir);
  const converterPath = path.resolve(opts.converterPath ?? resolveLlamaCppConverter());
  const packageDir = path.resolve(opts.outDir ?? path.join(model.dir, 'package'));
  const outType = opts.outType ?? model.spec.packaging?.outType ?? 'f16';
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const ggufPath = path.join(packageDir, `${model.spec.name}-lora-${outType}.gguf`);
  const modelfilePath = path.join(packageDir, 'Modelfile');
  const testTag =
    opts.testTag ??
    (opts.versionedTags
      ? `${tagStem(model.spec.ollamaModel)}-lora-${runId}:latest`
      : `${tagStem(model.spec.ollamaModel)}-lora:latest`);
  const backupTag =
    opts.backupTag ??
    (opts.versionedTags
      ? `${tagStem(model.spec.ollamaModel)}:fewshot-${runId}`
      : `${tagStem(model.spec.ollamaModel)}:fewshot`);

  if (!(await pathExists(converterPath))) {
    throw new Error(
      `llama.cpp converter not found: ${converterPath}; clone https://github.com/ggml-org/llama.cpp to external/llama.cpp, set C9AI_LLAMA_CPP to your checkout, or pass --converter <path>`
    );
  }
  if (!(await pathExists(pythonBin))) {
    throw new Error(`python not found: ${pythonBin}; pass --python <path-to-venv-python>`);
  }

  await fs.mkdir(packageDir, { recursive: true });

  const localBase = await findHfSnapshot(huggingfaceModel);
  const convertArgs = [
    converterPath,
    '--outtype',
    outType,
    '--outfile',
    ggufPath,
    ...(localBase ? ['--base', localBase] : ['--base-model-id', huggingfaceModel]),
    adapterDir,
  ];

  onLine(`convert adapter -> GGUF (${localBase ? `base cache: ${localBase}` : `hf base: ${huggingfaceModel}`})`);
  const convertExit = await runProcess(pythonBin, convertArgs, process.cwd(), onLine);
  if (convertExit !== 0) {
    throw new Error(`convert_lora_to_gguf.py failed (exit ${convertExit})`);
  }

  const system = (await readSystemPrompt(name)) ?? '';
  const lines: string[] = [
    `# Generated by c9ai for model project: ${model.spec.name}`,
    `# Base: ${baseModel}`,
    `# Adapter: ${ggufPath}`,
    '',
    `FROM ${baseModel}`,
    `ADAPTER ${toModelfilePath(ggufPath)}`,
    '',
  ];
  if (system.trim()) {
    lines.push(`SYSTEM """${escapeTriple(system.trim())}"""`);
    lines.push('');
  }
  lines.push('PARAMETER temperature 0.7');
  lines.push('PARAMETER top_p 0.9');
  lines.push('');
  await fs.writeFile(modelfilePath, lines.join('\n'), 'utf8');

  let createdTestTag = false;
  let promoted = false;
  let testExitCode: number | null = null;
  if (opts.create ?? true) {
    onLine(`ollama create ${testTag} -f ${modelfilePath}`);
    const createExit = await runOllama(['create', testTag, '-f', modelfilePath], process.cwd(), onLine);
    if (createExit !== 0) {
      throw new Error(`ollama create ${testTag} failed (exit ${createExit})`);
    }
    createdTestTag = true;
  }

  if (opts.testPrompt) {
    onLine(`ollama run ${testTag} ${JSON.stringify(opts.testPrompt)}`);
    testExitCode = await runOllama(['run', testTag, opts.testPrompt], process.cwd(), onLine);
    if (testExitCode !== 0) {
      throw new Error(`ollama run ${testTag} failed (exit ${testExitCode})`);
    }
  }

  if (opts.promote) {
    onLine(`ollama cp ${model.spec.ollamaModel} ${backupTag}`);
    const copyExit = await runOllama(['cp', model.spec.ollamaModel, backupTag], process.cwd(), onLine);
    if (copyExit !== 0) {
      throw new Error(`ollama cp ${model.spec.ollamaModel} ${backupTag} failed (exit ${copyExit})`);
    }
    onLine(`ollama create ${model.spec.ollamaModel} -f ${modelfilePath}`);
    const promoteExit = await runOllama(['create', model.spec.ollamaModel, '-f', modelfilePath], process.cwd(), onLine);
    if (promoteExit !== 0) {
      throw new Error(`ollama create ${model.spec.ollamaModel} failed (exit ${promoteExit})`);
    }
    promoted = true;
  }

  const metadataPath = path.join(packageDir, 'metadata.json');
  const ggufHash = await sha256File(ggufPath);
  const packageHash = await hashFiles([ggufPath, modelfilePath]);
  await fs.writeFile(
    metadataPath,
    JSON.stringify(
      {
        runId,
        createdAt: new Date().toISOString(),
        model: model.spec.name,
        projectTag: model.spec.ollamaModel,
        testTag,
        backupTag,
        baseModel,
        huggingfaceModel,
        converterPath,
        pythonBin,
        adapterDir,
        ggufPath,
        ggufHash,
        packageHash,
        createdTestTag,
        promoted,
        testPrompt: opts.testPrompt ?? null,
        testExitCode,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  return {
    packageDir,
    adapterDir,
    ggufPath,
    modelfilePath,
    baseModel,
    huggingfaceModel,
    converterPath,
    pythonBin,
    testTag,
    projectTag: model.spec.ollamaModel,
    backupTag,
    createdTestTag,
    promoted,
    metadataPath,
    ggufHash,
    packageHash,
    testExitCode,
  };
}
