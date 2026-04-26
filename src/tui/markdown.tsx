import React from 'react';
import { Text } from 'ink';

/**
 * Minimal markdown-to-Ink renderer for streaming model output. Per-line
 * because the streaming pipeline promotes one completed line at a time
 * into <Static> history. Multi-line constructs (fenced code blocks,
 * cross-line bold) aren't supported — small models rarely need them, and
 * doing them right requires a stateful parser across the whole message.
 *
 * Handled:
 *   #..###### header        → bold + color
 *   - foo / * foo            → • foo (bullet)
 *   N. foo                   → keeps the number, just trims trailing space
 *   ---                      → dim horizontal rule (rendered as ─ × width)
 *   **bold**                 → ANSI bold
 *   `code`                   → dim
 *   table separator row      → suppressed (the `| :--- | :--- |` noise)
 *
 * Italic (*foo*) is intentionally skipped — too ambiguous with bullet `*`.
 */
interface Segment {
  text: string;
  bold?: boolean;
  dim?: boolean;
}

function parseInline(line: string): Segment[] {
  const out: Segment[] = [];
  let buf = '';
  let i = 0;

  const flush = () => {
    if (buf) {
      out.push({ text: buf });
      buf = '';
    }
  };

  while (i < line.length) {
    // **bold**
    if (line.startsWith('**', i)) {
      const end = line.indexOf('**', i + 2);
      if (end !== -1 && end > i + 2) {
        flush();
        out.push({ text: line.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }
    // `code`
    if (line[i] === '`') {
      const end = line.indexOf('`', i + 1);
      if (end !== -1 && end > i + 1) {
        flush();
        out.push({ text: line.slice(i + 1, end), dim: true });
        i = end + 1;
        continue;
      }
    }
    buf += line[i];
    i += 1;
  }
  flush();
  return out;
}

function renderSegments(segments: Segment[]): React.ReactNode {
  if (segments.length === 0) return null;
  if (segments.length === 1 && !segments[0]!.bold && !segments[0]!.dim) {
    return segments[0]!.text;
  }
  return segments.map((s, idx) => (
    <Text key={idx} bold={s.bold} dimColor={s.dim}>
      {s.text}
    </Text>
  ));
}

const HEADER_COLORS: Record<number, string | undefined> = {
  1: 'cyan',
  2: 'cyan',
  3: 'yellow',
  4: 'yellow',
  5: undefined,
  6: undefined,
};

export function renderMarkdownLine(
  line: string,
  width: number
): React.ReactNode {
  if (line === '') return '';

  // table separator: | :--- | :--- |   → swallow (pure noise)
  if (/^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(line)) {
    return null;
  }

  // horizontal rule
  if (/^\s*-{3,}\s*$/.test(line) || /^\s*\*{3,}\s*$/.test(line)) {
    const w = Math.max(0, width - 2);
    return (
      <Text dimColor>{'─'.repeat(w)}</Text>
    );
  }

  // headers
  const header = line.match(/^(#{1,6})\s+(.*)$/);
  if (header) {
    const level = header[1]!.length;
    const text = header[2]!;
    return (
      <Text bold color={HEADER_COLORS[level]}>
        {text}
      </Text>
    );
  }

  // bullets:  - foo  /  * foo  (any indent)
  const bullet = line.match(/^(\s*)[\*\-]\s+(.*)$/);
  if (bullet) {
    const indent = bullet[1] ?? '';
    const rest = bullet[2] ?? '';
    return (
      <Text>
        {indent}
        <Text color="cyan">• </Text>
        {renderSegments(parseInline(rest))}
      </Text>
    );
  }

  return renderSegments(parseInline(line));
}
