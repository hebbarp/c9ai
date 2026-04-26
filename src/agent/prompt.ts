import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from '../core/config.js';
import { formatProfileForSystem } from '../profile.js';
import type { Tool } from '../tools/types.js';

export const AGENT_PROMPT_PATH = path.join(CONFIG_DIR, 'agent-prompt.md');
export const DONE_SENTINEL = '<<DONE>>';

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
  const scopeBlock = scope.roots.length > 0
    ? `## Scoped folders\nThe user has opted these folders into searchable scope:\n${scope.roots.map(r => `- ${r}`).join('\n')}\n\n`
    : '';
  const profileBlock = profile ? `${formatProfileForSystem(profile)}\n\n---\n\n` : '';
  // {{goal}} placeholder is kept for backward-compat with user-supplied
  // agent-prompt.md, but the goal is also injected as the first user
  // message so providers always have a user turn to respond to.
  const filled = template.replace('{{tools}}', toolList).replace('{{goal}}', goal);
  return profileBlock + scopeBlock + filled;
}
