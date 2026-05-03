import os from 'node:os';
import path from 'node:path';
import { gateShellCommand, runShellCommand } from './tools/shell.js';
import type { ConfirmRequest, ConfirmResponse } from './tools/types.js';

export interface ShellRunResult {
  exitCode: number;
}

export interface ShellRunOptions {
  cwd?: string;
  signal?: AbortSignal;
  confirm?: (req: ConfirmRequest) => Promise<ConfirmResponse>;
}

export async function runShell(
  command: string,
  onChunk: (chunk: string) => void,
  opts: ShellRunOptions = {}
): Promise<ShellRunResult> {
  const trimmed = command.trim();
  if (!trimmed) return { exitCode: 0 };

  if (trimmed === 'cd' || trimmed.startsWith('cd ') || trimmed === 'cd ~') {
    const rest = trimmed.slice(2).trim();
    const target = !rest || rest === '~' ? os.homedir() : path.resolve(rest);
    try {
      process.chdir(target);
      onChunk(`cwd: ${process.cwd()}\n`);
      return { exitCode: 0 };
    } catch (err) {
      onChunk(`cd failed: ${err instanceof Error ? err.message : String(err)}\n`);
      return { exitCode: 1 };
    }
  }

  const cwd = opts.cwd ?? process.cwd();
  const gateError = await gateShellCommand(trimmed, {
    cwd,
    signal: opts.signal,
    confirm: opts.confirm,
    emit: onChunk,
  });
  if (gateError) {
    onChunk(gateError + '\n');
    return { exitCode: 1 };
  }

  const result = await runShellCommand(trimmed, {
    cwd,
    signal: opts.signal,
    emit: onChunk,
  });
  if (!result.ok && result.error) {
    onChunk(result.error + '\n');
  }
  return { exitCode: result.ok ? 0 : 1 };
}
