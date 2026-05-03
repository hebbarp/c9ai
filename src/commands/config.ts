import type { Command } from '../core/types.js';
import { CONFIG_PATH } from '../core/config.js';
import { setUserEnvVar, USER_ENV_PATH } from '../core/envFile.js';
import { isOpenAICompatibleProviderName } from '../providers/openai-compatible.js';

type HostedProvider = 'openai' | 'gpt' | 'kimi' | 'deepseek' | 'openrouter';

const PROVIDER_ENV: Record<HostedProvider, { key: string; model: string; baseUrl: string }> = {
  openai: {
    key: 'OPENAI_API_KEY',
    model: 'OPENAI_MODEL',
    baseUrl: 'OPENAI_BASE_URL',
  },
  gpt: {
    key: 'OPENAI_API_KEY',
    model: 'OPENAI_MODEL',
    baseUrl: 'OPENAI_BASE_URL',
  },
  kimi: {
    key: 'KIMI_API_KEY',
    model: 'KIMI_MODEL',
    baseUrl: 'KIMI_BASE_URL',
  },
  deepseek: {
    key: 'DEEPSEEK_API_KEY',
    model: 'DEEPSEEK_MODEL',
    baseUrl: 'DEEPSEEK_BASE_URL',
  },
  openrouter: {
    key: 'OPENROUTER_API_KEY',
    model: 'OPENROUTER_MODEL',
    baseUrl: 'OPENROUTER_BASE_URL',
  },
};

function maskSecret(value: string): string {
  if (value.length <= 10) return '***';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

const USAGE = [
  'usage:',
  '  config                         show current config',
  '  config openai <api-key>        save OPENAI_API_KEY',
  '  config kimi <api-key>          save KIMI_API_KEY',
  '  config deepseek <api-key>      save DEEPSEEK_API_KEY',
  '  config openrouter <api-key>    save OPENROUTER_API_KEY',
  '  config <host> model <model>    save model env var',
  '  config <host> base <url>       save base URL env var',
].join('\n');

export const configCommand: Command = {
  name: 'config',
  description: 'Show config or save provider credentials',
  run: async (args, ctx) => {
    const provider = (args[0] ?? '').toLowerCase();
    if (provider === 'help' || provider === '-h' || provider === '--help') {
      ctx.emit({ kind: 'system', text: USAGE });
      return;
    }

    if (isOpenAICompatibleProviderName(provider)) {
      const hosted = provider === 'gpt' ? 'openai' : provider;
      const env = PROVIDER_ENV[provider];
      const action = (args[1] ?? '').toLowerCase();
      if (!action) {
        ctx.emit({ kind: 'error', text: `usage: config ${provider} <api-key>` });
        return;
      }

      if (action === 'model') {
        const model = args.slice(2).join(' ').trim();
        if (!model) {
          ctx.emit({ kind: 'error', text: `usage: config ${provider} model <model>` });
          return;
        }
        await setUserEnvVar(env.model, model);
        ctx.emit({ kind: 'system', text: `${hosted}: saved ${env.model}=${model} to ${USER_ENV_PATH}` });
        return;
      }

      if (action === 'base' || action === 'baseurl' || action === 'url') {
        const url = args.slice(2).join(' ').trim();
        if (!url) {
          ctx.emit({ kind: 'error', text: `usage: config ${provider} base <url>` });
          return;
        }
        await setUserEnvVar(env.baseUrl, url);
        ctx.emit({ kind: 'system', text: `${hosted}: saved ${env.baseUrl}=${url} to ${USER_ENV_PATH}` });
        return;
      }

      const key = args.slice(1).join(' ').trim();
      await setUserEnvVar(env.key, key);
      ctx.emit({ kind: 'system', text: `${hosted}: saved ${env.key} ${maskSecret(key)} to ${USER_ENV_PATH}` });
      return;
    }

    if (provider) {
      ctx.emit({ kind: 'error', text: `unknown config target: ${provider}\n\n${USAGE}` });
      return;
    }

    const lines = [
      `path: ${CONFIG_PATH}`,
      `env:  ${USER_ENV_PATH}`,
      `defaultModel: ${ctx.config.defaultModel}`,
      `ollamaModel:  ${ctx.config.ollamaModel ?? '(default)'}`,
      `ollamaUrl:    ${ctx.config.ollamaUrl ?? '(default)'}`,
      `openai:       ${process.env.OPENAI_API_KEY ? 'key set' : 'not set'}`,
      `openaiModel:  ${process.env.OPENAI_MODEL ?? '(default)'}`,
      `kimi:         ${process.env.KIMI_API_KEY ? 'key set' : 'not set'}`,
      `kimiModel:    ${process.env.KIMI_MODEL ?? '(default)'}`,
      `deepseek:     ${process.env.DEEPSEEK_API_KEY ? 'key set' : 'not set'}`,
      `dsModel:      ${process.env.DEEPSEEK_MODEL ?? '(default)'}`,
      `openrouter:   ${process.env.OPENROUTER_API_KEY ? 'key set' : 'not set'}`,
      `orModel:      ${process.env.OPENROUTER_MODEL ?? '(default)'}`,
      `lastUpdated:  ${ctx.config.lastUpdated}`,
    ];
    ctx.emit({ kind: 'system', text: lines.join('\n') });
  },
};
