export type ProviderName =
  | 'claude'
  | 'gemini'
  | 'ollama'
  | 'soul'
  | 'openai'
  | 'gpt'
  | 'kimi'
  | 'deepseek'
  | 'openrouter';

export interface AppConfig {
  defaultModel: ProviderName;
  ollamaModel?: string;
  ollamaUrl?: string;
  lastUpdated: string;
}

export type MessageKind = 'user' | 'system' | 'provider' | 'shell' | 'error' | 'tool';
export type LineKind = MessageKind | 'banner';

export interface OutputLine {
  id: string;
  kind: LineKind;
  text: string;
  ts: number;
}

export interface Message {
  id: string;
  kind: MessageKind;
  text: string;
  ts: number;
}

/**
 * Conversational turn passed to providers. The `system` role is for c9ai's
 * own system-prompt injection (profile + agent prompt). Each provider knows
 * how to translate it: Anthropic uses the `system` request parameter,
 * Ollama supports `role: 'system'` natively, Gemini's CLI flattens it onto
 * the user prompt.
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type RoutedAction =
  | { kind: 'empty' }
  | { kind: 'exit' }
  | { kind: 'shell'; command: string }
  | { kind: 'sigil'; sigil: string; args: string }
  | { kind: 'command'; name: string; args: string[] }
  | { kind: 'model-review'; name: string; runId?: string }
  | { kind: 'chat'; provider: ProviderName; prompt: string }
  | { kind: 'agent'; goal: string; provider?: ProviderName }
  | { kind: 'research'; input: string };

export interface CommandContext {
  config: AppConfig;
  saveConfig: (next: Partial<AppConfig>) => Promise<void>;
  emit: (msg: Omit<Message, 'id' | 'ts'>) => void;
  /**
   * Replace the in-memory conversation and rotate the on-disk session file.
   * The new session begins pre-populated with `messages` (for `resume`) or
   * empty (for `clear`). The previous session file is left untouched.
   * Optional because not every host (e.g. one-shot CLI) supports it.
   */
  replaceHistory?: (messages: Message[]) => Promise<void>;
  /**
   * Export the current visible transcript to a readable file. Unlike the
   * resumable session JSONL, this may include system/tool/error lines.
   */
  exportHistory?: (outputPath?: string) => Promise<{ path: string; count: number }>;
}

export interface Command {
  name: string;
  description: string;
  run: (args: string[], ctx: CommandContext) => Promise<void>;
}
