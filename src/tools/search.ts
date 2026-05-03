import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { resolveInScope, searchRoots, isInside } from '../scope.js';
import type { Tool, ToolContext, ToolResult } from './types.js';

const MAX_MATCHES = 200;
const MAX_FILES_WALKED = 20000;
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  '.next',
  '.turbo',
  '__pycache__',
  '.venv',
  'venv',
  '.cache',
]);

function patternToRegex(pattern: string): RegExp {
  // Minimal glob → regex. Handles `**`, `*`, `?`, and literal chars.
  // Not a full glob (no brace expansion) but enough for personal corpus use.
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i]!;
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i += 2;
        continue;
      }
      out += '[^/\\\\]*';
      i += 1;
      continue;
    }
    if (c === '?') {
      out += '[^/\\\\]';
      i += 1;
      continue;
    }
    if (/[.+^${}()|[\]\\]/.test(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
    i += 1;
  }
  return new RegExp(`^${out}$`);
}

async function* walk(
  root: string,
  signal?: AbortSignal,
  filesWalked = { count: 0 }
): AsyncGenerator<string> {
  if (signal?.aborted) return;
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (signal?.aborted) return;
    if (filesWalked.count >= MAX_FILES_WALKED) return;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full, signal, filesWalked);
    } else if (entry.isFile()) {
      filesWalked.count += 1;
      yield full;
    }
  }
}

const fsGlob: Tool = {
  name: 'fs.glob',
  description:
    'Find files matching a glob pattern (e.g. **/*.md). Searches the current working directory. ' +
    'Skips node_modules, .git, dist, etc.',
  positional: 'pattern',
  args: [
    { name: 'pattern', description: 'glob, e.g. **/*.md or src/**/*.ts', required: true },
    { name: 'root', description: 'restrict to a directory under cwd (optional)', required: false },
  ],
  run: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const pattern = typeof args.pattern === 'string' ? args.pattern : '';
    if (!pattern) return { ok: false, error: 'usage: @fs.glob <pattern>' };
    const scope = ctx.scope ?? { roots: [] };
    const rootArg = typeof args.root === 'string' && args.root ? args.root : null;
    let roots: string[];
    if (rootArg) {
      try {
        roots = [resolveInScope(rootArg, ctx.cwd, scope)];
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    } else {
      roots = searchRoots(ctx.cwd, scope);
    }

    const re = patternToRegex(pattern);
    const matches: string[] = [];
    const filesWalked = { count: 0 };
    for (const root of roots) {
      for await (const file of walk(root, ctx.signal, filesWalked)) {
        const rel = path.relative(root, file).replace(/\\/g, '/');
        if (re.test(rel) || re.test(path.basename(file))) {
          matches.push(file);
          if (matches.length >= MAX_MATCHES) break;
        }
      }
      if (matches.length >= MAX_MATCHES) break;
    }

    if (matches.length === 0) {
      ctx.emit('(no matches)\n');
      return { ok: true, output: '(no matches)' };
    }
    const out = matches.join('\n') + (matches.length === MAX_MATCHES ? `\n…[capped at ${MAX_MATCHES}]` : '');
    ctx.emit(out + '\n');
    return { ok: true, output: out };
  },
};

interface GrepHit {
  file: string;
  line: number;
  text: string;
}

async function ripgrepAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const child = spawn('rg', ['--version'], { shell: true, stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('exit', code => resolve(code === 0));
  });
}

function ripgrepSearch(
  pattern: string,
  roots: string[],
  glob: string | null,
  signal: AbortSignal | undefined,
  emit: (chunk: string) => void
): Promise<GrepHit[]> {
  return new Promise(resolve => {
    const args = ['--no-heading', '--line-number', '--color', 'never', '--max-count', String(MAX_MATCHES)];
    if (glob) args.push('--glob', glob);
    args.push('--', pattern, ...roots);
    const child = spawn('rg', args, { shell: false });
    let buf = '';
    const hits: GrepHit[] = [];

    if (signal) {
      const onAbort = () => child.kill();
      signal.addEventListener('abort', onAbort, { once: true });
    }

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buf += chunk;
      let nl = buf.indexOf('\n');
      while (nl >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const m = line.match(/^(.+?):(\d+):(.*)$/);
        if (m) {
          hits.push({ file: m[1]!, line: Number(m[2]!), text: m[3]! });
          emit(line + '\n');
        }
        nl = buf.indexOf('\n');
        if (hits.length >= MAX_MATCHES) {
          child.kill();
          break;
        }
      }
    });
    child.stderr.on('data', () => { /* swallow rg's "no matches" stderr noise */ });
    child.on('error', () => resolve(hits));
    child.on('exit', () => resolve(hits));
  });
}

