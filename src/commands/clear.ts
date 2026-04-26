import type { Command } from '../core/types.js';

export const clearCommand: Command = {
  name: 'clear',
  description: 'Wipe the in-memory conversation and start a fresh session file',
  run: async (_args, ctx) => {
    if (!ctx.replaceHistory) {
      ctx.emit({ kind: 'error', text: 'cannot clear in this context' });
      return;
    }
    await ctx.replaceHistory([]);
    ctx.emit({ kind: 'system', text: 'history cleared. fresh session started.' });
  },
};
