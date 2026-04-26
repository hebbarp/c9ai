import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from '../core/config.js';
import { formatProfileForSystem } from '../profile.js';
import type { Tool } from '../tools/types.js';

export const AGENT_PROMPT_PATH = path.join(CONFIG_DIR, 'agent-prompt.md');
export const DONE_SENTINEL = '<<DONE>>';

// Caps so a giant scoped folder doesn't balloon the system prompt.
const SCOPE_LIST_MAX_FILES = (() => {
  const n = Number(process.env.C9AI_SCOPE_LIST_MAX_FILES);
  return Number.isFinite(n) && n > 0 ? n : 100;
})();
const SCOPE_LIST_MAX_DEPTH = (() => {
  const n = Number(process.env.C9AI_SCOPE_LIST_MAX_DEPTH);
  return Number.isFinite(n) && n > 0 ? n : 3;
})();
const SNIPPET_MAX_LEN = 80;
const SCOPE_LIST_IGNORE = new Set([
  'node_modules',
  '.git',
  '.claude',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  'build',
  '.next',
  '.cache',
]);

interface ScopeFile {
  rel: string; // path relative to its root
  rootIndex: number; // index into scope.roots
  size: number;
  mtimeMs: number;
  snippet: string; // first markdown heading or first non-blank line
}

async function firstSnippet(absPath: string): Promise<string> {
  try {
    // Read up to 4KB — enough to get past leading blank lines / frontmatter.
    const fd = await fs.open(absPath, 'r');
    try {
      const buf = Buffer.alloc(4096);
      const { bytesRead } = await fd.read(buf, 0, 4096, 0);
      const text = buf.subarray(0, bytesRead).toString('utf8');
      const lines = text.split(/\r?\n/);
      // Prefer a markdown # heading anywhere in the head.
      const heading = lines.find(l => /^#{1,3}\s+\S/.test(l));
      if (heading) {
        const cleaned = heading.replace(/^#{1,3}\s+/, '').trim();
        return cleaned.length > SNIPPET_MAX_LEN ? cleaned.slice(0, SNIPPET_MAX_LEN - 1) + '…' : cleaned;
      }
      // Fall back to first non-blank line, skipping --- frontmatter blocks.
      let inFrontmatter = false;
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line === '---') {
          inFrontmatter = !inFrontmatter;
          continue;
        }
        if (inFrontmatter) continue;
        return line.length > SNIPPET_MAX_LEN ? line.slice(0, SNIPPET_MAX_LEN - 1) + '…' : line;
      }
      return '';
    } finally {
      await fd.close();
    }
  } catch {
    return '';
  }
}

async function walkScopeRoot(
  root: string,
  rootIndex: number,
  budget: { remaining: number }
): Promise<ScopeFile[]> {
  const out: ScopeFile[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (budget.remaining <= 0) return;
    if (depth > SCOPE_LIST_MAX_DEPTH) return;
    let entries: Array<{ name: string; isDir: boolean }>;
    try {
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      entries = dirents.map(d => ({ name: d.name, isDir: d.isDirectory() }));
    } catch {
      return;
    }
    // Files first, then dirs — stable for short caps.
    entries.sort((a, b) => Number(a.isDir) - Number(b.isDir) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (budget.remaining <= 0) return;
      if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
      if (SCOPE_LIST_IGNORE.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDir) {
        await walk(abs, depth + 1);
        continue;
      }
      let stat;
      try {
        stat = await fs.stat(abs);
      } catch {
        continue;
      }
      const rel = path.relative(root, abs).split(path.sep).join('/');
      const snippet = await firstSnippet(abs);
      out.push({ rel, rootIndex, size: stat.size, mtimeMs: stat.mtimeMs, snippet });
      budget.remaining -= 1;
    }
  }
  await walk(root, 0);
  return out;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function buildScopeContentBlock(roots: string[]): Promise<string> {
  if (roots.length === 0) return '';
  const budget = { remaining: SCOPE_LIST_MAX_FILES };
  const allFiles: ScopeFile[] = [];
  for (let i = 0; i < roots.length; i++) {
    if (budget.remaining <= 0) break;
    const files = await walkScopeRoot(roots[i]!, i, budget);
    allFiles.push(...files);
  }
  if (allFiles.length === 0) {
    return (
      `## Scoped folders\nThe user has opted these folders into searchable scope:\n` +
      roots.map(r => `- ${r}`).join('\n') +
      `\n(no files found within ${SCOPE_LIST_MAX_DEPTH} levels)\n\n`
    );
  }
  const lines: string[] = [];
  lines.push(`## What's in your scoped folders`);
  lines.push(
    `The user has opted these folders into scope. The list below is what's actually in them right now (capped at ${SCOPE_LIST_MAX_FILES} files, depth ${SCOPE_LIST_MAX_DEPTH}). Use @fs.read on any file when its content matters; use @fs.grep across roots for keyword search.`
  );
  lines.push('');
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i]!;
    const filesForRoot = allFiles.filter(f => f.rootIndex === i);
    if (filesForRoot.length === 0) continue;
    lines.push(`### ${root}`);
    for (const f of filesForRoot) {
      const sizeStr = fmtSize(f.size);
      const snip = f.snippet ? ` — ${f.snippet}` : '';
      lines.push(`- ${f.rel} (${sizeStr})${snip}`);
    }
    lines.push('');
  }
  if (budget.remaining <= 0) {
    lines.push(
      `(${SCOPE_LIST_MAX_FILES}-file cap hit. Bump C9AI_SCOPE_LIST_MAX_FILES to widen.)`
    );
    lines.push('');
  }
  return lines.join('\n');
}

