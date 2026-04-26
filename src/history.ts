import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './core/config.js';

export const HISTORY_PATH = path.join(CONFIG_DIR, 'history.json');
const MAX_ENTRIES = 500;

export async function loadHistory(): Promise<string[]> {
  try {
    const raw = await fs.readFile(HISTORY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string');
    }
  } catch {
    // missing file or unreadable JSON — start fresh
  }
  return [];
}

export async function saveHistory(entries: string[]): Promise<void> {
  try {
    const trimmed = entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries;
    await fs.writeFile(HISTORY_PATH, JSON.stringify(trimmed), 'utf8');
  } catch {
    // best-effort persistence; ignore
  }
}

/**
 * Append a new command, dropping consecutive duplicates and trimming to the
 * MAX_ENTRIES cap. Returns a new array (immutable update for ref consumers).
 */
export function pushHistory(entries: string[], cmd: string): string[] {
  const trimmed = cmd.trim();
  if (!trimmed) return entries;
  if (entries.length > 0 && entries[entries.length - 1] === trimmed) return entries;
  const next = [...entries, trimmed];
  return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
}
