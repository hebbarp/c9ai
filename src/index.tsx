#!/usr/bin/env node
// MUST be first: loads .env files before any module reads process.env at top level.
import './core/env.js';
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { App } from './App.js';
import { loadConfig } from './core/config.js';
import { getProvider } from './providers/registry.js';
import { isProviderName } from './core/config.js';
import { printBanner } from './tui/printBanner.js';
import { configureOllama } from './providers/ollama.js';

const VERSION = '4.0.0-alpha.1';

const cli = meow(
  `
  Usage
    $ c9ai                          start interactive TUI
    $ c9ai claude "<prompt>"        one-shot to Claude
    $ c9ai gemini "<prompt>"        one-shot to Gemini
    $ c9ai ollama "<prompt>"        one-shot to local Ollama

  Options
    --version                       show version
    --help                          show help
`,
  {
    importMeta: import.meta,
    flags: {},
  }
);

async function runOneShot(model: string, prompt: string): Promise<number> {
  if (!isProviderName(model)) {
    process.stderr.write(`unknown model: ${model}\n`);
    return 2;
  }
  const provider = getProvider(model);
  const ok = await provider.available();
  if (!ok) {
    process.stderr.write(`${provider.name} not available (${provider.bin})\n`);
    return 127;
  }
  const result = await provider.chat(
    [{ role: 'user', content: prompt }],
    chunk => process.stdout.write(chunk)
  );
  return result.exitCode;
}

async function main(): Promise<void> {
  const [first, ...rest] = cli.input;
  const config = await loadConfig();

  if (config.ollamaModel || config.ollamaUrl) {
    configureOllama({
      ...(config.ollamaModel ? { model: config.ollamaModel } : {}),
      ...(config.ollamaUrl ? { url: config.ollamaUrl } : {}),
    });
  }

  if (first && (first === 'claude' || first === 'gemini' || first === 'ollama')) {
    const prompt = rest.join(' ').trim();
    if (!prompt) {
      process.stderr.write(`usage: c9ai ${first} "<prompt>"\n`);
      process.exit(2);
    }
    const code = await runOneShot(first, prompt);
    process.exit(code);
  }

  // Print the banner as plain ANSI text BEFORE Ink mounts.
  // It enters the terminal scrollback like any other shell output and
  // scrolls off naturally as the conversation grows.
  printBanner(VERSION, config.defaultModel);

  const app = render(<App initialConfig={config} />);
  await app.waitUntilExit();
}

main().catch(err => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
