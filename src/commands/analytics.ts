import type { Command } from '../core/types.js';

export const analyticsCommand: Command = {
  name: 'analytics',
  description: 'Show productivity analytics (stub)',
  run: async (_args, ctx) => {
    ctx.emit({
      kind: 'system',
      text: 'analytics: not implemented yet — will read ~/.c9ai/logs/*.jsonl',
    });
  },
};
