import type { Command } from '../core/types.js';
import { getTunnelManager } from '../matsya/tunnels.js';

const USAGE = [
  'usage:',
  '  tunnels status                 show worker + running tunnels',
  '  tunnels start                  start the background poll loop (keeps tunnels alive)',
  '  tunnels stop                   stop the loop + tear down all tunnels',
  '  tunnels once                   run a single poll/reconcile pass',
  '',
  'requires frpc on PATH or C9AI_FRPC_PATH (frp is not bundled; Windows Defender',
  'flags it as a PUA). Get it at https://github.com/fatedier/frp/releases',
].join('\n');

function fmtAge(ts: number | null): string {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export const tunnelsCommand: Command = {
  name: 'tunnels',
  description: 'Preview-share tunnel worker (status | start | stop | once)',
  run: async (args, ctx) => {
    const action = (args[0] ?? 'status').toLowerCase();
    const mgr = getTunnelManager();
    const sink = (e: { level: string; text: string }) =>
      ctx.emit({ kind: e.level === 'error' ? 'error' : 'system', text: `tunnels: ${e.text}` });

    switch (action) {
      case 'help':
      case '-h':
      case '--help':
        ctx.emit({ kind: 'system', text: USAGE });
        return;

      case 'status': {
        const s = mgr.status();
        const frpcLine = s.frpc.ok
          ? `frpc:     ${s.frpc.version || 'ok'} (${s.frpc.path})`
          : `frpc:     NOT FOUND — install frp or set C9AI_FRPC_PATH`;
        const lines = [
          `worker:   ${s.workerId}`,
          `loop:     ${s.looping ? 'running' : 'stopped'}`,
          frpcLine,
          `last poll:${' '}${fmtAge(s.lastPollAt)}`,
          `tunnels:  ${s.running.length}`,
        ];
        for (const t of s.running) {
          lines.push(`  - ${t.slug} ${t.active ? '[live]' : '[starting]'} ${t.publicUrl} -> localhost:${t.localPort}`);
        }
        if (s.lastError) lines.push(`last error: ${s.lastError}`);
        ctx.emit({ kind: 'system', text: lines.join('\n') });
        return;
      }

      case 'start': {
        mgr.setEventSink(sink);
        const r = mgr.startLoop();
        ctx.emit(r.ok
          ? { kind: 'system', text: 'tunnels: background loop running' }
          : { kind: 'error', text: `tunnels: ${r.reason}` });
        return;
      }

      case 'stop': {
        await mgr.shutdownAll(true);
        ctx.emit({ kind: 'system', text: 'tunnels: stopped loop and tore down all tunnels' });
        return;
      }

      case 'once': {
        mgr.setEventSink(sink);
        const r = await mgr.poll();
        ctx.emit(r.ok
          ? { kind: 'system', text: 'tunnels: poll complete' }
          : { kind: 'error', text: `tunnels: ${r.reason}` });
        return;
      }

      default:
        ctx.emit({ kind: 'error', text: `unknown action: ${action}\n\n${USAGE}` });
    }
  },
};
