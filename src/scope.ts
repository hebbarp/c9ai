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
 * the resolved path is inside `cwd` OR inside one of `scope.roots`. Returns
 * the absolute path on success; throws with an actionable message otherwise.
 *
 * This is the single sandbox check used by all fs.* tools. Outside the
 * scope an agent loop cannot read, write, list, glob, or grep — even if
 * the user's prompt asks it to.
 */
export function resolveInScope(input: string, cwd: string, scope: Scope): string {
  const target = path.resolve(cwd, input);
  const allowedRoots = [path.resolve(cwd), ...scope.roots];
  for (const root of allowedRoots) {
    if (isInside(target, root)) return target;
  }
  throw new Error(
    `path is not in scope: ${input}\n` +
      `allowed roots: ${allowedRoots.join(', ')}\n` +
      `add a folder to ~/.c9ai/scope.json to widen access.`
  );
}

export function isInside(target: string, root: string): boolean {
  const rel = path.relative(root, target);
  if (rel === '') return true; // root itself
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Returns the list of roots the agent should consider for full-corpus
 * searches (glob/grep with no path argument). When the user has scoped
 * folders we use those; otherwise we fall back to cwd.
 */
export function searchRoots(cwd: string, scope: Scope): string[] {
  return scope.roots.length > 0 ? scope.roots : [path.resolve(cwd)];
}
