import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Tool, ToolContext, ToolResult } from './types.js';
import { resolveInScope } from '../scope.js';

function resolveSafe(input: string, ctx: ToolContext): string {
  return resolveInScope(input, ctx.cwd, ctx.scope ?? { roots: [] });
}

function asString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  return String(v);
}

const fsRead: Tool = {
  name: 'fs.read',
  description: 'Read a file under the current working directory',
  positional: 'path',
  args: [{ name: 'path', description: 'file to read (relative to cwd)', required: true }],
  run: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const p = asString(args.path);
    if (!p) return { ok: false, error: 'usage: @fs.read <path>' };
    try {
      const abs = resolveSafe(p, ctx);
      const content = await fs.readFile(abs, 'utf8');
      ctx.emit(content);
      return { ok: true, output: content };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

const fsWrite: Tool = {
  name: 'fs.write',
  description: 'Write content to a file under the current working directory',
  positional: 'path',
  args: [
    { name: 'path', description: 'file to write (relative to cwd)', required: true },
    { name: 'content', description: 'text to write (use quotes if it has spaces)', required: true },
  ],
  run: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const p = asString(args.path);
    const content = asString(args.content);
    if (!p) return { ok: false, error: 'usage: @fs.write path=<path> content=<text>' };
    try {
      const abs = resolveSafe(p, ctx);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, 'utf8');
      const msg = `wrote ${content.length} chars to ${path.relative(ctx.cwd, abs) || '.'}`;
      ctx.emit(msg + '\n');
      return { ok: true, output: msg };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

const fsList: Tool = {
  name: 'fs.list',
  description: 'List entries in a directory under the current working directory',
  positional: 'path',
  args: [{ name: 'path', description: 'directory (default: cwd)', required: false }],
  run: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const p = asString(args.path) || '.';
    try {
      const abs = resolveSafe(p, ctx);
      const entries = await fs.readdir(abs, { withFileTypes: true });
      const lines = entries
        .map(e => `${e.isDirectory() ? 'd' : '-'} ${e.name}`)
        .sort()
        .join('\n');
      ctx.emit(lines + '\n');
      return { ok: true, output: lines };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const fsTools: Tool[] = [fsRead, fsWrite, fsList];
