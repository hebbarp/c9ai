import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage } from '../core/types.js';
import type { Provider, ChatResult } from './types.js';

const DEFAULT_MODEL = 'claude-opus-4-7';

function getModel(): string {
  return process.env.CLAUDE_MODEL || DEFAULT_MODEL;
}

let client: Anthropic | null = null;

function getApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}

function getClient(): Anthropic | null {
  if (client) return client;
  const apiKey = getApiKey();
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

async function available(): Promise<boolean> {
  return Boolean(getApiKey());
}

async function chat(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<ChatResult> {
  const c = getClient();
  if (!c) {
    onChunk(
      'no ANTHROPIC_API_KEY in environment\n' +
        'set it in your shell, in a .env file in this directory, or in ~/.c9ai/.env, then restart c9ai\n' +
        'no API key? use a local model instead: `switch ollama`\n'
    );
    return { exitCode: 127 };
  }

  if (messages.length === 0) {
    onChunk('(no messages to send)\n');
    return { exitCode: 2 };
  }

  // Anthropic takes `system` as a top-level parameter, not a message role.
  // Concatenate any system messages we received and pass them through.
  const systemParts = messages
    .filter(m => m.role === 'system')
    .map(m => m.content);
  const dialog = messages.filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant');
  const system = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

  if (dialog.length === 0) {
    onChunk('(no user message to send)\n');
    return { exitCode: 2 };
  }

  try {
    const stream = c.messages.stream(
      {
        model: getModel(),
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        // Top-level cache_control auto-places on the last cacheable block,
        // so the entire conversation prefix gets cached on each turn.
        // Cache hits drop input cost ~10x — meaningful as the chat grows.
        cache_control: { type: 'ephemeral' },
        ...(system ? { system } : {}),
        messages: dialog.map(m => ({ role: m.role, content: m.content })),
      },
      signal ? { signal } : undefined
    );

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        onChunk(event.delta.text);
      }
    }

    return { exitCode: 0 };
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError || signal?.aborted) {
      return { exitCode: 0, aborted: true };
    }
    if (err instanceof Anthropic.AuthenticationError) {
      onChunk(`\n[claude API: invalid ANTHROPIC_API_KEY]\n`);
      return { exitCode: 401 };
    }
    if (err instanceof Anthropic.RateLimitError) {
      onChunk(`\n[claude API: rate limited — try again in a moment]\n`);
      return { exitCode: 429 };
    }
    if (err instanceof Anthropic.APIError) {
      onChunk(`\n[claude API error ${err.status}: ${err.message}]\n`);
      return { exitCode: -1 };
    }
    onChunk(`\n[claude error: ${err instanceof Error ? err.message : String(err)}]\n`);
    return { exitCode: -1 };
  }
}

export const claudeProvider: Provider = {
  name: 'claude',
  get bin() {
    return `anthropic-sdk (${getModel()})`;
  },
  available,
  chat,
};
