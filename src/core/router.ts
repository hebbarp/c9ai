import type { CommandContext, ProviderName, RoutedAction, Command } from './types.js';

export interface RouterOptions {
  defaultProvider: ProviderName;
  commands: Map<string, Command>;
}

const PROVIDER_KEYWORDS: Record<string, ProviderName> = {
  claude: 'claude',
  gemini: 'gemini',
  ollama: 'ollama',
};

export function routeInput(raw: string, opts: RouterOptions): RoutedAction {
  const input = raw.trim();
  if (!input) return { kind: 'empty' };

  if (input === 'exit' || input === 'quit') return { kind: 'exit' };

  if (input.startsWith('!')) {
    return { kind: 'shell', command: input.slice(1).trim() };
  }

  if (input.startsWith('@')) {
    const match = input.match(/^@([^\s]+)\s*([\s\S]*)$/);
    const sigil = match?.[1]?.toLowerCase() ?? '';
    const args = match?.[2]?.trim() ?? '';
    if (sigil in PROVIDER_KEYWORDS) {
      const provider = PROVIDER_KEYWORDS[sigil]!;
      return { kind: 'chat', provider, prompt: args };
    }
    return { kind: 'sigil', sigil, args };
  }

  const [head, ...rest] = input.split(/\s+/);
  const headLower = (head ?? '').toLowerCase();

  if (headLower === 'agent') {
    return { kind: 'agent', goal: rest.join(' ').trim() };
  }

  if (headLower === 'research') {
    return { kind: 'research', input: rest.join(' ').trim() };
  }

  if (headLower in PROVIDER_KEYWORDS) {
    const provider = PROVIDER_KEYWORDS[headLower]!;
    return { kind: 'chat', provider, prompt: rest.join(' ') };
  }

  if (opts.commands.has(headLower)) {
    return { kind: 'command', name: headLower, args: rest };
  }

  return { kind: 'chat', provider: opts.defaultProvider, prompt: input };
}

export type { CommandContext };
