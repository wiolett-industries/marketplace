import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseDocument, stringify } from 'yaml';
import * as z from 'zod/v4';

export const DEFAULT_RESPONSE_MODEL = 'gpt-5-mini';
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
export const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1';

const headersSchema = z.record(z.string(), z.string());
const apiPathSchema = z.object({ path: z.string().min(1) }).strict();
const responsesApiSchema = z.object({
  path: z.string().min(1),
  store: z.boolean().optional(),
}).strict();
const providerSchema = z.object({
  driver: z.enum(['openai', 'openai-compatible']),
  base_url: z.string().url(),
  auth: z.object({ api_key: z.string().optional() }).strict().optional(),
  headers: headersSchema.optional(),
  apis: z.object({
    responses: responsesApiSchema.optional(),
    chat_completions: apiPathSchema.optional(),
    embeddings: apiPathSchema.optional(),
  }).strict(),
  defaults: z.object({
    text_api: z.enum(['responses', 'chat_completions']).optional(),
    models: z.object({
      text: z.string().min(1).optional(),
      embeddings: z.string().min(1).optional(),
    }).strict().optional(),
  }).strict().optional(),
  timeout_ms: z.number().int().positive().optional(),
}).strict();

export const aiProvidersConfigSchema = z.object({
  version: z.literal(1),
  providers: z.record(z.string().min(1), providerSchema),
}).strict();

const embeddingRouteSchema = z.object({
  provider: z.string().min(1),
  api: z.literal('embeddings').optional(),
  model: z.string().min(1).optional(),
}).strict();
const textRouteSchema = z.object({
  provider: z.string().min(1),
  api: z.enum(['responses', 'chat_completions']).optional(),
  model: z.string().min(1).optional(),
}).strict();

export const mcpConfigSchema = z.object({
  version: z.literal(1),
  mcp: z.object({
    'agent-memory': z.object({
      routing: z.object({
        embeddings: embeddingRouteSchema.nullable().optional(),
        gate: textRouteSchema.nullable().optional(),
        synthesis: textRouteSchema.nullable().optional(),
      }).strict().optional(),
      runtime: z.object({ home: z.string().min(1).optional() }).strict().optional(),
      storage: z.object({
        memory: z.object({
          global: z.string().min(1).optional(),
          project: z.string().min(1).optional(),
        }).strict(),
      }).strict().optional(),
    }).strict().optional(),
    workflow: z.object({
      artifacts: z.object({
        root: z.string().min(1).optional(),
        plans: z.string().min(1).optional(),
        audits: z.string().min(1).optional(),
      }).strict().optional(),
    }).strict().optional(),
    'merge-request-review': z.object({
      artifacts: z.object({ root: z.string().min(1).optional() }).strict().optional(),
    }).strict().optional(),
  }).strict(),
}).strict();

export type AiProvidersConfig = z.infer<typeof aiProvidersConfigSchema>;
export type McpConfig = z.infer<typeof mcpConfigSchema>;
export type ProviderDefinition = AiProvidersConfig['providers'][string];
export type ModelRole = 'embeddings' | 'gate' | 'synthesis';
export type TextApi = 'responses' | 'chat_completions';

export interface ConfigPaths {
  agentsHome: string;
  configDir: string;
  aiProviders: string;
  mcpConfig: string;
  legacyAuth: string;
  migrationRoot: string;
}

export function getBootstrapAgentsHome(env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(expandHome(
    env.PROJECT_MEMORY_AGENTS_HOME?.trim()
      || env.AGENTS_HOME?.trim()
      || path.join(os.homedir(), '.agents'),
  ));
}

export function getConfigPaths(env: NodeJS.ProcessEnv = process.env): ConfigPaths {
  const agentsHome = getBootstrapAgentsHome(env);
  const configDir = path.resolve(expandHome(env.WIOLETT_CONFIG_DIR?.trim() || path.join(agentsHome, '.wiolett', 'config')));
  return {
    agentsHome,
    configDir,
    aiProviders: path.join(configDir, 'ai-providers.yml'),
    mcpConfig: path.join(configDir, 'mcp-config.yml'),
    legacyAuth: path.resolve(expandHome(env.WIOLETT_AUTH_CONFIG_PATH?.trim() || path.join(agentsHome, '.wiolett', 'auth-config.json'))),
    migrationRoot: path.join(agentsHome, '.wiolett', 'migrations'),
  };
}

export function readAiProvidersConfig(configPath = getConfigPaths().aiProviders): AiProvidersConfig | null {
  return readYamlConfig(configPath, aiProvidersConfigSchema);
}

