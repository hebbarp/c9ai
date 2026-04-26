import type { Command } from '../core/types.js';
import { listProviders } from '../providers/registry.js';
import { buildToolRegistry, listTools } from '../tools/registry.js';
import { loadAliases } from '../aliases.js';

export const toolsCommand: Command = {
  name: 'tools',
  description: 'List available providers, tools, and aliases',
  run: async (_args, ctx) => {
    const provs = listProviders();
    const lines: string[] = ['providers:'];
    for (const p of provs) {
      const ok = await p.available();
      lines.push(`  ${p.name.padEnd(8)} ${ok ? 'available' : 'NOT FOUND'} (${p.bin})`);
    }

    const tools = listTools(await buildToolRegistry());
    lines.push('');
    lines.push(`tools (${tools.length}):`);
    if (tools.length === 0) {
      lines.push('  (none)');
    } else {
      for (const t of tools) {
        lines.push(`  @${t.name.padEnd(12)} ${t.description}`);
      }
    }

    const aliases = await loadAliases();
    lines.push('');
    lines.push(`aliases (${aliases.size}):`);
    if (aliases.size === 0) {
      lines.push('  (none — define in ~/.c9ai/aliases.json)');
    } else {
      for (const [name, entry] of aliases) {
        lines.push(`  @${name.padEnd(12)} → ${entry.tool}`);
      }
    }

    ctx.emit({ kind: 'system', text: lines.join('\n') });
  },
};
