import type { Command } from '../core/types.js';
import { helpCommand } from './help.js';
import { switchCommand } from './switch.js';
import { todosCommand } from './todos.js';
import { configCommand } from './config.js';
import { analyticsCommand } from './analytics.js';
import { toolsCommand } from './tools.js';
import { resumeCommand } from './resume.js';
import { clearCommand } from './clear.js';

export function buildCommandRegistry(): Map<string, Command> {
  const list: Command[] = [
    helpCommand,
    switchCommand,
    todosCommand,
    configCommand,
    analyticsCommand,
    toolsCommand,
    resumeCommand,
    clearCommand,
  ];
  const map = new Map<string, Command>();
  for (const c of list) map.set(c.name, c);
  return map;
}
