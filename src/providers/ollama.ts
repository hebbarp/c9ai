import type { ChatMessage } from '../core/types.js';
import type { Provider, ChatResult } from './types.js';

const DEFAULT_URL = 'http://localhost:11434';

interface OllamaSettings {
  url: string;
  /** undefined means "auto-detect from /api/tags on first use". */
  model: string | undefined;
}

let settings: OllamaSettings = {
  url: process.env.OLLAMA_URL || DEFAULT_URL,
  model: process.env.OLLAMA_MODEL || undefined,
};

export function configureOllama(next: Partial<OllamaSettings>): void {
  settings = { ...settings, ...next };
}

export function getOllamaSettings(): { url: string; model: string | undefined } {
  return { ...settings };
}

interface TagsResponse {
  models?: Array<{ name: string; model?: string }>;
}

export async function listInstalledOllamaModels(): Promise<string[]> {
  try {
    const res = await fetch(`${settings.url}/api/tags`, { method: 'GET' });
    if (!res.ok) return [];
    const data = (await res.json()) as TagsResponse;
    return (data.models ?? []).map(m => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Resolve which model to use right now. If `settings.model` was set
 * explicitly (env, config, or `switch ollama <model>`), use it. Otherwise
 * fall back to the only installed model, or null if there are 0 or 2+
 * (caller should surface a helpful error).
 */
async function resolveModel(): Promise<{ model: string | null; reason?: string }> {
  if (settings.model) return { model: settings.model };
  const installed = await listInstalledOllamaModels();
  if (installed.length === 0) {
    return {
      model: null,
      reason:
        `no ollama models installed at ${settings.url}.\n` +
        `pull one first, e.g. \`ollama pull llama3.2\`, then \`switch ollama <name>\`.`,
    };
  }
  if (installed.length === 1) {
    settings.model = installed[0];
    return { model: settings.model! };
  }
  return {
    model: null,
    reason:
      `multiple ollama models installed; pick one with \`switch ollama <name>\`:\n` +
      installed.map(m => `  ${m}`).join('\n'),
  };
}

async function available(): Promise<boolean> {
  try {
    const res = await fetch(`${settings.url}/api/tags`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

interface ChatLine {
  message?: { role: string; content: string };
  done?: boolean;
  error?: string;
}

async function chat(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<ChatResult> {
  if (messages.length === 0) {
    onChunk('(no messages to send)\n');
    return { exitCode: 2 };
  }

  const resolved = await resolveModel();
  if (!resolved.model) {
    onChunk(`\n[ollama: ${resolved.reason}]\n`);
    return { exitCode: 2 };
  }

  let res: Response;
  try {
    res = await fetch(`${settings.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: resolved.model,
        // Ollama supports role: 'system' natively, just pass everything through.
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
      }),
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    if (signal?.aborted) {
      return { exitCode: 0, aborted: true };
    }
    onChunk(
      `\n[ollama: cannot reach ${settings.url} — is \`ollama serve\` running?]\n` +
        `${err instanceof Error ? err.message : String(err)}\n`
    );
    return { exitCode: -1 };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    onChunk(`\n[ollama HTTP ${res.status}: ${body || res.statusText}]\n`);
    return { exitCode: res.status };
  }
  if (!res.body) {
    onChunk('\n[ollama: empty response body]\n');
    return { exitCode: -1 };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) {
          try {
            const obj = JSON.parse(line) as ChatLine;
            if (obj.error) {
              onChunk(`\n[ollama error: ${obj.error}]\n`);
              return { exitCode: -1 };
            }
            if (obj.message?.content) onChunk(obj.message.content);
          } catch {
            // skip malformed line; ollama is generally well-formed
          }
        }
        nl = buffer.indexOf('\n');
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      return { exitCode: 0, aborted: true };
    }
    onChunk(`\n[ollama stream error: ${err instanceof Error ? err.message : String(err)}]\n`);
    return { exitCode: -1 };
  }

  return { exitCode: 0 };
}

export const ollamaProvider: Provider = {
  name: 'ollama',
  get bin() {
    return `ollama-http (${settings.model ?? 'auto'} @ ${settings.url})`;
  },
  available,
  chat,
};
