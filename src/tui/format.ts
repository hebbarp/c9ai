/**
 * Render helpers for agent output: pretty tool-call lines, and a streaming
 * filter that strips protocol-only lines from the model's `thought` stream
 * (`@tool ...`, heredoc `<<<` ... `>>>`, and the `<<DONE>>` sentinel).
 *
 * The user shouldn't see those — they're for the parser. The clean
 * `tool-call` event we emit afterward already conveys what the agent did.
 */

const TOOL_CALL_LINE = /^@[a-zA-Z][\w.]*(\s|$)/;
const HEREDOC_OPEN = '<<<';
const HEREDOC_CLOSE = '>>>';
const DONE_TOKEN = '<<DONE>>';

const ARG_INLINE_MAX = 60;

export function formatToolCall(name: string, args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string') {
      if (v.length > ARG_INLINE_MAX || v.includes('\n')) {
        parts.push(`${k}=<${v.length} chars>`);
      } else if (/[\s"=]/.test(v)) {
        parts.push(`${k}=${JSON.stringify(v)}`);
      } else {
        parts.push(`${k}=${v}`);
      }
    } else {
      parts.push(`${k}=${JSON.stringify(v)}`);
    }
  }
  return parts.length ? `${name} ${parts.join(' ')}` : name;
}

export interface ThoughtFilter {
  /** Feed a streamed chunk; returns whatever should reach the user (may be ''). */
  filter(chunk: string): string;
  /** Flush any partial line at end-of-turn. */
  flush(): string;
}

export function createThoughtFilter(): ThoughtFilter {
  let buf = '';
  let inHeredoc = false;

  function processLine(line: string): string | null {
    const t = line.trim();
    if (inHeredoc) {
      if (t === HEREDOC_CLOSE) inHeredoc = false;
      return null;
    }
    if (t === HEREDOC_OPEN) {
      inHeredoc = true;
      return null;
    }
    if (t === DONE_TOKEN) return null;
    if (TOOL_CALL_LINE.test(t)) return null;
    return line;
  }

  return {
    filter(chunk: string): string {
      buf += chunk;
      let out = '';
      let nl = buf.indexOf('\n');
      while (nl !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const kept = processLine(line);
        if (kept !== null) out += kept + '\n';
        nl = buf.indexOf('\n');
      }
      return out;
    },
    flush(): string {
      if (!buf) return '';
      const last = buf;
      buf = '';
      const kept = processLine(last);
      return kept ?? '';
    },
  };
}
