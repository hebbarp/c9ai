import type { Command, ProviderName } from '../core/types.js';
import { isProviderName } from '../core/config.js';
import {
  configureOllama,
  getOllamaSettings,
  listInstalledOllamaModels,
} from '../providers/ollama.js';
import {
  isOpenAICompatibleProviderName,
  listOpenAICompatibleModels,
  listOpenAICompatibleProviderNames,
} from '../providers/openai-compatible.js';
import { loadModel } from '../models/registry.js';

export const switchCommand: Command = {
  name: 'switch',
  description: 'Change default AI model (claude|gemini|ollama|soul|openai|gpt|kimi|deepseek|openrouter|lab)',
  run: async (args, ctx) => {
    const rawTarget = (args[0] ?? '').toLowerCase();
    const target = rawTarget === 'chaitanya' ? 'soul' : rawTarget;
    if (!target) {
      const ol = getOllamaSettings();
      ctx.emit({
        kind: 'system',
        text:
          `current model: ${ctx.config.defaultModel}\n` +
          `ollama model:  ${ctx.config.ollamaModel ?? ol.model ?? '(auto-detect)'}\n` +
          `ollama url:    ${ctx.config.ollamaUrl ?? ol.url}\n` +
          `usage: switch <claude|gemini|ollama|soul|openai|gpt|kimi|deepseek|openrouter|lab>\n` +
          `       local: ollama · lab: lab (office GPU) · cloud: claude|gemini|openai|gpt|kimi|deepseek|openrouter\n` +
          `       switch ollama <model>\n` +
          `       switch <ollama|${listOpenAICompatibleProviderNames().join('|')}> list`,
      });
      return;
    }

    if (target === 'ollama' && (args[1] ?? '').toLowerCase() === 'list') {
      const installed = await listInstalledOllamaModels();
      if (installed.length === 0) {
        ctx.emit({
          kind: 'system',
          text:
            `no ollama models installed at ${getOllamaSettings().url}.\n` +
            `pull one with \`ollama pull <name>\` (e.g. llama3.2, qwen2.5-coder).`,
        });
      } else {
        ctx.emit({
          kind: 'system',
          text:
            `installed ollama models (${installed.length}):\n` +
            installed.map(m => `  ${m}`).join('\n'),
        });
      }
      return;
    }

    if (isOpenAICompatibleProviderName(target) && (args[1] ?? '').toLowerCase() === 'list') {
      const result = await listOpenAICompatibleModels(target);
      if (!result.ok) {
        ctx.emit({ kind: 'error', text: `${target}: ${result.error}` });
        return;
      }
      if (result.models.length === 0) {
        ctx.emit({ kind: 'system', text: `${target}: no models returned` });
        return;
      }
      ctx.emit({
        kind: 'system',
        text:
          `${target} models (${result.models.length}):\n` +
          result.models.map(m => `  ${m}`).join('\n'),
      });
      return;
    }

    if (!isProviderName(target)) {
      const model = await loadModel(target);
      if (model) {
        configureOllama({ model: model.spec.ollamaModel });
        await ctx.saveConfig({ defaultModel: 'ollama', ollamaModel: model.spec.ollamaModel });
        ctx.emit({ kind: 'system', text: `switched to ${model.spec.name} (${model.spec.ollamaModel})` });
        return;
      }
      ctx.emit({ kind: 'error', text: `unknown model: ${target}` });
      return;
    }

    const next: { defaultModel: ProviderName; ollamaModel?: string } = {
      defaultModel: target,
    };

    if (target === 'ollama' && args[1]) {
      next.ollamaModel = args[1];
      configureOllama({ model: args[1] });
    }

    await ctx.saveConfig(next);
    const suffix =
      target === 'ollama'
        ? ` (${getOllamaSettings().model ?? 'auto-detect on first use'})`
        : '';
    ctx.emit({ kind: 'system', text: `switched default model to ${target}${suffix}` });
  },
};