const TEXT_FILE_RE = /\.(md|markdown|txt|json|jsonl|ya?ml|toml|ini|csv|tsv|js|jsx|ts|tsx|mjs|cjs|py|rb|rs|go|java|kt|swift|c|cc|cpp|h|hpp|cs|sh|bash|zsh|ps1|sql|html|css|scss|xml|svg)$/i;

async function jsGrepSearch(
  pattern: string,
  roots: string[],
  glob: string | null,
  signal: AbortSignal | undefined,
  emit: (chunk: string) => void
): Promise<GrepHit[]> {
  let re: RegExp;
  try {
    re = new RegExp(pattern, 'g');
  } catch {
    re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  }
  const globRe = glob ? patternToRegex(glob) : null;
  const hits: GrepHit[] = [];
  const filesWalked = { count: 0 };

  for (const root of roots) {
    for await (const file of walk(root, signal, filesWalked)) {
      if (signal?.aborted) return hits;
      if (hits.length >= MAX_MATCHES) return hits;
      const rel = path.relative(root, file).replace(/\\/g, '/');
      if (globRe && !globRe.test(rel) && !globRe.test(path.basename(file))) continue;
      if (!globRe && !TEXT_FILE_RE.test(file)) continue;
      let body: string;
      try {
        body = await fs.readFile(file, 'utf8');
      } catch {
        continue;
      }
      const lines = body.split('\n');
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0;
        if (re.test(lines[i]!)) {
          const hit = { file, line: i + 1, text: lines[i]! };
          hits.push(hit);
          emit(`${file}:${i + 1}:${lines[i]}\n`);
          if (hits.length >= MAX_MATCHES) return hits;
        }
      }
    }
  }
  return hits;
}

const fsGrep: Tool = {
  name: 'fs.grep',
  description:
    'Search file contents for a regex across the current working directory. Uses ripgrep (rg) when available, ' +
    'falls back to a JS regex walker. Auto-skips node_modules / .git / dist / build.',
  positional: 'pattern',
  args: [
    { name: 'pattern', description: 'regex pattern to search for', required: true },
    { name: 'glob', description: 'restrict to files matching this glob (e.g. **/*.md)', required: false },
    { name: 'root', description: 'restrict to a directory under cwd (optional)', required: false },
  ],
  run: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const pattern = typeof args.pattern === 'string' ? args.pattern : '';
    if (!pattern) return { ok: false, error: 'usage: @fs.grep <pattern> [glob=...] [root=...]' };
    const glob = typeof args.glob === 'string' && args.glob ? args.glob : null;
    const scope = ctx.scope ?? { roots: [] };
    const rootArg = typeof args.root === 'string' && args.root ? args.root : null;
    let roots: string[];
    if (rootArg) {
      try {
        roots = [resolveInScope(rootArg, ctx.cwd, scope)];
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    } else {
      roots = searchRoots(ctx.cwd, scope);
    }

    const hasRg = await ripgrepAvailable();
    const hits = hasRg
      ? await ripgrepSearch(pattern, roots, glob, ctx.signal, ctx.emit)
      : await jsGrepSearch(pattern, roots, glob, ctx.signal, ctx.emit);

    // Defensive: drop any hits that escape scope (shouldn't happen since
    // roots are pre-validated, but rg doesn't know about our policy).
    const safe = hits.filter(h => roots.some(r => isInside(h.file, r)));

    if (safe.length === 0) {
      ctx.emit('(no matches)\n');
      return { ok: true, output: '(no matches)' };
    }
    const summary = `(${safe.length}${safe.length >= MAX_MATCHES ? '+' : ''} match${safe.length === 1 ? '' : 'es'})`;
    return { ok: true, output: summary };
  },
};

export const searchTools: Tool[] = [fsGlob, fsGrep];
