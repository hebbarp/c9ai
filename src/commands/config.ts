import type { Command } from '../core/types.js';
import { CONFIG_PATH } from '../core/config.js';

export const configCommand: Command = {
  name: 'config',
  description: 'Show current configuration',
  run: async (_args, ctx) => {
    const lines = [
      `path: ${CONFIG_PATH}`,
      `defaultModel: ${ctx.config.defaultModel}`,
      `ollamaModel:  ${ctx.config.ollamaModel ?? '(default)'}`,
      `ollamaUrl:    ${ctx.config.ollamaUrl ?? '(default)'}`,
      `lastUpdated:  ${ctx.config.lastUpdated}`,
    ];
    ctx.emit({ kind: 'system', text: lines.join('\n') });
  },
};