const DEFAULT_TEMPLATE = `You are an autonomous agent in a CLI. You can call tools to inspect and change files in the user's current working directory.

## Tool-call format
To call a tool, emit a single line in EXACTLY this format, on its own line:

@<tool-name> <args...>

Two equivalent ways to pass arguments:

  @fs.write path=hello.txt content="hello world"     # named (most reliable)
  @fs.write hello.txt "hello world"                   # bare values, in arg order

Quote any value that contains spaces. Bare values map to the tool's arguments in the order they appear in the tool's signature below.

### Multi-line content (heredoc) — IMPORTANT for writing files
When writing a file longer than one line (markdown, code, JSON, config, etc.), put the body between \`<<<\` and \`>>>\` on lines after the @fs.write call. The body fills the last unset argument (for @fs.write that is \`content\`).

  @fs.write path=plan.md
  <<<
  # My Plan

  - First step
  - Second step

  Closing thoughts.
  >>>

RULES when asked to write a file:
- Put the ENTIRE file content inside the heredoc. Do NOT also restate it as plain text in your response — the heredoc IS your output, so anything outside it is wasted.
- Do NOT try to cram multi-line content into a single-line \`content="..."\` — newlines and quotes will be lost and the file will be broken.
- Plan briefly before the @fs.write line if you must, but keep planning text short. The model that wins this task writes mostly heredoc body, not mostly thoughts.

After each tool call you make, the user will reply with:

<observation>
...tool output...
</observation>

You then continue. One tool call per turn.

## Available tools
{{tools}}

## Done
When the goal is achieved (or you cannot make progress), emit the literal token ${DONE_SENTINEL} on its own line. Do not emit a tool call after ${DONE_SENTINEL}.

## On answering questions about the user
If the user asks anything personal — about their work, files, projects, recent activity — prefer using @fs.glob and @fs.grep over their scoped folders before answering. Cite the files you read.

The goal you've been asked to pursue will arrive in the next user message.
`;

function describeTool(tool: Tool): string {
  if (tool.args) {
    if (tool.args.length === 0) {
      return `- @${tool.name} — ${tool.description}`;
    }
    const argSpec = tool.args
      .map(a => {
        const v = `<${a.name}>`;
        return a.required === false ? `[${a.name}=${v}]` : `${a.name}=${v}`;
      })
      .join(' ');
    return `- @${tool.name} ${argSpec} — ${tool.description}`;
  }
  const pos = tool.positional ? ` <${tool.positional}>` : '';
  return `- @${tool.name}${pos} — ${tool.description}`;
}

export async function buildAgentPrompt(
  goal: string,
  tools: Map<string, Tool>,
  profile: string | null = null,
  scope: { roots: string[] } = { roots: [] }
): Promise<string> {
  let template = DEFAULT_TEMPLATE;
  try {
    const userTemplate = await fs.readFile(AGENT_PROMPT_PATH, 'utf8');
    if (userTemplate.trim()) template = userTemplate;
  } catch {
    // no override — use default
  }
  const toolList = Array.from(tools.values()).map(describeTool).join('\n');
  const scopeBlock = await buildScopeContentBlock(scope.roots);
  const profileBlock = profile ? `${formatProfileForSystem(profile)}\n\n---\n\n` : '';
  // {{goal}} placeholder is kept for backward-compat with user-supplied
  // agent-prompt.md, but the goal is also injected as the first user
  // message so providers always have a user turn to respond to.
  const filled = template.replace('{{tools}}', toolList).replace('{{goal}}', goal);
  return profileBlock + scopeBlock + filled;
}
