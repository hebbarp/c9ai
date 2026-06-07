import type { ChatMessage, ProviderName } from '../core/types.js';
import type { ChatResult, Provider } from './types.js';

interface Preset {
  name: Extract<ProviderName, 'openai' | 'gpt' | 'kimi' | 'deepseek' | 'openrouter'>;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  apiKeyEnv: string;
  modelEnv: string;
  baseUrlEnv: string;
}

export type OpenAICompatibleProviderName = Preset['name'];

const PRESETS: Record<OpenAICompatibleProviderName, Preset> = {
  openai: {
    name: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    baseUrlEnv: 'OPENAI_BASE_URL',
  },
  gpt: {
    name: 'gpt',
    label: 'OpenAI GPT',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    baseUrlEnv: 'OPENAI_BASE_URL',
  },
  kimi: {
    name: 'kimi',
    label: 'Kimi',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-128k',
    apiKeyEnv: 'KIMI_API_KEY',
    modelEnv: 'KIMI_MODEL',
    baseUrlEnv: 'KIMI_BASE_URL',
  },
  deepseek: {
    name: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    modelEnv: 'DEEPSEEK_MODEL',
    baseUrlEnv: 'DEEPSEEK_BASE_URL',
  },
  openrouter: {
    name: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'OPENROUTER_MODEL',
    baseUrlEnv: 'OPENROUTER_BASE_URL',
  },
};

interface Settings {
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
  /** true when the base URL was overridden via env — local OpenAI-compatible
   * servers (LM Studio, llama.cpp, vLLM, …) don't require an API key. */
  baseUrlOverridden: boolean;
}

function settings(preset: Preset): Settings {
  const baseUrlOverride = process.env[preset.baseUrlEnv];
  return {
    baseUrl: (baseUrlOverride || preset.defaultBaseUrl).replace(/\/+$/, ''),
    apiKey: process.env[preset.apiKeyEnv],
    model: process.env[preset.modelEnv] || preset.defaultModel,
    baseUrlOverridden: Boolean(baseUrlOverride),
  };
}

/** A key is required only when talking to the preset's hosted default URL. */
function hasCredentials(s: Settings): boolean {
  return Boolean(s.apiKey) || s.baseUrlOverridden;
}

function toWireMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  return messages.map(m => ({ role: m.role, content: m.content }));
}

function headers(preset: Preset, apiKey: string | undefined): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
  if (preset.name === 'openrouter') {
    h['HTTP-Referer'] = 'https://github.com/hebbarp/c9ai';
    h['X-Title'] = 'c9ai';
  }
  return h;
}

async function availableFor(preset: Preset): Promise<boolean> {
  return hasCredentials(settings(preset));
}

export function isOpenAICompatibleProviderName(value: string): value is OpenAICompatibleProviderName {
  return value === 'openai' || value === 'gpt' || value === 'kimi' || value === 'deepseek' || value === 'openrouter';
}

export function listOpenAICompatibleProviderNames(): OpenAICompatibleProviderName[] {
  return Object.keys(PRESETS) as OpenAICompatibleProviderName[];
}

interface ModelsResponse {
  data?: Array<{ id?: string }>;
  error?: { message?: string };
}

export async function listOpenAICompatibleModels(
  name: OpenAICompatibleProviderName
): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  const preset = PRESETS[name];
  const s = settings(preset);
  if (!hasCredentials(s)) {
    return { ok: false, error: `${preset.apiKeyEnv} is not set (or point ${preset.baseUrlEnv} at a local server)` };
  }

  let res: Response;
  try {
    res = await fetch(`${s.baseUrl}/models`, {
      method: 'GET',
      headers: {
        ...(s.apiKey ? { Authorization: `Bearer ${s.apiKey}` } : {}),
        Accept: 'application/json',
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: `cannot reach ${s.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const text = await res.text().catch(() => '');
  let parsed: ModelsResponse | null = null;
  try {
    parsed = text ? (JSON.parse(text) as ModelsResponse) : null;
  } catch {
    // fall through to HTTP error below
  }

  if (!res.ok) {
    const detail = parsed?.error?.message || text || res.statusText;
    return { ok: false, error: `HTTP ${res.status}: ${detail}` };
  }

  const models = (parsed?.data ?? [])
    .map(m => m.id)
    .filter((id): id is string => Boolean(id))
    .sort();
  return { ok: true, models };
}

function parseSseLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const data = trimmed.slice(5).trim();
  if (!data || data === '[DONE]') return null;
  try {
    const obj = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (obj.error?.message) return `\n[openai-compatible error: ${obj.error.message}]\n`;
    return obj.choices?.[0]?.delta?.content ?? obj.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

async function chatFor(
  preset: Preset,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<ChatResult> {
  const s = settings(preset);
  if (!hasCredentials(s)) {
    onChunk(
      `no ${preset.apiKeyEnv} in environment\n` +
        `set it in your shell, a .env file, or ~/.c9ai/.env — or set ${preset.baseUrlEnv} to a local OpenAI-compatible server (LM Studio, llama.cpp, vLLM), which needs no key\n`
    );
    return { exitCode: 127 };
  }
  if (messages.length === 0) {
    onChunk('(no messages to send)\n');
    return { exitCode: 2 };
  }

  let res: Response;
  try {
    res = await fetch(`${s.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: headers(preset, s.apiKey),
      body: JSON.stringify({
        model: s.model,
        messages: toWireMessages(messages),
        stream: true,
      }),
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    if (signal?.aborted) return { exitCode: 0, aborted: true };
    onChunk(`\n[${preset.name}: cannot reach ${s.baseUrl}: ${err instanceof Error ? err.message : String(err)}]\n`);
    return { exitCode: -1 };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      onChunk(`\n[${preset.name}: invalid or unauthorized ${preset.apiKeyEnv}]\n`);
      return { exitCode: res.status };
    }
    if (res.status === 404) {
      onChunk(`\n[${preset.name}: model or endpoint not found (${s.model} @ ${s.baseUrl})]\n`);
      return { exitCode: 404 };
    }
    onChunk(`\n[${preset.name} HTTP ${res.status}: ${body || res.statusText}]\n`);
    return { exitCode: res.status };
  }
  if (!res.body) {
    onChunk(`\n[${preset.name}: empty response body]\n`);
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
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const chunk = parseSseLine(line);
        if (chunk) onChunk(chunk);
        nl = buffer.indexOf('\n');
      }
    }
  } catch (err) {
    if (signal?.aborted) return { exitCode: 0, aborted: true };
    onChunk(`\n[${preset.name} stream error: ${err instanceof Error ? err.message : String(err)}]\n`);
    return { exitCode: -1 };
  }

  return { exitCode: 0 };
}

function makeProvider(preset: Preset): Provider {
  return {
    name: preset.name,
    get bin() {
      const s = settings(preset);
      return `${preset.label} HTTP (${s.model} @ ${s.baseUrl})`;
    },
    available: () => availableFor(preset),
    chat: (messages, onChunk, signal) => chatFor(preset, messages, onChunk, signal),
  };
}

export const openaiProvider = makeProvider(PRESETS.openai);
export const gptProvider = makeProvider(PRESETS.gpt);
export const kimiProvider = makeProvider(PRESETS.kimi);
export const deepseekProvider = makeProvider(PRESETS.deepseek);
export const openrouterProvider = makeProvider(PRESETS.openrouter);
