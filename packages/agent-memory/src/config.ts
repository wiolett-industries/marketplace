import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getGlobalMemoryRoot } from './scope.js';

type AgentMemoryConfig = {
  openaiApiKey?: string;
};

function ensureConfigDir(): void {
  mkdirSync(getGlobalMemoryRoot(), { recursive: true });
}

function normalizeApiKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getAgentMemoryConfigPath(): string {
  return path.join(getGlobalMemoryRoot(), 'config.json');
}

export function readAgentMemoryConfig(): AgentMemoryConfig {
  const configPath = getAgentMemoryConfigPath();
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as AgentMemoryConfig;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeAgentMemoryConfig(config: AgentMemoryConfig): void {
  ensureConfigDir();
  const configPath = getAgentMemoryConfigPath();
  const tempPath = `${configPath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  chmodSync(tempPath, 0o600);
  renameSync(tempPath, configPath);
  chmodSync(configPath, 0o600);
}

export function getStoredOpenAIApiKey(): string | null {
  return normalizeApiKey(readAgentMemoryConfig().openaiApiKey);
}

export function setStoredOpenAIApiKey(apiKey: string): string {
  const normalized = normalizeApiKey(apiKey);
  if (!normalized) {
    throw new Error('OpenAI API key cannot be empty.');
  }

  writeAgentMemoryConfig({ ...readAgentMemoryConfig(), openaiApiKey: normalized });
  return getAgentMemoryConfigPath();
}

export function resolveOpenAIApiKey(): { apiKey: string | null; source: 'env' | 'stored' | 'none' } {
  const envKey = normalizeApiKey(process.env.OPENAI_API_KEY);
  if (envKey) {
    return { apiKey: envKey, source: 'env' };
  }

  const storedKey = getStoredOpenAIApiKey();
  if (storedKey) {
    return { apiKey: storedKey, source: 'stored' };
  }

  return { apiKey: null, source: 'none' };
}

export function persistOpenAIKeyFromEnvironment(): { persisted: boolean; configPath: string | null } {
  const envKey = normalizeApiKey(process.env.OPENAI_API_KEY);
  if (!envKey) {
    return { persisted: false, configPath: null };
  }

  if (envKey === getStoredOpenAIApiKey()) {
    return { persisted: false, configPath: getAgentMemoryConfigPath() };
  }

  return {
    persisted: true,
    configPath: setStoredOpenAIApiKey(envKey),
  };
}
