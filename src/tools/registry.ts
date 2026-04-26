import { promises as fs } from 'node:fs';
import { TOOLS_REGISTRY_PATH } from '../core/config.js';
import { fsTools } from './fs.js';
import { metaTools } from './meta.js';
import { shellTools, runShellCommand, gateShellCommand } from './shell.js';
import { searchTools } from './search.js';
import type { Tool, ToolContext, ToolResult, ToolRegistryFile } from './types.js';

function templateExpand(template: string, args: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const v = args[key.trim()];
    return v == null ? '' : String(v);
  });
}

function shellTool(
  name: string,
  command: string,
  description: string | undefined,
  positional: string | undefined
): Tool {
  return {
    name,
    description: description ?? `Run: ${command}`,
    positional,
    run: async (args, ctx: ToolContext): Promise<ToolResult> => {
      const expanded = templateExpand(command, args);
      const gateError = await gateShellCommand(expanded, ctx);
      if (gateError) {
        ctx.emit(gateError + '\n');
        return { ok: false, error: gateError };
      }
      return runShellCommand(expanded, {
        cwd: ctx.cwd,
        signal: ctx.signal,
        emit: ctx.emit,
      });
    },
  };
}

async function loadJsonRegistry(): Promise<Tool[]> {
  try {
    const raw = await fs.readFile(TOOLS_REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ToolRegistryFile;
    if (!parsed.tools || typeof parsed.tools !== 'object') return [];
    return Object.entries(parsed.tools).map(([name, entry]) =>
      shellTool(name, entry.command, entry.description, entry.positional)
    );
  } catch {
    return [];
  }
}

export async function buildToolRegistry(): Promise<Map<string, Tool>> {
  const builtins: Tool[] = [...fsTools, ...metaTools, ...shellTools, ...searchTools];
  const userTools = await loadJsonRegistry();
  const map = new Map<string, Tool>();
  for (const t of [...builtins, ...userTools]) map.set(t.name, t);
  return map;
}

export function listTools(reg: Map<string, Tool>): Tool[] {
  return Array.from(reg.values());
}
