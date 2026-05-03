import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Command } from '../core/types.js';

const DEFAULT_MODEL_DIR = path.resolve(process.cwd(), 'outputs', 'pampa-tiny-lm');
const DEFAULT_SCRIPT = path.resolve(process.cwd(), 'scripts', 'pampa_generate.py');

const USAGE = [
  'usage:',
  '  pampa status                         show tiny Pampa checkpoint status',
  '  pampa sample [prompt]                generate from the tiny Pampa LM',
  '  pampa sample --tokens <n> [prompt]   set generation length',
  '  pampa sample --temperature <t> ...   set sampling temperature',
  '',
  'note: this is the tiny akshara-level LM baseline, not a chat/instruction model.',
].join('\n');

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function takeOption(args: string[], name: string, fallback: string): { value: string; rest: string[] } {
  const rest: string[] = [];
  let value = fallback;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name) {
      const next = args[i + 1];
      if (next) {
        value = next;
        i += 1;
      }
    } else {
      const current = args[i];
      if (current) rest.push(current);
    }
  }
  return { value, rest };
}

async function runPython(args: string[], cwd: string): Promise<{ exitCode: number; output: string }> {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn('python', args, {
        cwd,
        env: {
          ...process.env,
          PYTHONUTF8: process.env.PYTHONUTF8 ?? '1',
          PYTHONIOENCODING: process.env.PYTHONIOENCODING ?? 'utf-8',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({ exitCode: 1, output: err instanceof Error ? err.message : String(err) });
      return;
    }

    let output = '';
    child.stdout?.on('data', chunk => {
      output += chunk.toString();
    });
    child.stderr?.on('data', chunk => {
      output += chunk.toString();
    });
    child.on('error', err => {
      output += err.message;
      resolve({ exitCode: 1, output });
    });
    child.on('close', code => resolve({ exitCode: code ?? 0, output: output.trim() }));
  });
}

export const pampaCommand: Command = {
  name: 'pampa',
  description: 'Generate from the local Pampa tiny LM checkpoint',
  run: async (args, ctx) => {
    const action = (args[0] ?? 'sample').toLowerCase();
    if (action === 'help' || action === '-h' || action === '--help') {
      ctx.emit({ kind: 'system', text: USAGE });
      return;
    }

    if (action === 'status') {
      const tokenizerPath = path.join(DEFAULT_MODEL_DIR, 'pampa_tokenizer.json');
      const checkpointPath = path.join(DEFAULT_MODEL_DIR, 'pampa_tiny_lm.pt');
      const metricsPath = path.join(DEFAULT_MODEL_DIR, 'metrics.jsonl');
      const configPath = path.join(DEFAULT_MODEL_DIR, 'config.json');
      const config = await readJson(configPath);
      const tokenizer = await readJson(tokenizerPath);
      const lines = [
        `model dir:   ${DEFAULT_MODEL_DIR}`,
        `checkpoint:  ${(await pathExists(checkpointPath)) ? 'present' : 'missing'}`,
        `tokenizer:   ${(await pathExists(tokenizerPath)) ? 'present' : 'missing'}`,
        `metrics:     ${(await pathExists(metricsPath)) ? 'present' : 'missing'}`,
      ];
      if (tokenizer?.vocab_size) lines.push(`vocab size:  ${String(tokenizer.vocab_size)}`);
      if (config?.max_steps) lines.push(`steps:       ${String(config.max_steps)}`);
      if (config?.device) lines.push(`device:      ${String(config.device)}`);
      lines.push('kind:        tiny akshara LM baseline, not chat');
      ctx.emit({ kind: 'system', text: lines.join('\n') });
      return;
    }

    if (action !== 'sample' && action !== 'generate') {
      ctx.emit({ kind: 'error', text: `unknown pampa action: ${action}\n\n${USAGE}` });
      return;
    }

    const raw = args.slice(1);
    const tokensOpt = takeOption(raw, '--tokens', '180');
    const tempOpt = takeOption(tokensOpt.rest, '--temperature', '0.85');
    const modelOpt = takeOption(tempOpt.rest, '--model-dir', DEFAULT_MODEL_DIR);
    const prompt = tempOpt.rest.join(' ').trim() || 'ಪಂಪ';

    if (!(await pathExists(DEFAULT_SCRIPT))) {
      ctx.emit({ kind: 'error', text: `pampa generator script missing: ${DEFAULT_SCRIPT}` });
      return;
    }
    if (!(await pathExists(path.join(modelOpt.value, 'pampa_tiny_lm.pt')))) {
      ctx.emit({
        kind: 'error',
        text: `pampa checkpoint missing: ${path.join(modelOpt.value, 'pampa_tiny_lm.pt')}\nrun: npm run pampa:train-tiny`,
      });
      return;
    }

    ctx.emit({
      kind: 'system',
      text: `pampa: generating tiny LM sample from "${prompt}"`,
    });

    const result = await runPython(
      [
        DEFAULT_SCRIPT,
        prompt,
        '--model-dir',
        modelOpt.value,
        '--tokens',
        tokensOpt.value,
        '--temperature',
        tempOpt.value,
      ],
      process.cwd()
    );
    if (result.exitCode !== 0) {
      ctx.emit({ kind: 'error', text: `pampa generate failed:\n${result.output}` });
      return;
    }
    ctx.emit({ kind: 'provider', text: result.output });
  },
};
