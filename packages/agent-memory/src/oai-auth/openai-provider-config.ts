import { existsSync, readFileSync } from 'node:fs';
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_OPENAI_ENDPOINT,
  DEFAULT_RESPONSE_MODEL,
  getConfigPaths,
  readAiProvidersConfig,
  readMcpConfig,
  type ModelRole,
  type TextApi,
} from '../config.js';
import type { JsonObject } from './types.js';
import { isJsonObject, readString } from './utils.js';

export { DEFAULT_EMBEDDING_MODEL, DEFAULT_RESPONSE_MODEL } from '../config.js';

export type OpenAIProviderConfigSource = 'explicit' | 'environment' | 'wiolett-config';

export type OpenAIProviderConfig = {
  apiKey: string;
  source: OpenAIProviderConfigSource;
  configPath?: string;
  providerId: string;
  baseUrl: string;
  model?: string;
  embeddingModel?: string;
  headers?: Record<string, string>;
  textApi: TextApi;
  apiPath: string;
  store: boolean;
  timeoutMs: number;
};

export type OpenAIProviderConfigOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  responseModel?: string;
  embeddingModel?: string;
  configPath?: string;
  providersConfigPath?: string;
  mcpConfigPath?: string;
  providerId?: string;
  role?: ModelRole;
  textApi?: TextApi;
  userAgent?: string;
};

export type EmbeddingProviderConfig = {
  provider: 'openai-compatible';
  providerId: string;
  baseUrl: string;
  apiPath: string;
  model: string;
  apiKey: string;
  headers?: Record<string, string>;
  timeoutMs: number;
};

export function getDefaultWiolettAuthConfigPath(): string {
  return getConfigPaths().legacyAuth;
}

export function resolveOpenAIProviderConfig(options: OpenAIProviderConfigOptions = {}): OpenAIProviderConfig | null {
  const role = options.role ?? 'synthesis';
  const paths = getConfigPaths();
  const providersPath = options.providersConfigPath ?? paths.aiProviders;
  const mcpPath = options.mcpConfigPath ?? paths.mcpConfig;
  const legacyOnly = Boolean(options.configPath && !options.providersConfigPath && !options.mcpConfigPath);
  const providers = legacyOnly ? null : readAiProvidersConfig(providersPath);
  const mcp = legacyOnly ? null : readMcpConfig(mcpPath);
  const route = mcp?.mcp['agent-memory']?.routing?.[role];
  const hasExplicitProviderOptions = Boolean(options.apiKey || options.baseUrl || options.model || options.responseModel || options.embeddingModel);
  if (route === null && !hasExplicitProviderOptions) return null;

  const providerId = options.providerId ?? route?.provider ?? 'openai';
  const provider = providers?.providers[providerId];
  if (provider && provider.driver !== 'openai' && provider.driver !== 'openai-compatible') return null;
  if (providers && !provider && !hasExplicitProviderOptions) return null;

  const legacyPath = options.configPath ?? paths.legacyAuth;
  const legacyFallback = legacyOnly || !providers;
  const legacy = legacyFallback ? readLegacyAuthConfig(legacyPath) : null;
  const explicitKey = normalizeSecret(options.apiKey);
  const providerKey = normalizeSecret(provider?.auth?.api_key);
  const environmentKey = legacyFallback && providerId === 'openai'
    ? normalizeSecret(process.env.OPENAI_API_KEY)
    : null;
  const legacyKey = legacyFallback && providerId === 'openai' ? resolveLegacyApiKey(legacy) : null;
  const apiKey = explicitKey ?? providerKey ?? environmentKey ?? legacyKey;
  if (!apiKey) return null;

  const routeTextApi = route?.api === 'responses' || route?.api === 'chat_completions' ? route.api : undefined;
  const textApi: TextApi = role === 'embeddings'
    ? 'responses'
    : options.textApi ?? routeTextApi ?? provider?.defaults?.text_api ?? 'responses';
  const model = options.model
    ?? options.responseModel
    ?? (role !== 'embeddings' ? route?.model : undefined)
    ?? provider?.defaults?.models?.text
    ?? readString(legacy?.responseModel);
  const embeddingModel = options.embeddingModel
    ?? (role === 'embeddings' ? route?.model : undefined)
    ?? provider?.defaults?.models?.embeddings
    ?? readString(legacy?.embeddingModel)
    ?? readString(legacy?.embeddingsModel);
  const configPath = providerKey ? providersPath : legacyKey ? legacyPath : undefined;
  const headers = provider?.headers ?? resolveLegacyHeaders(legacy);
  const apiPath = role === 'embeddings'
    ? provider?.apis.embeddings?.path ?? '/embeddings'
    : textApi === 'chat_completions'
      ? provider?.apis.chat_completions?.path ?? '/chat/completions'
      : provider?.apis.responses?.path ?? '/responses';

  return {
    apiKey,
    source: explicitKey ? 'explicit' : environmentKey ? 'environment' : 'wiolett-config',
    ...(configPath ? { configPath } : {}),
    providerId,
    baseUrl: options.baseUrl ?? provider?.base_url ?? resolveLegacyBaseUrl(legacy),
    ...(model ? { model } : {}),
    ...(embeddingModel ? { embeddingModel } : {}),
    ...(headers ? { headers } : {}),
    textApi,
    apiPath,
    store: provider?.apis.responses?.store ?? false,
    timeoutMs: provider?.timeout_ms ?? 30_000,
  };
}

