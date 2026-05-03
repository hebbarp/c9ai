import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadModel } from './registry.js';

export interface ReviewQuestion {
  id: string;
  prompt: string;
  answer: string;
}

export interface LoadedEvalRun {
  path: string;
  questions: ReviewQuestion[];
}

export interface EvalRunSummary {
  file: string;
  path: string;
  reviewed: boolean;
}

export interface QuestionReview {
  id: string;
  score: string;
  notes: string;
}

export interface OverallReview {
  style: string;
  faithfulness: string;
  usefulness: string;
  quoteHonesty: string;
  impersonation: string;
  notes: string;
}

export interface ParsedInteractiveReview {
  overall: OverallReview;
}

function parseQuestions(markdown: string): ReviewQuestion[] {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const questions: ReviewQuestion[] = [];
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i]!.match(/^##\s+(\d+)\.\s+(.+)$/);
    if (!heading) continue;
    const id = heading[1]!;
    const prompt = heading[2]!.trim();
    const block: string[] = [];
    i += 1;
    while (i < lines.length && !/^##\s+\d+\.\s+/.test(lines[i]!) && lines[i] !== '# Human Review') {
      block.push(lines[i]!);
      i += 1;
    }
    i -= 1;
    const reviewAt = block.findIndex(l => l.trim() === '### Review');
    const body = reviewAt >= 0 ? block.slice(0, reviewAt) : block;
    const exitAt = body.findIndex(l => /^Exit code:/.test(l));
    const answer = (exitAt >= 0 ? body.slice(exitAt + 1) : body)
      .join('\n')
      .trim();
    questions.push({ id, prompt, answer: answer || '(no output)' });
  }
  return questions;
}

export function parseInteractiveReview(markdown: string): ParsedInteractiveReview | null {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const start = lines.findIndex(line => line.trim() === '# Interactive Review');
  if (start < 0) return null;
  const block = lines.slice(start + 1);
  const overallAt = block.findIndex(line => line.trim() === '## Overall');
  if (overallAt < 0) return null;
  const body = block.slice(overallAt + 1);
  const nextHeadingAt = body.findIndex(line => line.trim().startsWith('## '));
  const section = (nextHeadingAt >= 0 ? body.slice(0, nextHeadingAt) : body).map(line => line.trimEnd());

  const get = (prefix: string): string => {
    const match = section.find(line => line.toLowerCase().startsWith(prefix.toLowerCase()));
    return match ? match.slice(prefix.length).trim() : '';
  };

  const notesAt = section.findIndex(line => line.trim().toLowerCase() === 'notes:');
  const notes =
    notesAt >= 0
      ? section
          .slice(notesAt + 1)
          .join('\n')
          .trim()
      : '';

  const overall: OverallReview = {
    style: get('style:'),
    faithfulness: get('faithfulness:'),
    usefulness: get('usefulness:'),
    quoteHonesty: get('quote honesty:'),
    impersonation: get('impersonation:'),
    notes: notes === '(none)' ? '' : notes,
  };

  if (!overall.style || !overall.faithfulness || !overall.usefulness || !overall.quoteHonesty || !overall.impersonation) {
    return null;
  }

  return { overall };
}

export async function loadLatestEvalRun(name: string): Promise<LoadedEvalRun> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const runsDir = path.join(model.dir, 'eval', 'runs');
  const entries = await fs.readdir(runsDir, { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => e.name)
    .sort();
  const latest = files[files.length - 1];
  if (!latest) throw new Error(`no eval runs found for ${name}; run models eval ${name} first`);
  const runPath = path.join(runsDir, latest);
  const markdown = await fs.readFile(runPath, 'utf8');
  const questions = parseQuestions(markdown);
  if (questions.length === 0) throw new Error(`no question blocks found in ${runPath}`);
  return { path: runPath, questions };
}

export async function loadEvalRun(name: string, runId?: string): Promise<LoadedEvalRun> {
  if (!runId) return loadLatestEvalRun(name);
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const runs = await listEvalRuns(name);
  const needle = runId.endsWith('.md') ? runId : `${runId}.md`;
  const match = runs.find(r => r.file === needle) ?? runs.find(r => r.file.startsWith(runId));
  if (!match) throw new Error(`eval run not found: ${runId}`);
  const markdown = await fs.readFile(match.path, 'utf8');
  const questions = parseQuestions(markdown);
  if (questions.length === 0) throw new Error(`no question blocks found in ${match.path}`);
  return { path: match.path, questions };
}

export async function listEvalRuns(name: string): Promise<EvalRunSummary[]> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);
  const runsDir = path.join(model.dir, 'eval', 'runs');
  const entries = await fs.readdir(runsDir, { withFileTypes: true }).catch(() => []);
  const out: EvalRunSummary[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const runPath = path.join(runsDir, entry.name);
    const body = await fs.readFile(runPath, 'utf8').catch(() => '');
    out.push({
      file: entry.name,
      path: runPath,
      reviewed: body.includes('# Interactive Review'),
    });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

export async function writeInteractiveReview(
  runPath: string,
  questionReviews: QuestionReview[],
  overall: OverallReview
): Promise<void> {
  const original = await fs.readFile(runPath, 'utf8');
  const base = original.replace(/\n# Interactive Review[\s\S]*$/m, '').trimEnd();
  const lines: string[] = ['', '# Interactive Review', ''];
  for (const r of questionReviews) {
    lines.push(`## Question ${r.id}`);
    lines.push('');
    lines.push(`score: ${r.score}/5`);
    lines.push('notes:');
    lines.push(r.notes || '(none)');
    lines.push('');
  }
  lines.push('## Overall');
  lines.push('');
  lines.push(`style: ${overall.style}/5`);
  lines.push(`faithfulness: ${overall.faithfulness}/5`);
  lines.push(`usefulness: ${overall.usefulness}/5`);
  lines.push(`quote honesty: ${overall.quoteHonesty}`);
  lines.push(`impersonation: ${overall.impersonation}`);
  lines.push('');
  lines.push('notes:');
  lines.push(overall.notes || '(none)');
  lines.push('');
  await fs.writeFile(runPath, `${base}\n${lines.join('\n')}`, 'utf8');
}
