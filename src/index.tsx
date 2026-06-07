#!/usr/bin/env node
// MUST be first: loads .env files before any module reads process.env at top level.
import './core/env.js';
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { createRequire } from 'node:module';
import { App } from './App.js';
import { loadConfig } from './core/config.js';
import { getProvider } from './providers/registry.js';
import { isProviderName } from './core/config.js';
import { printBanner } from './tui/printBanner.js';
import { configureOllama } from './providers/ollama.js';

// Resolve the version from package.json (one level up from src/ in dev,
// from dist/ in the published package) so the banner can never go stale.
const require = createRequire(import.meta.url);
const VERSION: string = (require('../package.json') as { version: string }).version;

const cli = meow(
  `
  Usage
    $ c9ai                          start interactive TUI
    $ c9ai claude "<prompt>"        one-shot to Claude
    $ c9ai gemini "<prompt>"        one-shot to Gemini
    $ c9ai ollama "<prompt>"        one-shot to local Ollama
    $ c9ai soul "<prompt>"          one-shot to Soul overlay
    $ c9ai openai "<prompt>"        one-shot to OpenAI HTTP
    $ c9ai kimi "<prompt>"          one-shot to Kimi
    $ c9ai deepseek "<prompt>"      one-shot to DeepSeek
    $ c9ai openrouter "<prompt>"    one-shot to OpenRouter

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
  const modelArg = first === 'chaitanya' ? 'soul' : first;
  const config = await loadConfig();

  if (config.ollamaModel || config.ollamaUrl) {
    configureOllama({
      ...(config.ollamaModel ? { model: config.ollamaModel } : {}),
      ...(config.ollamaUrl ? { url: config.ollamaUrl } : {}),
    });
  }

  if (modelArg && isProviderName(modelArg)) {
    const prompt = rest.join(' ').trim();
    if (!prompt) {
      process.stderr.write(`usage: c9ai ${first} "<prompt>"\n`);
      process.exit(2);
    }
    const code = await runOneShot(modelArg, prompt);
    process.exit(code);
  }

  // Unknown positional args: fail loudly instead of silently dropping them
  // and launching the TUI (confusing for `c9ai lama3 "hi"` typos and scripts).
  if (modelArg) {
    process.stderr.write(`unknown provider: ${modelArg} (run \`c9ai --help\` for usage)\n`);
    process.exit(2);
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
