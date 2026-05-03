import type { Command } from '../core/types.js';

export const saveCommand: Command = {
  name: 'save',
  description: 'Export the current visible conversation to markdown',
  run: async (args, ctx) => {
    if (!ctx.exportHistory) {
      ctx.emit({ kind: 'error', text: 'cannot save conversation in this context' });
      return;
    }
    const outputPath = args.join(' ').trim() || undefined;
    try {
      const result = await ctx.exportHistory(outputPath);
      ctx.emit({
        kind: 'system',
        text: `saved ${result.count} message(s) to ${result.path}`,
      });
    } catch (err) {
      ctx.emit({ kind: 'error', text: `save failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  },
};
