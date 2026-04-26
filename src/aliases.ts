import { promises as fs } from 'node:fs';
import { ALIASES_PATH } from './core/config.js';

export interface AliasEntry {
  tool: string;
  positional?: string;
  extra?: Record<string, string>;
}

export type AliasMap = Map<string, AliasEntry>;

interface AliasFileShape {
  [name: string]: AliasEntry;
}

export async function loadAliases(): Promise<AliasMap> {
  const map: AliasMap = new Map();
  try {
    const raw = await fs.readFile(ALIASES_PATH, 'utf8');
    const parsed = JSON.parse(raw) as AliasFileShape;
    for (const [name, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.tool === 'string') {
        map.set(name.toLowerCase(), entry);
      }
    }
  } catch {
    // no aliases file is fine
  }
  return map;
}