export function readMcpConfig(configPath = getConfigPaths().mcpConfig): McpConfig | null {
  return readYamlConfig(configPath, mcpConfigSchema);
}

export function readYamlConfig<T>(configPath: string, schema: z.ZodType<T>): T | null {
  if (!existsSync(configPath)) return null;
  const source = readFileSync(configPath, 'utf8');
  const document = parseDocument(source, { schema: 'core', uniqueKeys: true });
  if (document.errors.length) {
    throw new Error(`Invalid YAML in ${configPath}: ${document.errors[0]?.message ?? 'parse error'}`);
  }
  const parsed = schema.safeParse(document.toJS());
  if (!parsed.success) {
    throw new Error(`Invalid configuration in ${configPath}: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export function createDefaultAiProvidersConfig(legacy: Record<string, unknown> | null = null): AiProvidersConfig {
  const key = readString(legacy?.openAIKey) ?? readString(legacy?.openaiApiKey) ?? readString(legacy?.apiKey) ?? '';
  const baseUrl = readString(legacy?.endpoint) ?? readString(legacy?.baseUrl) ?? DEFAULT_OPENAI_ENDPOINT;
  const textModel = readString(legacy?.responseModel) ?? DEFAULT_RESPONSE_MODEL;
  const embeddingModel = readString(legacy?.embeddingModel) ?? readString(legacy?.embeddingsModel) ?? DEFAULT_EMBEDDING_MODEL;
  const headers = readLegacyHeaders(legacy);
  return {
    version: 1,
    providers: {
      openai: {
        driver: 'openai',
        base_url: baseUrl,
        auth: { api_key: key },
        ...(headers ? { headers } : {}),
        apis: {
          responses: { path: '/responses', store: false },
          chat_completions: { path: '/chat/completions' },
          embeddings: { path: '/embeddings' },
        },
        defaults: {
          text_api: 'responses',
          models: { text: textModel, embeddings: embeddingModel },
        },
        timeout_ms: 30_000,
      },
    },
  };
}

export function createDefaultMcpConfig(agentsHome = getBootstrapAgentsHome()): McpConfig {
  return {
    version: 1,
    mcp: {
      'agent-memory': {
        routing: {
          embeddings: { provider: 'openai', api: 'embeddings' },
          gate: { provider: 'openai', api: 'responses' },
          synthesis: { provider: 'openai', api: 'responses' },
        },
        runtime: { home: agentsHome },
        storage: { memory: { global: '.wiolett/global-memory', project: '.memory' } },
      },
      workflow: { artifacts: { root: '.workflow', plans: 'plans', audits: 'audits' } },
      'merge-request-review': { artifacts: { root: '.workflow/mr-reviews' } },
    },
  };
}

export function writeGeneratedYaml(configPath: string, value: unknown, kind: 'providers' | 'mcp'): void {
  mkdirSync(path.dirname(configPath), { recursive: true, mode: 0o700 });
  const comments = kind === 'providers'
    ? '# Generated by Agent Memory. This file contains AI provider credentials and transport settings.\n# Agent Memory never overwrites an existing file automatically.\n'
    : '# Generated by Agent Memory. This file configures Wiolett MCP routing, storage, and artifact paths.\n# Workflow and Merge Request Review read this file but never modify it.\n';
  writeFileSync(configPath, `${comments}${stringify(value, { indent: 2, lineWidth: 0 })}`, { mode: 0o600 });
  chmodSync(configPath, 0o600);
}

export function expandHome(value: string): string {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

export function resolveConfiguredPath(value: string, base: string): string {
  const expanded = expandHome(value);
  return path.resolve(path.isAbsolute(expanded) ? expanded : path.join(base, expanded));
}

function readLegacyHeaders(legacy: Record<string, unknown> | null): Record<string, string> | undefined {
  if (!legacy) return undefined;
  const headers: Record<string, string> = {};
  if (legacy.headers && typeof legacy.headers === 'object' && !Array.isArray(legacy.headers)) {
    for (const [key, value] of Object.entries(legacy.headers)) {
      const header = readString(value);
      if (header) headers[key] = header;
    }
  }
  const organization = readString(legacy.organization) ?? readString(legacy.openAIOrganization);
  const project = readString(legacy.project) ?? readString(legacy.openAIProject);
  if (organization) headers['OpenAI-Organization'] = organization;
  if (project) headers['OpenAI-Project'] = project;
  return Object.keys(headers).length ? headers : undefined;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
