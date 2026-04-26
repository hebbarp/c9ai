import os from 'node:os';
import type { Tool, ToolContext, ToolResult } from './types.js';

const dateNow: Tool = {
  name: 'date.now',
  description: 'Current date, time, day of week, and timezone',
  args: [],
  run: async (_args, ctx: ToolContext): Promise<ToolResult> => {
    const d = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const dow = d.toLocaleDateString('en-US', { weekday: 'long' });
    const out =
      `date:      ${d.toISOString().slice(0, 10)}\n` +
      `time:      ${d.toTimeString().slice(0, 8)}\n` +
      `dayOfWeek: ${dow}\n` +
      `iso:       ${d.toISOString()}\n` +
      `tz:        ${tz}`;
    ctx.emit(out + '\n');
    return { ok: true, output: out };
  },
};

const envCwd: Tool = {
  name: 'env.cwd',
  description: 'Current working directory',
  args: [],
  run: async (_args, ctx: ToolContext): Promise<ToolResult> => {
    const cwd = ctx.cwd;
    ctx.emit(cwd + '\n');
    return { ok: true, output: cwd };
  },
};

const envPlatform: Tool = {
  name: 'env.platform',
  description: 'OS platform (win32, darwin, linux) and arch',
  args: [],
  run: async (_args, ctx: ToolContext): Promise<ToolResult> => {
    const out = `${process.platform} ${process.arch} (node ${process.version}, ${os.release()})`;
    ctx.emit(out + '\n');
    return { ok: true, output: out };
  },
};

export const metaTools: Tool[] = [dateNow, envCwd, envPlatform];
