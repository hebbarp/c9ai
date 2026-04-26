import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CONFIG_DIR } from './core/config.js';
import { runAgent, type AgentEvent } from './agent/loop.js';
import { DONE_SENTINEL } from './agent/prompt.js';
import type { Provider } from './providers/types.js';
import type { Tool, ConfirmRequest, ConfirmResponse } from './tools/types.js';
import type { Scope } from './scope.js';

const BRAIN_DIR = path.join(CONFIG_DIR, 'brain');
const RESEARCH_DIR = path.join(BRAIN_DIR, 'autoresearch');
const RUNS_DIR = path.join(RESEARCH_DIR, 'runs');
const LEDGER_PATH = path.join(RESEARCH_DIR, 'runs.jsonl');
const OUTPUTS_DIR_NAME = 'outputs';

export type Verdict = 'keep' | 'discard' | 'needs-review' | 'crash';

export interface ResearchRunRecord {
  id: string;
  input: string;
  programSource: 'file' | 'topic';
  programPath?: string;
  outputPath: string;
  provider: string;
  startedAt: string;
  finishedAt: string;
  verdict: Verdict;
  iterations: number;
  elapsedMs: number;
  error?: string | null;
}

export interface ResearchOptions {
  input: string;
  cwd: string;
  provider: Provider;
  tools: Map<string, Tool>;
  scope: Scope;
  profile: string | null;
  signal?: AbortSignal;
  confirm?: (req: ConfirmRequest) => Promise<ConfirmResponse>;
  onEvent: (e: AgentEvent) => void;
}

export interface ResearchResult {
  ok: boolean;
  outputPath: string;
  verdict: Verdict;
  iterations: number;
  elapsedMs: number;
  text: string;
}

function nowRunId(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function safeSlug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'untitled'
  );
}