export function hasOpenAIProviderConfig(options: OpenAIProviderConfigOptions = {}): boolean {
  return Boolean(resolveOpenAIProviderConfig(options));
}

export function resolveEmbeddingProviderConfig(options: OpenAIProviderConfigOptions = {}): EmbeddingProviderConfig | null {
  const openAI = resolveOpenAIProviderConfig({ ...options, role: 'embeddings' });
  if (!openAI) return null;
  return {
    provider: 'openai-compatible',
    providerId: openAI.providerId,
    apiKey: openAI.apiKey,
    baseUrl: openAI.baseUrl,
    apiPath: openAI.apiPath,
    model: openAI.embeddingModel ?? DEFAULT_EMBEDDING_MODEL,
    ...(openAI.headers ? { headers: openAI.headers } : {}),
    timeoutMs: openAI.timeoutMs,
  };
}

export function hasEmbeddingProviderConfig(options: OpenAIProviderConfigOptions = {}): boolean {
  return Boolean(resolveEmbeddingProviderConfig(options));
}

function readLegacyAuthConfig(configPath: string): JsonObject | null {
  if (!existsSync(configPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as unknown;
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function resolveLegacyApiKey(config: JsonObject | null): string | null {
  if (!config) return null;
  return normalizeSecret(config.openAIKey)
    ?? normalizeSecret(config.openaiApiKey)
    ?? normalizeSecret(config.openai_api_key)
    ?? normalizeSecret(config.apiKey)
    ?? normalizeSecret(config.api_key);
}

function resolveLegacyBaseUrl(config: JsonObject | null): string {
  return readString(config?.endpoint)
    ?? readString(config?.baseUrl)
    ?? readString(config?.baseURL)
    ?? readString(config?.openAIBaseUrl)
    ?? readString(config?.openaiBaseUrl)
    ?? DEFAULT_OPENAI_ENDPOINT;
}

function resolveLegacyHeaders(config: JsonObject | null): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  if (config && isJsonObject(config.headers)) {
    for (const [key, value] of Object.entries(config.headers)) {
      const headerValue = readString(value);
      if (headerValue) headers[key] = headerValue;
    }
  }
  const organization = readString(config?.organization) ?? readString(config?.openAIOrganization);
  const project = readString(config?.project) ?? readString(config?.openAIProject);
  if (organization) headers['OpenAI-Organization'] = organization;
  if (project) headers['OpenAI-Project'] = project;
  return Object.keys(headers).length ? headers : undefined;
}

function normalizeSecret(value: unknown): string | null {
  const trimmed = readString(value);
  return trimmed || null;
}
