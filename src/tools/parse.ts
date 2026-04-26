import type { ToolArg } from './types.js';

/**
 * Sigil-arg parser. Accepts:
 *   "key=value"           → named arg
 *   `k="quoted value"`    → quoted named arg
 *   bare tokens           → mapped to declared `args` in order, OR fall back
 *                           to `positional` if `args` is not provided.
 *
 * Examples (tool declares args = [path, content]):
 *   "today.txt hello"           → { path: "today.txt", content: "hello" }
 *   `today.txt "hello world"`   → { path: "today.txt", content: "hello world" }
 *   `path=t.txt content=hi`     → { path: "t.txt", content: "hi" }
 *   `today.txt content=hi`      → { path: "today.txt", content: "hi" }
 *
 * Examples (tool declares positional = "path", no args):
 *   "src"                       → { path: "src" }
 *   "src/foo bar"               → { path: "src/foo bar" }
 */
export interface ParseHint {
  positional?: string;
  args?: ToolArg[];
}

export function parseSigilArgs(
  raw: string,
  hint?: ParseHint
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return result;

  const tokens = tokenize(raw);
  const leftover: string[] = [];
  for (const tok of tokens) {
    const eq = tok.indexOf('=');
    if (eq > 0) {
      const k = tok.slice(0, eq);
      const v = stripQuotes(tok.slice(eq + 1));
      result[k] = v;
    } else {
      leftover.push(stripQuotes(tok));
    }
  }

  if (leftover.length === 0) return result;

  // Preferred: ordered args. Fill any arg not already set, in declared order.
  if (hint?.args && hint.args.length > 0) {
    const remaining = [...leftover];
    for (const arg of hint.args) {
      if (arg.name in result) continue;
      if (remaining.length === 0) break;
      result[arg.name] = remaining.shift()!;
    }
    // If extra leftovers remain (more values than args), append them onto the
    // last arg's value — preserves the legacy "join leftover" behavior for
    // single-positional callers like @fs.list "src/sub dir".
    if (remaining.length > 0) {
      const lastArg = hint.args[hint.args.length - 1]!.name;
      if (lastArg in result) {
        result[lastArg] = [result[lastArg], ...remaining].join(' ');
      }
    }
    return result;
  }

  // Legacy: single positional. Concatenate all leftovers.
  if (hint?.positional && !(hint.positional in result)) {
    result[hint.positional] = leftover.join(' ');
  }
  return result;
}

function tokenize(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) {
        out.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function stripQuotes(v: string): string {
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}
