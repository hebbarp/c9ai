#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_INPUT = 'D:\\karavebooks\\pampa';
const DEFAULT_OUT = path.resolve('outputs', 'pampa-corpus-audit');

function parseArgs(argv) {
  const opts = {
    input: DEFAULT_INPUT,
    out: DEFAULT_OUT,
    samplePages: 3,
    noPdfTools: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') opts.input = argv[++i];
    else if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--sample-pages') opts.samplePages = Number(argv[++i]);
    else if (arg === '--no-pdf-tools') opts.noPdfTools = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(opts.samplePages) || opts.samplePages < 1) {
    throw new Error('--sample-pages must be a positive number');
  }

  opts.input = path.resolve(opts.input);
  opts.out = path.resolve(opts.out);
  return opts;
}

function printHelp() {
  console.log(`Pampa corpus audit

Usage:
  node scripts/pampa-corpus-audit.mjs [--input D:\\karavebooks\\pampa] [--out outputs\\pampa-corpus-audit]

Options:
  --input <path>         Local corpus folder or single file to audit.
  --out <dir>            Output folder for manifest, report, and samples.
  --sample-pages <n>     Number of first pages to sample with pdftotext. Default: 3.
  --no-pdf-tools         Skip pdfinfo/pdftotext calls and only inventory files.
`);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root) {
  const out = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out.sort((a, b) => a.localeCompare(b));
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

async function run(command, args, timeout = 30000) {
  try {
    const result = await execFileAsync(command, args, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout,
      windowsHide: true,
    });
    return {
      ok: true,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      error: err.message ?? String(err),
    };
  }
}

function parsePdfInfo(stdout) {
  const info = {};
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) info[match[1].trim().toLowerCase().replace(/\s+/g, '_')] = match[2].trim();
  }
  return info;
}

function countKannadaChars(text) {
  const matches = text.match(/[\u0C80-\u0CFF]/g);
  return matches ? matches.length : 0;
}

function qualityFromSample(sampleText) {
  const total = sampleText.replace(/\s/g, '').length;
  const kannada = countKannadaChars(sampleText);
  if (total === 0) return 'no-text';
  const ratio = kannada / total;
  if (ratio > 0.4) return 'kannada-text-present';
  if (ratio > 0.1) return 'mixed-or-noisy-text';
  return 'low-kannada-signal';
}

function inferWork(filename) {
  const lower = filename.toLowerCase();
  if (
    lower.includes('adipurana') ||
    lower.includes('adipur') ||
    filename.includes('ಆದಿಪುರಾಣ') ||
    filename.includes('ಆದಿಪುರಾಣಂ') ||
    filename.includes('ಆದಿಷುರಾಣ') ||
    filename.includes('ಆದಿಷುರಾಣಂ')
  ) return 'Adipurana';
  if (lower.includes('bharat') || lower.includes('vikramarjuna')) return 'Vikramarjuna Vijaya / Pampa Bharata';
  if (lower.includes('notes')) return 'Research notes';
  return 'unknown';
}

function initialUsage(ext) {
  if (ext === '.md' || ext === '.txt') return 'reference-only';
  if (ext === '.pdf') return 'needs-review';
  return 'blocked';
}

async function auditFile(file, root, opts, tools) {
  const stat = await fs.stat(file);
  const ext = path.extname(file).toLowerCase();
  const rel = path.relative(root, file);
  const base = path.basename(file);
  const record = {
    source_path: file,
    relative_path: rel,
    filename: base,
    title: path.basename(file, ext),
    work: inferWork(base),
    extension: ext,
    bytes: stat.size,
    modified_at: stat.mtime.toISOString(),
    publisher: null,
    author_or_editor: null,
    license: 'unknown',
    date_accessed: new Date().toISOString().slice(0, 10),
    usage: initialUsage(ext),
    extraction_method: null,
    page_count: null,
    sample_path: null,
    sample_chars: 0,
    sample_kannada_chars: 0,
    extraction_quality: 'not-sampled',
    quality_notes: [],
  };

  if (ext === '.md' || ext === '.txt') {
    const text = await fs.readFile(file, 'utf8');
    record.extraction_method = 'direct-text';
    record.sample_chars = text.length;
    record.sample_kannada_chars = countKannadaChars(text);
    record.extraction_quality = qualityFromSample(text);
    const sampleName = `${safeName(base)}.sample.txt`;
    const samplePath = path.join(opts.out, 'samples', sampleName);
    await fs.writeFile(samplePath, text.slice(0, 12000), 'utf8');
    record.sample_path = path.relative(opts.out, samplePath);
    return record;
  }

  if (ext !== '.pdf' || opts.noPdfTools) {
    if (opts.noPdfTools && ext === '.pdf') record.quality_notes.push('PDF tools skipped by --no-pdf-tools.');
    return record;
  }

  if (tools.pdfinfo) {
    const pdfInfo = await run('pdfinfo', [file], 30000);
    if (pdfInfo.ok || pdfInfo.stdout) {
      const info = parsePdfInfo(pdfInfo.stdout);
      record.page_count = info.pages ? Number(info.pages) : null;
      record.pdf_info = info;
      const metadataWork = inferWork(`${record.filename} ${info.title ?? ''} ${info.subject ?? ''}`);
      if (metadataWork !== 'unknown') record.work = metadataWork;
    }
    if (!pdfInfo.ok) {
      record.quality_notes.push(`pdfinfo failed: ${oneLine(pdfInfo.error || pdfInfo.stderr)}`);
    }
  } else {
    record.quality_notes.push('pdfinfo not found on PATH.');
  }

  if (tools.pdftotext) {
    const sample = await run(
      'pdftotext',
      ['-enc', 'UTF-8', '-f', '1', '-l', String(opts.samplePages), file, '-'],
      60000,
    );
    const sampleText = sample.stdout || '';
    if (sampleText.trim()) {
      const sampleName = `${safeName(base)}.sample.txt`;
      const samplePath = path.join(opts.out, 'samples', sampleName);
      await fs.writeFile(samplePath, sampleText, 'utf8');
      record.extraction_method = 'pdftotext';
      record.sample_path = path.relative(opts.out, samplePath);
      record.sample_chars = sampleText.length;
      record.sample_kannada_chars = countKannadaChars(sampleText);
      record.extraction_quality = qualityFromSample(sampleText);
    } else {
      record.extraction_quality = 'no-text';
      record.quality_notes.push('pdftotext returned no sample text; likely scanned-only or extraction failed.');
    }
    if (!sample.ok) {
      record.quality_notes.push(`pdftotext exited non-zero: ${oneLine(sample.error || sample.stderr)}`);
    }
  } else {
    record.quality_notes.push('pdftotext not found on PATH.');
  }

  return record;
}

function oneLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

function safeName(name) {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_');
}

function summarize(records) {
  const totalBytes = records.reduce((sum, r) => sum + r.bytes, 0);
  const byExt = new Map();
  const byQuality = new Map();
  for (const record of records) {
    byExt.set(record.extension || '(none)', (byExt.get(record.extension || '(none)') ?? 0) + 1);
    byQuality.set(record.extraction_quality, (byQuality.get(record.extraction_quality) ?? 0) + 1);
  }
  return { totalBytes, byExt, byQuality };
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function writeOutputs(records, opts, tools) {
  await fs.mkdir(opts.out, { recursive: true });
  await fs.mkdir(path.join(opts.out, 'samples'), { recursive: true });

  const manifest = records.map(r => JSON.stringify(r)).join('\n') + '\n';
  await fs.writeFile(path.join(opts.out, 'manifest.jsonl'), manifest, 'utf8');
  await fs.writeFile(path.join(opts.out, 'manifest.pretty.json'), JSON.stringify(records, null, 2), 'utf8');

  const summary = summarize(records);
  const lines = [];
  lines.push('# Pampa Corpus Audit');
  lines.push('');
  lines.push(`Input: \`${opts.input}\``);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Tooling');
  lines.push('');
  lines.push(`- pdfinfo: ${tools.pdfinfo ? 'found' : 'not found'}`);
  lines.push(`- pdftotext: ${tools.pdftotext ? 'found' : 'not found'}`);
  lines.push(`- PDF sampling: ${opts.noPdfTools ? 'skipped' : `${opts.samplePages} page(s)`}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Files: ${records.length}`);
  lines.push(`- Total size: ${formatBytes(summary.totalBytes)}`);
  lines.push('');
  lines.push('By extension:');
  for (const [ext, count] of [...summary.byExt.entries()].sort()) lines.push(`- ${ext}: ${count}`);
  lines.push('');
  lines.push('By extraction quality:');
  for (const [quality, count] of [...summary.byQuality.entries()].sort()) lines.push(`- ${quality}: ${count}`);
  lines.push('');
  lines.push('## Files');
  lines.push('');
  lines.push('| File | Size | Pages | Work | Usage | Quality | Sample | Notes |');
  lines.push('| --- | ---: | ---: | --- | --- | --- | --- | --- |');
  for (const r of records) {
    lines.push([
      escapeCell(r.filename),
      formatBytes(r.bytes),
      r.page_count ?? '',
      escapeCell(r.work),
      r.usage,
      r.extraction_quality,
      r.sample_path ? `\`${r.sample_path}\`` : '',
      escapeCell(r.quality_notes.join(' ')),
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  lines.push('');
  lines.push('## Next Steps');
  lines.push('');
  lines.push('- Review `license` and `usage` before training.');
  lines.push('- Promote only approved public-domain / copyright-free sources to `train`.');
  lines.push('- Use `pdftotext` samples to identify PDFs that need OCR cleanup.');
  lines.push('- Use local Tesseract or Gemini only for pages where embedded text is missing or badly degraded.');
  await fs.writeFile(path.join(opts.out, 'report.md'), lines.join('\n'), 'utf8');
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!(await exists(opts.input))) throw new Error(`input folder does not exist: ${opts.input}`);

  await fs.mkdir(opts.out, { recursive: true });
  await fs.mkdir(path.join(opts.out, 'samples'), { recursive: true });

  const tools = opts.noPdfTools
    ? { pdfinfo: false, pdftotext: false }
    : {
        pdfinfo: await commandExists('pdfinfo'),
        pdftotext: await commandExists('pdftotext'),
      };

  const inputStat = await fs.stat(opts.input);
  const root = inputStat.isFile() ? path.dirname(opts.input) : opts.input;
  const files = inputStat.isFile() ? [opts.input] : await listFiles(opts.input);
  const records = [];
  for (const file of files) {
    records.push(await auditFile(file, root, opts, tools));
  }

  await writeOutputs(records, opts, tools);
  console.log(`Pampa corpus audit complete`);
  console.log(`files: ${records.length}`);
  console.log(`out: ${opts.out}`);
  console.log(`report: ${path.join(opts.out, 'report.md')}`);
}

main().catch(err => {
  console.error(`pampa-corpus-audit: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
