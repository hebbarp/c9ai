import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './core/config.js';

export const SCOPE_PATH = path.join(CONFIG_DIR, 'scope.json');

interface ScopeFile {
  roots?: string[];
}

export interface Scope {
  roots: string[]; // absolute paths, normalized
}

export async function loadScope(): Promise<Scope> {
  try {
    const raw = await fs.readFile(SCOPE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ScopeFile;
    const roots = (parsed.roots ?? [])
      .filter((r): r is string => typeof r === 'string' && r.trim() !== '')
      .map(r => path.resolve(r));
    return { roots };
  } catch {
    return { roots: [] };
  }
}

/**
 * Resolve `input` (a relative or absolute path) against `cwd`, then verify
 * the resolved path stays inside `cwd`. Returns the absolute path on success;
 * throws with an actionable message otherwise.
 *
 * This is the single sandbox check used by all fs.* tools. Outside cwd,
 * an agent loop cannot read, write, list, glob, or grep.
 */
export function resolveInScope(input: string, cwd: string, _scope: Scope): string {
  const target = path.resolve(cwd, input);
  const allowedRoots = [path.resolve(cwd)];
  for (const root of allowedRoots) {
    if (isInside(target, root)) return target;
  }
  throw new Error(
    `path is not in scope: ${input}\n` +
      `allowed roots: ${allowedRoots.join(', ')}\n` +
      `use !cd <dir> to change the current working directory.`
  );
}

export function isInside(target: string, root: string): boolean {
  const rel = path.relative(root, target);
  if (rel === '') return true; // root itself
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Returns the roots the agent should consider for searches. Searches are
 * intentionally bounded to cwd for speed.
 */
export function searchRoots(cwd: string, _scope: Scope): string[] {
  return [path.resolve(cwd)];
}
