import type { ProviderName } from '../core/types.js';
import type { Provider } from './types.js';
import { claudeProvider } from './claude.js';
import { geminiProvider } from './gemini.js';
import { ollamaProvider } from './ollama.js';
import { soulProvider } from './soul.js';
import {
  deepseekProvider,
  gptProvider,
  kimiProvider,
  labProvider,
  openaiProvider,
  openrouterProvider,
} from './openai-compatible.js';

const providers: Record<ProviderName, Provider> = {
  claude: claudeProvider,
  gemini: geminiProvider,
  ollama: ollamaProvider,
  soul: soulProvider,
  openai: openaiProvider,
  gpt: gptProvider,
  kimi: kimiProvider,
  deepseek: deepseekProvider,
  openrouter: openrouterProvider,
  lab: labProvider,
};

export function getProvider(name: ProviderName): Provider {
  return providers[name];
}

export function listProviders(): Provider[] {
  return Object.values(providers);
}
