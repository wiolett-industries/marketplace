import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { JsonObject } from './types.js';
import { isJsonObject, readString } from './utils.js';

export type OpenAIProviderConfigSource = 'explicit' | 'environment' | 'wiolett-config';

export type OpenAIProviderConfig = {
  apiKey: string;
  source: OpenAIProviderConfigSource;
  configPath?: string;
  baseUrl: string;
  model?: string;
  embeddingModel?: string;
  headers?: Record<string, string>;
};

export type OpenAIProviderConfigOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
  configPath?: string;
  userAgent?: string;
};

export type EmbeddingProviderConfig = {
  provider: 'openai-compatible';
  baseUrl: string;
  model: string;
  apiKey: string;
  headers?: Record<string, string>;
};

export function getDefaultWiolettAuthConfigPath(): string {
  return path.join(os.homedir(), '.agents', '.wiolett', 'auth-config.json');
}

export function resolveOpenAIProviderConfig(options: OpenAIProviderConfigOptions = {}): OpenAIProviderConfig | null {
  const configPath = options.configPath ?? process.env.WIOLETT_AUTH_CONFIG_PATH?.trim() ?? getDefaultWiolettAuthConfigPath();
  const fileConfig = readAuthConfigFile(configPath);
  const explicitKey = normalizeSecret(options.apiKey);
  const environmentKey = normalizeSecret(process.env.OPENAI_API_KEY);
  const configKey = resolveConfigApiKey(fileConfig);
  const apiKey = explicitKey ?? environmentKey ?? configKey;
  if (!apiKey) return null;

  const model = options.model;
  const embeddingModel = options.embeddingModel ?? readString(fileConfig?.embeddingModel) ?? readString(fileConfig?.embeddingsModel);
  const headers = resolveHeaders(fileConfig);

  return {
    apiKey,
    source: explicitKey ? 'explicit' : environmentKey ? 'environment' : 'wiolett-config',
    ...(configKey && !explicitKey ? { configPath } : {}),
    baseUrl: resolveBaseUrl(options, fileConfig),
    ...(model ? { model } : {}),
    ...(embeddingModel ? { embeddingModel } : {}),
    ...(headers ? { headers } : {}),
  };
}

export function hasOpenAIProviderConfig(options: OpenAIProviderConfigOptions = {}): boolean {
  return Boolean(resolveOpenAIProviderConfig(options));
}

export function resolveEmbeddingProviderConfig(options: OpenAIProviderConfigOptions = {}): EmbeddingProviderConfig | null {
  const openAI = resolveOpenAIProviderConfig(options);
  if (!openAI) return null;
  return {
    provider: 'openai-compatible',
    apiKey: openAI.apiKey,
    baseUrl: openAI.baseUrl,
    model: openAI.embeddingModel ?? 'text-embedding-3-small',
    ...(openAI.headers ? { headers: openAI.headers } : {}),
  };
}

export function hasEmbeddingProviderConfig(options: OpenAIProviderConfigOptions = {}): boolean {
  return Boolean(resolveEmbeddingProviderConfig(options));
}

function readAuthConfigFile(configPath: string): JsonObject | null {
  if (!existsSync(configPath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as unknown;
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function resolveConfigApiKey(config: JsonObject | null): string | null {
  if (!config) return null;
  return (
    normalizeSecret(config.openAIKey) ??
    normalizeSecret(config.openaiApiKey) ??
    normalizeSecret(config.openai_api_key) ??
    normalizeSecret(config.apiKey) ??
    normalizeSecret(config.api_key)
  );
}

function resolveBaseUrl(options: OpenAIProviderConfigOptions, config: JsonObject | null): string {
  return (
    options.baseUrl ??
    readString(config?.endpoint) ??
    readString(config?.baseUrl) ??
    readString(config?.baseURL) ??
    readString(config?.openAIBaseUrl) ??
    readString(config?.openaiBaseUrl) ??
    'https://api.openai.com/v1'
  );
}

function resolveHeaders(config: JsonObject | null): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  if (config && isJsonObject(config.headers)) {
    for (const [key, value] of Object.entries(config.headers)) {
      const headerValue = readString(value);
      if (headerValue) headers[key] = headerValue;
    }
  }

  const organization = readString(config?.organization) ?? readString(config?.openAIOrganization);
  if (organization) headers['OpenAI-Organization'] = organization;

  const project = readString(config?.project) ?? readString(config?.openAIProject);
  if (project) headers['OpenAI-Project'] = project;

  return Object.keys(headers).length ? headers : undefined;
}

function normalizeSecret(value: unknown): string | null {
  const trimmed = readString(value);
  if (!trimmed) return null;
  if (/^\$\{[A-Z0-9_]+\}$/u.test(trimmed)) return null;
  return trimmed;
}
