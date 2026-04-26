// Renders the c9ai banner directly to stdout as ANSI text — no React, no Ink.
// Once written, the banner is just terminal scrollback: it scrolls off
// naturally as the conversation grows, exactly like Claude Code's banner.

import cfonts from 'cfonts';
import os from 'node:os';

const C = '\x1b[36m';   // cyan
const G = '\x1b[90m';   // gray (bright black)
const B = '\x1b[1m';    // bold
const R = '\x1b[0m';    // reset

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function visualWidth(s: string): number {
  return s.replace(ANSI_RE, '').length;
}

function padRight(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - visualWidth(s)));
}

function center(s: string, width: number): string {
  const visible = visualWidth(s);
  if (visible >= width) return s;
  const left = Math.floor((width - visible) / 2);
  const right = width - visible - left;
  return ' '.repeat(left) + s + ' '.repeat(right);
}

function shortCwd(): string {
  const cwd = process.cwd();
  const home = os.homedir();
  return cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd;
}

interface CfontsResult {
  string: string;
  array: string[];
}

function renderLogo(text: string): string[] {
  // cfonts is CJS; under Node ESM, the default import gives us module.exports.
  const result = (cfonts as unknown as { render: (text: string, opts: unknown) => CfontsResult }).render(text, {
    font: 'tiny',
    colors: ['cyan'],
    space: false,
    background: 'transparent',
    env: 'node',
    align: 'left',
  });

  // cfonts embeds \n\n padding inside its .array entries — use .string and
  // split to get clean per-row glyphs.
  const raw = result?.string ?? '';
  return raw
    .split('\n')
    .filter(line => line.replace(ANSI_RE, '').trim().length > 0);
}

export function printBanner(version: string, model: string): number {
  const cols = process.stdout.columns ?? 80;
  if (cols < 50) {
    // Compact fallback for narrow terminals
    process.stdout.write(`${B}${C}c9ai${R}  ${G}v${version}${R}  ·  ${C}${model}${R}\n\n`);
    return 2; // 1 line of content + 1 trailing blank
  }

  const innerW = cols - 2; // outer ╭...╮
  const leftCellW = Math.floor((innerW - 1) / 2); // - 1 for the divider │
  const rightCellW = innerW - leftCellW - 1;

  const logoLines = renderLogo('c9ai');
  const cwd = shortCwd();

  const left: string[] = [
    ` ${B}${C}c9ai${R}  ${G}v${version}${R}`,
    '',
    center('Welcome to c9ai', leftCellW),
    '',
    ...logoLines.map(line => center(line, leftCellW)),
    '',
    center(`${C}${model}${R}`, leftCellW),
    center(`${G}${cwd}${R}`, leftCellW),
  ];

  const right: string[] = [
    ` ${B}${C}Quick start${R}`,
    ` help          ${G}show commands${R}`,
    ` todos         ${G}GitHub issues backlog${R}`,
    ` !command      ${G}run a shell command${R}`,
    ` claude <...>  ${G}chat with claude${R}`,
    '',
    ` ${B}${C}Status${R}`,
    ` ${G}skills: not loaded yet${R}`,
    ` ${G}artifacts: logs only${R}`,
  ];

  const rows = Math.max(left.length, right.length);
  const out: string[] = [];

  out.push(`${C}╭${'─'.repeat(innerW)}╮${R}`);
  for (let i = 0; i < rows; i++) {
    const l = padRight(left[i] ?? '', leftCellW);
    const r = padRight(right[i] ?? '', rightCellW);
    out.push(`${C}│${R}${l}${C}│${R}${r}${C}│${R}`);
  }
  out.push(`${C}╰${'─'.repeat(innerW)}╯${R}`);

  process.stdout.write(out.join('\n') + '\n\n');
  return out.length + 1; // box rows + 1 trailing blank line
}
