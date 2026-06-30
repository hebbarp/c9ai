import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { AppConfig, ProviderName } from './types.js';

export const CONFIG_DIR = path.join(os.homedir(), '.c9ai');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
export const LOGS_DIR = path.join(CONFIG_DIR, 'logs');
export const SKILLS_DIR = path.join(CONFIG_DIR, 'skills');
export const ARTIFACTS_DIR = path.join(CONFIG_DIR, 'artifacts');
export const MODELS_DIR = path.join(CONFIG_DIR, 'models');

export const ALIASES_PATH = path.join(CONFIG_DIR, 'aliases.json');
export const TOOLS_REGISTRY_PATH = path.join(CONFIG_DIR, 'tools-registry.json');

const DEFAULT_CONFIG: AppConfig = {
  defaultModel: 'claude',
  // ollamaModel/ollamaUrl intentionally unset — provider falls back to env
  // (OLLAMA_MODEL / OLLAMA_URL) and then its own defaults. Setting them
  // here would clobber the env on every boot.
  lastUpdated: new Date(0).toISOString(),
};

export async function ensureDirs(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });
  await fs.mkdir(SKILLS_DIR, { recursive: true });
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
  await fs.mkdir(MODELS_DIR, { recursive: true });
}

export async function loadConfig(): Promise<AppConfig> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(next: AppConfig): Promise<void> {
  await ensureDirs();
  const toWrite: AppConfig = { ...next, lastUpdated: new Date().toISOString() };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(toWrite, null, 2), 'utf8');
}

export function isProviderName(value: string): value is ProviderName {
  return (
    value === 'claude' ||
    value === 'gemini' ||
    value === 'ollama' ||
    value === 'soul' ||
    value === 'openai' ||
    value === 'gpt' ||
    value === 'kimi' ||
    value === 'deepseek' ||
    value === 'openrouter' ||
    value === 'lab'
  );
}
