import type { Command } from '../core/types.js';
import { getRunner } from '../matsya/poller.js';
import { setUserEnvVar, USER_ENV_PATH } from '../core/envFile.js';

function fmtAge(ts: number | null): string {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

const USAGE = [
  'usage:',
  '  matsya status                  show config + last check',
  '  matsya setup <api-key>         save MATSYA_API_KEY to ~/.c9ai/.env',
  '  matsya base <url>              set MATSYA_BASE_URL (default https://matsyaai.com)',
  '  matsya list                    fetch pending items (no claim)',
  '  matsya check                   fetch + claim + run the next item',
].join('\n');

export const matsyaCommand: Command = {
  name: 'matsya',
  description: 'On-demand Matsya queue runner (status | setup | base | list | check)',
  run: async (args, ctx) => {
    const action = (args[0] ?? 'status').toLowerCase();
    const runner = getRunner();

    switch (action) {
      case 'help':
      case '-h':
      case '--help':
        ctx.emit({ kind: 'system', text: USAGE });
        return;

      case 'setup': {
        const key = (args[1] ?? '').trim();
        if (!key) {
          ctx.emit({ kind: 'error', text: 'usage: matsya setup <api-key>' });
          return;
        }
        await setUserEnvVar('MATSYA_API_KEY', key);
        const masked = key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-4)}` : '***';
        ctx.emit({
          kind: 'system',
          text: `matsya: saved key ${masked} to ${USER_ENV_PATH}`,
        });
        return;
      }

      case 'base': {
        const url = (args[1] ?? '').trim();
        if (!url) {
          ctx.emit({ kind: 'error', text: 'usage: matsya base <url>' });
          return;
        }
        await setUserEnvVar('MATSYA_BASE_URL', url);
        ctx.emit({ kind: 'system', text: `matsya: base url set to ${url}` });
        return;
      }

      case 'status': {
        const s = runner.status();
        const lines = [
          `key:        ${s.hasKey ? 'set' : 'not set (run `matsya setup <key>`)'}`,
          `base url:   ${s.baseUrl ?? '(default)'}`,
          `worker:     ${s.workerId}`,
          `last check: ${fmtAge(s.lastCheckAt)}`,
        ];
        if (!s.configured) {
          lines.push('runner:     not configured (open the TUI to enable)');
        }
        if (s.lastError) lines.push(`last error: ${s.lastError}`);
        ctx.emit({ kind: 'system', text: lines.join('\n') });
        return;
      }

      case 'list': {
        const r = await runner.list();
        if (!r.ok) {
          ctx.emit({ kind: 'error', text: `matsya: ${r.reason}` });
          return;
        }
        if (r.items.length === 0) {
          ctx.emit({ kind: 'system', text: 'matsya: no pending items' });
          return;
        }
        const lines = r.items.map(it => {
          const goal = (it.instructions || it.message_content || '').replace(/\s+/g, ' ').trim();
          const snippet = goal.length > 80 ? goal.slice(0, 80) + '…' : goal;
          const taskRef = it.task_id ? ` task=${it.task_id}` : '';
          return `#${it.id}  ${it.item_type}${taskRef}  ${snippet || '(no instructions)'}`;
        });
        ctx.emit({ kind: 'system', text: lines.join('\n') });
        return;
      }

      case 'check': {
        const r = await runner.checkAndProcessOne(e => {
          ctx.emit({
            kind: e.level === 'error' ? 'error' : 'system',
            text: e.text,
          });
        });
        if (!r.ok) {
          ctx.emit({ kind: 'error', text: `matsya: ${r.reason}` });
          return;
        }
        if (!r.processed) {
          ctx.emit({ kind: 'system', text: 'matsya: no pending items' });
        }
        // Per-item feedback already emitted via onEvent; nothing else to say.
        return;
      }

      default:
        ctx.emit({ kind: 'error', text: `unknown action: ${action}\n\n${USAGE}` });
    }
  },
};
