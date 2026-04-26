import type { ProviderName } from '../core/types.js';
import type { Provider } from './types.js';
import { claudeProvider } from './claude.js';
import { geminiProvider } from './gemini.js';
import { ollamaProvider } from './ollama.js';

const providers: Record<ProviderName, Provider> = {
  claude: claudeProvider,
  gemini: geminiProvider,
  ollama: ollamaProvider,
};

export function getProvider(name: ProviderName): Provider {
  return providers[name];
}

export function listProviders(): Provider[] {
  return Object.values(providers);
}
