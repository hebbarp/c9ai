import type { Command, Message } from '../core/types.js';
import { listSessions, loadSession, formatAgo } from '../sessions.js';

let resumeSeq = 0;
function resumedId(): string {
  resumeSeq += 1;
  return `resumed-${Date.now()}-${resumeSeq}`;
}

export const resumeCommand: Command = {
  name: 'resume',
  description: 'Resume a prior conversation (resume | resume <n> | resume list)',
  run: async (args, ctx) => {
    const sub = (args[0] ?? '').toLowerCase();

    if (sub === 'list') {
      const sessions = await listSessions();
      if (sessions.length === 0) {
        ctx.emit({ kind: 'system', text: 'no prior sessions' });
        return;
      }
      const now = Date.now();
      const lines = sessions.slice(0, 20).map((s, i) => {
        const ago = formatAgo(now - s.mtime);
        const preview = (s.firstPrompt || '(no user prompts)').replace(/\s+/g, ' ').slice(0, 60);
        return (
          `${(i + 1).toString().padStart(2)}. ` +
          `${ago.padEnd(10)} ` +
          `${s.turnCount.toString().padStart(3)} turns  ` +
          preview
        );
      });
      ctx.emit({ kind: 'system', text: `recent sessions:\n${lines.join('\n')}` });
      return;
    }

    if (!ctx.replaceHistory) {
      ctx.emit({ kind: 'error', text: 'cannot resume in this context' });
      return;
    }

    const sessions = await listSessions();
    if (sessions.length === 0) {
      ctx.emit({ kind: 'system', text: 'no prior sessions to resume' });
      return;
    }

    let target = sessions[0]!;
    if (sub) {
      const n = Number.parseInt(sub, 10);
      if (Number.isFinite(n) && n >= 1 && n <= sessions.length) {
        target = sessions[n - 1]!;
      } else {
        const byId = sessions.find(s => s.id === sub);
        if (!byId) {
          ctx.emit({
            kind: 'error',
            text: `no session matching "${sub}". try \`resume list\`.`,
          });
          return;
        }
        target = byId;
      }
    }

    const turns = await loadSession(target.id);
    if (turns.length === 0) {
      ctx.emit({ kind: 'system', text: `session ${target.id} is empty` });
      return;
    }

    const messages: Message[] = turns.map(t => ({
      id: resumedId(),
      kind: t.kind,
      text: t.text,
      ts: t.ts || target.mtime,
    }));

    await ctx.replaceHistory(messages);
    ctx.emit({
      kind: 'system',
      text: `resumed ${target.id} — ${turns.length} turns. continuing in a new session file.`,
    });
  },
};
