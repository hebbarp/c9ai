import { spawn } from 'node:child_process';
import type { Command } from '../core/types.js';

interface GhCallResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runGh(args: string[]): Promise<GhCallResult> {
  return new Promise(resolve => {
    const child = spawn('gh', args, { shell: true });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d: string) => (stdout += d));
    child.stderr.on('data', (d: string) => (stderr += d));
    child.on('error', err => resolve({ stdout, stderr: err.message, exitCode: -1 }));
    child.on('exit', code => resolve({ stdout, stderr, exitCode: code ?? -1 }));
  });
}

export const todosCommand: Command = {
  name: 'todos',
  description: 'Manage GitHub Issues as a work backlog',
  run: async (args, ctx) => {
    const action = (args[0] ?? 'list').toLowerCase();
    switch (action) {
      case 'list': {
        const res = await runGh([
          'issue',
          'list',
          '--state',
          'open',
          '--limit',
          '20',
          '--json',
          'number,title,labels,url',
        ]);
        if (res.exitCode !== 0) {
          ctx.emit({
            kind: 'error',
            text: `gh failed (exit ${res.exitCode}): ${res.stderr || res.stdout}`,
          });
          return;
        }
        try {
          const issues = JSON.parse(res.stdout) as Array<{
            number: number;
            title: string;
            labels: Array<{ name: string }>;
            url: string;
          }>;
          if (issues.length === 0) {
            ctx.emit({ kind: 'system', text: 'no open issues' });
            return;
          }
          const lines = issues.map(
            i =>
              `#${i.number} ${i.title}${
                i.labels.length ? ` [${i.labels.map(l => l.name).join(', ')}]` : ''
              }`
          );
          ctx.emit({ kind: 'system', text: lines.join('\n') });
        } catch (err) {
          ctx.emit({
            kind: 'error',
            text: `parse error: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        return;
      }
      case 'add': {
        const title = args.slice(1).join(' ').trim();
        if (!title) {
          ctx.emit({ kind: 'error', text: 'usage: todos add <title>' });
          return;
        }
        const res = await runGh(['issue', 'create', '--title', title, '--body', '']);
        if (res.exitCode !== 0) {
          ctx.emit({
            kind: 'error',
            text: `gh failed: ${res.stderr || res.stdout}`,
          });
          return;
        }
        ctx.emit({ kind: 'system', text: res.stdout.trim() });
        return;
      }
      case 'sync': {
        ctx.emit({ kind: 'system', text: 'sync: noop in alpha (todos are GitHub-backed already)' });
        return;
      }
      default:
        ctx.emit({
          kind: 'error',
          text: `unknown action: ${action}. usage: todos [list|add|sync]`,
        });
    }
  },
};
