import { parseSigilArgs } from '../tools/parse.js';
import type { Tool } from '../tools/types.js';

export interface ExtractedToolCall {
  name: string;
  rawLine: string;
  args: Record<string, unknown>;
}

const HEREDOC_OPEN = '<<<';
const HEREDOC_CLOSE = '>>>';

/**
 * Find the first tool call in a model response. Accept any line starting
 * with `@<name>` where <name> matches a registered tool. Multiple tool
 * calls per turn are ignored — we run the first only and let the model
 * re-plan after each observation.
 *
 * Heredoc body: lines between `<<<` and `>>>` immediately after the call
 * become the value of the LAST unfilled declared arg. This is how the
 * model writes multi-line content (markdown files, code, etc) without
 * having to escape newlines into a single-line string.
 *
 * Example:
 *   @fs.write path=plan.md
 *   <<<
 *   # My Plan
 *
 *   Multi-line text.
 *   >>>
 */
export function extractFirstToolCall(
  output: string,
  tools: Map<string, Tool>
): ExtractedToolCall | null {
  const lines = output.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;
    const line = rawLine.trim();
    if (!line.startsWith('@')) continue;
    const match = line.match(/^@([A-Za-z0-9_.-]+)\s*([\s\S]*)$/);
    if (!match) continue;
    const name = match[1]!;
    const argString = match[2] ?? '';
    const tool = tools.get(name);
    if (!tool) continue;
    const args: Record<string, unknown> = parseSigilArgs(argString, {
      positional: tool.positional,
      args: tool.args,
    });

    // Look for heredoc body starting on the next non-empty line.
    let j = i + 1;
    while (j < lines.length && lines[j]!.trim() === '') j++;
    if (j < lines.length && lines[j]!.trim() === HEREDOC_OPEN) {
      const bodyStart = j + 1;
      let bodyEnd = bodyStart;
      while (bodyEnd < lines.length && lines[bodyEnd]!.trim() !== HEREDOC_CLOSE) {
        bodyEnd++;
      }
      // Only consume the heredoc if we found the closing delimiter — an
      // unclosed `<<<` is probably content the model is still streaming.
      if (bodyEnd < lines.length) {
        const body = lines.slice(bodyStart, bodyEnd).join('\n');
        const targetArg = pickHeredocTarget(tool, args);
        if (targetArg) {
          args[targetArg] = body;
        }
      }
    }

    return { name, rawLine: line, args };
  }
  return null;
}

/**
 * Heredoc body fills the last declared arg that isn't already set —
 * for fs.write that's `content` (since `path` is normally inline).
 * Falls back to `positional` for tools that don't declare full args.
 */
function pickHeredocTarget(tool: Tool, args: Record<string, unknown>): string | null {
  if (tool.args && tool.args.length > 0) {
    for (let i = tool.args.length - 1; i >= 0; i--) {
      const a = tool.args[i]!;
      if (!(a.name in args)) return a.name;
    }
    return null;
  }
  if (tool.positional && !(tool.positional in args)) return tool.positional;
  return null;
}
