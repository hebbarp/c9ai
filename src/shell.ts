import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

export interface ShellRunResult {
  exitCode: number;
}

export async function runShell(
  command: string,
  onChunk: (chunk: string) => void
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

  return new Promise(resolve => {
    const child = spawn(trimmed, { shell: true });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d: string) => onChunk(d));
    child.stderr.on('data', (d: string) => onChunk(d));
    child.on('error', err => {
      onChunk(`shell spawn error: ${err.message}\n`);
      resolve({ exitCode: -1 });
    });
    child.on('exit', code => resolve({ exitCode: code ?? -1 }));
  });
}