async function ensureDirs(cwd: string): Promise<void> {
  await fs.mkdir(RUNS_DIR, { recursive: true });
  await fs.mkdir(path.join(cwd, OUTPUTS_DIR_NAME), { recursive: true });
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

interface ProgramInput {
  source: 'file' | 'topic';
  programPath?: string;
  briefMarkdown: string;
  slug: string;
}

async function resolveProgram(input: string, cwd: string): Promise<ProgramInput> {
  const trimmed = input.trim();
  // Heuristic: looks like a path if it has a path separator or ends in .md/.txt.
  const looksLikePath = /[\\/]/.test(trimmed) || /\.(md|txt)$/i.test(trimmed);
  if (looksLikePath) {
    const abs = path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
    if (await pathExists(abs)) {
      const briefMarkdown = await fs.readFile(abs, 'utf8');
      const base = path.basename(abs).replace(/\.[^.]+$/, '');
      return { source: 'file', programPath: abs, briefMarkdown, slug: safeSlug(base) };
    }
  }
  // Topic — synthesize a minimal program brief.
  const briefMarkdown =
    `# ${trimmed}\n\n` +
    `## Brief\n${trimmed}\n\n` +
    `## Bounds\n- Use only the tools registered in this session.\n- Cite any files you read by path.\n- Stay within the user's scoped folders for evidence.\n\n` +
    `## Evaluator\n- Strongest evidence wins.\n- Note contradictions explicitly.\n- Mark gaps as "unknown" rather than inventing answers.\n`;
  return { source: 'topic', briefMarkdown, slug: safeSlug(trimmed) };
}

function buildIterationPrompt(program: ProgramInput, runId: string, outputRel: string): string {
  return (
    `You are running one bounded autoresearch iteration.\n\n` +
    `Run id: ${runId}\n` +
    `Output path (where YOU should write the memo): ${outputRel}\n\n` +
    `Rules:\n` +
    `- Treat the brief below as the program. Stay within its stated bounds.\n` +
    `- Use tools to gather evidence: @fs.read for known paths, @fs.grep / @fs.glob for keyword search across scoped folders. Cite files by path.\n` +
    `- Use @fs.write to save the final memo to ${outputRel}.\n` +
    `- The memo MUST end with a "## Verdict" section containing exactly one of: keep, discard, needs-review.\n` +
    `- After the memo is written, emit ${DONE_SENTINEL} on its own line.\n\n` +
    `Memo structure:\n` +
    `  # <Title>\n` +
    `  ## Summary\n` +
    `  ## Evidence\n` +
    `  ## Recommendation\n` +
    `  ## Verdict\n` +
    `  <one of: keep | discard | needs-review>\n\n` +
    `--- Program brief ---\n${program.briefMarkdown}\n--- End brief ---\n`
  );
}

export function parseVerdict(text: string): Verdict {
  const verdictSection = /(?:^|\n)##\s*Verdict\s*\n([\s\S]*?)(?=\n##\s+|\s*$)/i.exec(text);
  const raw = verdictSection?.[1] ?? text.slice(-1200);
  const value = raw.toLowerCase();
  if (/\bneeds[-\s]?review\b/.test(value)) return 'needs-review';
  if (/\bdiscard\b/.test(value)) return 'discard';
  if (/\bcrash\b|\bfailed\b/.test(value)) return 'crash';
  if (/\bkeep\b/.test(value)) return 'keep';
  return 'needs-review';
}

async function appendLedger(record: ResearchRunRecord): Promise<void> {
  await fs.mkdir(RESEARCH_DIR, { recursive: true });
  await fs.appendFile(LEDGER_PATH, JSON.stringify(record) + os.EOL, 'utf8');
  await fs.writeFile(
    path.join(RUNS_DIR, `${record.id}.json`),
    JSON.stringify(record, null, 2),
    'utf8'
  );
}

export async function runResearch(opts: ResearchOptions): Promise<ResearchResult> {
  await ensureDirs(opts.cwd);
  const runId = nowRunId();
  const program = await resolveProgram(opts.input, opts.cwd);
  const outputRel = `${OUTPUTS_DIR_NAME}/autoresearch-${program.slug}-${runId}.md`;
  const outputAbs = path.resolve(opts.cwd, outputRel);
  const goal = buildIterationPrompt(program, runId, outputRel);

  const startedAt = new Date().toISOString();
  let buf = '';
  let iterations = 0;
  let elapsedMs = 0;
  let agentError: string | null = null;

  await runAgent(
    opts.provider,
    goal,
    opts.tools,
    evt => {
      if (evt.type === 'thought') buf += evt.chunk;
      if (evt.type === 'finish') {
        iterations = evt.iterations;
        elapsedMs = evt.elapsedMs;
        if (evt.reason !== 'done' && evt.reason !== 'no-tool-call') {
          agentError = `agent finished with reason: ${evt.reason}`;
        }
      }
      opts.onEvent(evt);
    },
    {
      cwd: opts.cwd,
      ...(opts.signal ? { signal: opts.signal } : {}),
      ...(opts.confirm ? { confirm: opts.confirm } : {}),
      scope: opts.scope,
      profile: opts.profile,
    }
  );

  // The agent should have written the memo via @fs.write. If it didn't, fall
  // back to writing the accumulated thought stream so the run still produces
  // a durable artifact (better than a silent miss).
  let memoText: string;
  if (await pathExists(outputAbs)) {
    memoText = await fs.readFile(outputAbs, 'utf8');
  } else {
    memoText = buf || `# Autoresearch Run ${runId}\n\nNo output produced.\n\n## Verdict\ncrash\n`;
    await fs.writeFile(outputAbs, memoText, 'utf8');
  }

  const verdict: Verdict = agentError ? 'crash' : parseVerdict(memoText);
  const finishedAt = new Date().toISOString();

  const record: ResearchRunRecord = {
    id: runId,
    input: opts.input,
    programSource: program.source,
    ...(program.programPath ? { programPath: program.programPath } : {}),
    outputPath: outputAbs,
    provider: opts.provider.name,
    startedAt,
    finishedAt,
    verdict,
    iterations,
    elapsedMs,
    error: agentError,
  };
  await appendLedger(record);

  return {
    ok: verdict !== 'crash',
    outputPath: outputAbs,
    verdict,
    iterations,
    elapsedMs,
    text: memoText,
  };
}

export async function listRecentRuns(limit = 20): Promise<ResearchRunRecord[]> {
  try {
    const raw = await fs.readFile(LEDGER_PATH, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const records: ResearchRunRecord[] = [];
    for (const line of lines.slice(-limit).reverse()) {
      try {
        records.push(JSON.parse(line) as ResearchRunRecord);
      } catch {
        // skip
      }
    }
    return records;
  } catch {
    return [];
  }
}
