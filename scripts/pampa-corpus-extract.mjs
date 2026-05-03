#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_MANIFEST = path.resolve('outputs', 'pampa-corpus-audit', 'manifest.jsonl');
const DEFAULT_OUT = path.resolve('outputs', 'pampa-corpus-extract');

function parseArgs(argv) {
  const opts = {
    manifest: DEFAULT_MANIFEST,
    out: DEFAULT_OUT,
    minKannadaChars: 100,
    includeReference: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest') opts.manifest = argv[++i];
    else if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--min-kannada-chars') opts.minKannadaChars = Number(argv[++i]);
    else if (arg === '--include-reference') opts.includeReference = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(opts.minKannadaChars) || opts.minKannadaChars < 0) {
    throw new Error('--min-kannada-chars must be zero or a positive number');
  }

  opts.manifest = path.resolve(opts.manifest);
  opts.out = path.resolve(opts.out);
  return opts;
}

function printHelp() {
  console.log(`Pampa corpus extract

Usage:
  node scripts/pampa-corpus-extract.mjs [--manifest outputs\\pampa-corpus-audit\\manifest.jsonl]

Options:
  --manifest <file>          Audit manifest to extract from.
  --out <dir>                Output folder. Default: outputs\\pampa-corpus-extract
  --min-kannada-chars <n>    Minimum Kannada chars per page/document. Default: 100.
  --include-reference        Also include direct text/markdown reference files.
`);
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

async function commandExists(command) {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  try {
    await execFileAsync(lookup, [command], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function run(command, args, timeout = 120000) {
  try {
    const result = await execFileAsync(command, args, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout,
      windowsHide: true,
    });
    return { ok: true, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: null };
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      error: err.message ?? String(err),
    };
  }
}

function countKannadaChars(text) {
  const matches = text.match(/[\u0C80-\u0CFF]/g);
  return matches ? matches.length : 0;
}

function normalizePageText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function sourceId(record, pageNumber = null) {
  const stem = record.filename.replace(/\.[^.]+$/, '');
  return pageNumber == null ? stem : `${stem}#page-${String(pageNumber).padStart(4, '0')}`;
}

async function extractPdf(record, opts, stats) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pampa-pdftotext-'));
  const output = path.join(tempDir, `${record.filename}.txt`);
  try {
    const result = await run('pdftotext', ['-enc', 'UTF-8', record.source_path, output], 180000);
    if (!result.ok) {
      stats.errors.push({
        source_path: record.source_path,
        error: result.error || result.stderr || 'pdftotext failed',
      });
      return [];
    }

    const raw = await fs.readFile(output, 'utf8');
    const pages = raw.split('\f');
    const docs = [];
    pages.forEach((page, idx) => {
      const text = normalizePageText(page);
      const kannadaChars = countKannadaChars(text);
      if (!text || kannadaChars < opts.minKannadaChars) {
        stats.skippedPages += 1;
        return;
      }
      docs.push({
        id: sourceId(record, idx + 1),
        text,
        source_path: record.source_path,
        relative_path: record.relative_path,
        source_title: record.title,
        work: record.work,
        page: idx + 1,
        page_count: record.page_count,
        extraction_method: 'pdftotext',
        extraction_quality: record.extraction_quality,
        license: record.license,
        usage: record.usage,
        date_accessed: record.date_accessed,
        author_or_editor: record.pdf_info?.author ?? record.author_or_editor ?? null,
        publisher: record.publisher,
        source_url: record.pdf_info?.keywords?.startsWith('http') ? record.pdf_info.keywords : null,
        chars: text.length,
        kannada_chars: kannadaChars,
      });
    });
    stats.extractedPdfs += 1;
    return docs;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function extractTextRecord(record, opts, stats) {
  if (!opts.includeReference && record.usage !== 'train' && record.usage !== 'eval') return [];
  const text = normalizePageText(await fs.readFile(record.source_path, 'utf8'));
  const kannadaChars = countKannadaChars(text);
  if (!text || kannadaChars < opts.minKannadaChars) {
    stats.skippedTextFiles += 1;
    return [];
  }
  stats.extractedTextFiles += 1;
  return [{
    id: sourceId(record),
    text,
    source_path: record.source_path,
    relative_path: record.relative_path,
    source_title: record.title,
    work: record.work,
    page: null,
    page_count: null,
    extraction_method: record.extraction_method ?? 'direct-text',
    extraction_quality: record.extraction_quality,
    license: record.license,
    usage: record.usage,
    date_accessed: record.date_accessed,
    author_or_editor: record.author_or_editor,
    publisher: record.publisher,
    source_url: null,
    chars: text.length,
    kannada_chars: kannadaChars,
  }];
}

async function writeOutputs(docs, stats, opts) {
  await fs.mkdir(opts.out, { recursive: true });
  await fs.writeFile(
    path.join(opts.out, 'documents.jsonl'),
    docs.map(doc => JSON.stringify(doc)).join('\n') + (docs.length ? '\n' : ''),
    'utf8',
  );
  await fs.writeFile(path.join(opts.out, 'documents.pretty.json'), JSON.stringify(docs, null, 2), 'utf8');

  const totalChars = docs.reduce((sum, doc) => sum + doc.chars, 0);
  const kannadaChars = docs.reduce((sum, doc) => sum + doc.kannada_chars, 0);
  const bySource = new Map();
  for (const doc of docs) bySource.set(doc.relative_path, (bySource.get(doc.relative_path) ?? 0) + 1);

  const lines = [];
  lines.push('# Pampa Corpus Extract');
  lines.push('');
  lines.push(`Manifest: \`${opts.manifest}\``);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Documents/pages written: ${docs.length}`);
  lines.push(`- Total chars: ${totalChars}`);
  lines.push(`- Kannada chars: ${kannadaChars}`);
  lines.push(`- Extracted PDFs: ${stats.extractedPdfs}`);
  lines.push(`- Skipped low-text pages: ${stats.skippedPages}`);
  lines.push(`- Extracted text files: ${stats.extractedTextFiles}`);
  lines.push(`- Skipped text files: ${stats.skippedTextFiles}`);
  lines.push(`- Errors: ${stats.errors.length}`);
  lines.push('');
  lines.push('## Pages By Source');
  lines.push('');
  for (const [source, count] of [...bySource.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`- ${source}: ${count}`);
  }
  lines.push('');
  lines.push('## Important');
  lines.push('');
  lines.push('These are extraction candidates, not automatically approved training data.');
  lines.push('Keep `usage` and `license` under review before any model training run.');
  if (stats.errors.length) {
    lines.push('');
    lines.push('## Errors');
    lines.push('');
    for (const err of stats.errors) lines.push(`- ${err.source_path}: ${err.error}`);
  }
  await fs.writeFile(path.join(opts.out, 'report.md'), lines.join('\n'), 'utf8');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const records = await readJsonl(opts.manifest);
  if (!(await commandExists('pdftotext'))) throw new Error('pdftotext not found on PATH');

  const stats = {
    extractedPdfs: 0,
    skippedPages: 0,
    extractedTextFiles: 0,
    skippedTextFiles: 0,
    errors: [],
  };

  const docs = [];
  for (const record of records) {
    if (record.extension === '.pdf' && record.extraction_quality === 'kannada-text-present') {
      docs.push(...await extractPdf(record, opts, stats));
    } else if (record.extension === '.md' || record.extension === '.txt') {
      docs.push(...await extractTextRecord(record, opts, stats));
    }
  }

  await writeOutputs(docs, stats, opts);
  console.log('Pampa corpus extract complete');
  console.log(`documents: ${docs.length}`);
  console.log(`out: ${opts.out}`);
  console.log(`report: ${path.join(opts.out, 'report.md')}`);
}

main().catch(err => {
  console.error(`pampa-corpus-extract: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
