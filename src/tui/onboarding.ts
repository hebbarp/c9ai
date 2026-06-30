/**
 * First-run setup wizard — static pieces.
 *
 * The stateful walk lives in App.tsx (mirroring the models-review flow): it
 * intercepts prompt input before it reaches history/routing so pasted API
 * keys never land in prompt history, the session file, or the event log.
 * This module holds the pure bits: the provider table, key masking, and the
 * prompt strings the wizard prints at each step.
 */

export type OnboardStep = 'matsya' | 'claude' | 'more' | 'more-key';

export interface OnboardState {
  step: OnboardStep;
  /** Provider key (into ONBOARD_KEY_PROVIDERS) awaiting its secret on 'more-key'. */
  pendingProvider?: string;
  /** Human labels of what got configured, for the closing summary. */
  configured: string[];
}

/**
 * Hosted providers the wizard can take a key for. Gemini (CLI) and Ollama
 * (local) need no key, so they're handled inline in App with a pointer to
 * `switch`, not listed here.
 */
export const ONBOARD_KEY_PROVIDERS: Record<
  string,
  { envKey: string; label: string; hint: string }
> = {
  openai: { envKey: 'OPENAI_API_KEY', label: 'OpenAI', hint: 'sk-…' },
  kimi: { envKey: 'KIMI_API_KEY', label: 'Kimi', hint: '' },
  deepseek: { envKey: 'DEEPSEEK_API_KEY', label: 'DeepSeek', hint: '' },
  openrouter: { envKey: 'OPENROUTER_API_KEY', label: 'OpenRouter', hint: 'sk-or-…' },
};

export function maskKey(value: string): string {
  if (value.length <= 10) return '***';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/**
 * Build the "paste your key" line for one credential. If a value is already
 * present in the environment we show it masked and frame Enter as "keep" so a
 * returning user isn't told to re-enter a key they already have.
 */
export function keyPrompt(label: string, hint: string, existing?: string): string {
  if (existing) {
    return `${label}: already set (${maskKey(existing)}). Press Enter to keep, or paste a new key to replace.`;
  }
  const h = hint ? ` (${hint})` : '';
  return `${label} API key${h} — paste it, or press Enter to skip.`;
}

export function morePrompt(): string {
  return 'Set up another model provider? Type one of: openai · kimi · deepseek · openrouter · gemini · ollama — or press Enter to finish.';
}
