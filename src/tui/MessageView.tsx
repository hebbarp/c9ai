import React from 'react';
import { Box, Text, useStdout } from 'ink';
import type { LineKind } from '../core/types.js';
import { renderMarkdownLine } from './markdown.js';

const COLORS: Record<Exclude<LineKind, 'banner'>, string | undefined> = {
  user: 'cyan',
  system: 'gray',
  provider: undefined, // terminal default — easier on the eye than forcing white
  shell: undefined,    // ditto; was bright green which read as DOS
  tool: undefined,
  error: 'red',
};

const PREFIX: Record<Exclude<LineKind, 'banner'>, string> = {
  user: '› ',
  system: '· ',
  provider: '',
  shell: '$ ',
  tool: '⌬ ',
  error: '✗ ',
};

// Kinds whose text is markdown emitted by a model — those get rendered with
// bold/headers/bullets. User input + shell output stay raw so we don't
// accidentally restyle their literal characters.
const MARKDOWN_KINDS: ReadonlySet<Exclude<LineKind, 'banner'>> = new Set([
  'provider',
]);

function toVisualLines(text: string): string[] {
  const raw = text.replace(/\r/g, '').split('\n');
  while (raw.length > 0 && raw[raw.length - 1] === '') {
    raw.pop();
  }
  return raw.length > 0 ? raw : [''];
}

export function MessageView({
  kind,
  text,
}: {
  kind: Exclude<LineKind, 'banner'>;
  text: string;
}) {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const lines = toVisualLines(text);
  const color = COLORS[kind];
  const prefix = PREFIX[kind];
  const continuationPrefix = ' '.repeat(prefix.length);
  const useMarkdown = MARKDOWN_KINDS.has(kind);

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => {
        const lead = i === 0 ? prefix : continuationPrefix;
        if (useMarkdown) {
          const rendered = renderMarkdownLine(line, width);
          // table-separator noise: swallow the line entirely
          if (rendered === null) return null;
          return (
            <Text key={i} color={color}>
              {lead}
              {rendered}
            </Text>
          );
        }
        return (
          <Text key={i} color={color}>
            {lead}
            {line}
          </Text>
        );
      })}
    </Box>
  );
}
