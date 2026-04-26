import { spawn } from 'node:child_process';
import type { Tool, ToolContext, ToolResult } from './types.js';

/**
 * Two-tier safety model:
 *
 * - HARD_BLOCK: catastrophic, irrecoverable. Always refused unless the
 *   `C9AI_ALLOW_DESTRUCTIVE=1` escape hatch is set. (Wiping a filesystem
 *   from inside an agent loop is never the right interactive choice.)
 *
 * - CONFIRM: legitimately useful but risky enough to need explicit consent
 *   each time (or once-per-session). Routed through `ctx.confirm` if the
 *   host provides one. Without a confirm callback, a `CONFIRM` pattern
 *   fails closed.
 *
 * Single-file `rm file.txt` and friends are not in either tier — they pass
 * straight through.
 */
export interface PatternMatch {
  name: string;
  tier: 'hard' | 'confirm';
}

const HARD_BLOCK_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'format drive',     regex: /\bformat\s+[a-zA-Z]:/ },
  { name: 'dd write',         regex: /\bdd\s+[^|;&]*\bof=/ },
  { name: 'mkfs',             regex: /\bmkfs[.\s]/ },
  { name: 'raw device write', regex: />\s*\/dev\/(sd|hd|nvme|disk)/ },
  { name: '/etc overwrite',   regex: />\s*\/etc\// },
  { name: 'fork bomb',        regex: /:\s*\(\s*\)\s*\{/ },
];

const CONFIRM_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'rm -rf',           regex: /\brm\s+[^|;&]*-[a-zA-Z]*[rRfF]/ },
  { name: 'del /s|/q',        regex: /\bdel\s+[^|;&]*\/[sSqQ]/ },
  { name: 'rmdir /s|rd /s',   regex: /\b(rmdir|rd)\s+[^|;&]*\/[sS]/ },
  { name: 'sudo',             regex: /\bsudo\s+/ },
  { name: 'su',               regex: /(^|;|&&|\|\|)\s*su\s+/ },
  { name: 'curl | shell',     regex: /\bcurl[^|;]*\|\s*(sh|bash|zsh|fish)\b/ },
  { name: 'wget | shell',     regex: /\bwget[^|;]*\|\s*(sh|bash|zsh|fish)\b/ },
  { name: 'git push --force', regex: /\bgit\s+push\s+[^|;&]*(-f\b|--force)/ },
  { name: 'git reset --hard', regex: /\bgit\s+reset\s+[^|;&]*--hard/ },
  { name: 'git clean -f',     regex: /\bgit\s+clean\s+[^|;&]*-[a-zA-Z]*[fF]/ },
  { name: 'npm publish',      regex: /\bnpm\s+publish\b/ },
  { name: 'cargo publish',    regex: /\bcargo\s+publish\b/ },
  { name: 'force kill',       regex: /\b(taskkill\s+\/[fF]|kill\s+-9)\b/ },
  { name: 'chmod recursive',  regex: /\bchmod\s+[^|;&]*(-R\b|--recursive)/ },
  { name: 'chmod 777',        regex: /\bchmod\s+[^|;&]*\b777\b/ },
  { name: 'chown',            regex: /\bchown\b/ },
];

export function detectPattern(cmd: string): PatternMatch | null {
  for (const p of HARD_BLOCK_PATTERNS) {
    if (p.regex.test(cmd)) return { name: p.name, tier: 'hard' };
  }
  for (const p of CONFIRM_PATTERNS) {
    if (p.regex.test(cmd)) return { name: p.name, tier: 'confirm' };
  }
  return null;
}

const DEFAULT_TIMEOUT_SEC = 120;

function shellTimeoutMs(): number {
  const v = process.env.C9AI_SHELL_TIMEOUT_SEC;
  if (!v) return DEFAULT_TIMEOUT_SEC * 1000;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n * 1000 : DEFAULT_TIMEOUT_SEC * 1000;
}

export interface RunShellOpts {
  cwd: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  emit: (chunk: string) => void;
}

export function runShellCommand(
  cmd: string,
  opts: RunShellOpts
): Promise<ToolResult> {
  return new Promise(resolve => {
    if (opts.signal?.aborted) {
      resolve({ ok: false, error: 'aborted' });
      return;
    }

    const child = spawn(cmd, { shell: true, cwd: opts.cwd });
    const timeoutMs = opts.timeoutMs ?? shellTimeoutMs();
    let timedOut = false;
    let aborted = false;
    let captured = '';

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    const onAbort = () => {
      aborted = true;
      child.kill();
    };
    if (opts.signal) opts.signal.addEventListener('abort', onAbort, { once: true });

    const cleanup = () => {
      clearTimeout(timer);
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
    };

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d: string) => {
      captured += d;
      opts.emit(d);
    });
    child.stderr.on('data', (d: string) => {
      captured += d;
      opts.emit(d);
    });

    child.on('error', err => {
      cleanup();
      resolve({ ok: false, error: err.message });
    });

    child.on('exit', code => {
      cleanup();
      if (aborted) {
        resolve({ ok: false, error: 'aborted' });
      } else if (timedOut) {
        resolve({
          ok: false,
          output: captured,
          error: `timeout after ${Math.round(timeoutMs / 1000)}s`,
        });
      } else {
        resolve({
          ok: code === 0,
          output: captured,
          error: code === 0 ? undefined : `exit ${code}`,
        });
      }
    });
  });
}

/**
 * Gate: returns null to proceed, or an error string to abort. Honors the
 * C9AI_ALLOW_DESTRUCTIVE bypass and routes confirm-tier patterns through
 * `ctx.confirm` if available.
 */
export async function gateShellCommand(
  cmd: string,
  ctx: ToolContext
): Promise<string | null> {
  if (process.env.C9AI_ALLOW_DESTRUCTIVE === '1') return null;

  const match = detectPattern(cmd);
  if (!match) return null;

  if (match.tier === 'hard') {
    return (
      `blocked catastrophic pattern: ${match.name}\n` +
      `command: ${cmd}\n` +
      `set C9AI_ALLOW_DESTRUCTIVE=1 to override.`
    );
  }

  // confirm tier
  if (!ctx.confirm) {
    return (
      `requires confirmation: ${match.name}\n` +
      `command: ${cmd}\n` +
      `run from the c9ai TUI to approve interactively, or set C9AI_ALLOW_DESTRUCTIVE=1.`
    );
  }

  const decision = await ctx.confirm({ reason: match.name, command: cmd });
  if (decision === 'deny') {
    return `denied: ${match.name}`;
  }
  return null;
}

const shellRun: Tool = {
  name: 'shell.run',
  description:
    'Run a shell command in the current working directory. ' +
    'Catastrophic patterns hard-block; risky-but-legitimate patterns ' +
    '(rm -rf, force push, npm publish, sudo, chmod -R, etc) prompt for confirmation.',
  positional: 'cmd',
  args: [{ name: 'cmd', description: 'shell command to execute', required: true }],
  run: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const cmd = typeof args.cmd === 'string' ? args.cmd : '';
    if (!cmd.trim()) {
      return { ok: false, error: 'usage: @shell.run <command>' };
    }

    const gateError = await gateShellCommand(cmd, ctx);
    if (gateError) {
      ctx.emit(gateError + '\n');
      return { ok: false, error: gateError };
    }

    return runShellCommand(cmd, {
      cwd: ctx.cwd,
      signal: ctx.signal,
      emit: ctx.emit,
    });
  },
};

export const shellTools: Tool[] = [shellRun];
