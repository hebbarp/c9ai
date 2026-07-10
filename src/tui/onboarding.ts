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

/**
 * Shape check for a pasted API key, so a mistyped command (e.g. `switch lab`)
 * never gets silently saved as a credential and quietly breaks the CLI.
 * Empty input is handled upstream as "skip/keep" and never reaches here.
 */
interface KeySpec {
  prefixes: string[];
  minLen: number;
}

const KEY_SPECS: Record<string, KeySpec> = {
  matsya: { prefixes: ['msk_'], minLen: 24 },
  claude: { prefixes: ['sk-ant-'], minLen: 40 },
  openai: { prefixes: ['sk-'], minLen: 20 },
  gpt: { prefixes: ['sk-'], minLen: 20 },
  kimi: { prefixes: ['sk-'], minLen: 20 },
  deepseek: { prefixes: ['sk-'], minLen: 20 },
  openrouter: { prefixes: ['sk-or-', 'sk-'], minLen: 20 },
};

// c9ai verbs a user might fat-finger into a key prompt instead of a real key.
const COMMAND_WORDS =
  /^(switch|help|agent|config|setup|welcome|onboard|onboarding|exit|quit|cancel|clear|resume|save|models|pampa|tools|todos|research|analytics|matsya|tunnels|skill|lab|ollama|claude|gemini|soul|openai|gpt|kimi|deepseek|openrouter)\b/i;

export function validateKey(kind: string, value: string): { ok: true } | { ok: false; reason: string } {
  const v = value.trim();
  if (/\s/.test(v)) {
    return { ok: false, reason: "it has spaces in it — API keys don't. That looks like a command, not a key." };
  }
  if (v.startsWith('/')) {
    return { ok: false, reason: 'it starts with "/" — that looks like a path or command, not an API key.' };
  }
  if (COMMAND_WORDS.test(v)) {
    return { ok: false, reason: 'that looks like a c9ai command, not an API key.' };
  }
  const spec = KEY_SPECS[kind];
  if (spec) {
    if (v.length < spec.minLen) {
      return { ok: false, reason: `it's too short for a ${kind} key (expected ${spec.prefixes[0]}… and ${spec.minLen}+ characters).` };
    }
    if (spec.prefixes.length > 0 && !spec.prefixes.some(p => v.startsWith(p))) {
      return { ok: false, reason: `a ${kind} key should start with ${spec.prefixes.map(p => `"${p}"`).join(' or ')}.` };
    }
  } else if (v.length < 12) {
    return { ok: false, reason: 'that looks too short to be an API key.' };
  }
  return { ok: true };
}
