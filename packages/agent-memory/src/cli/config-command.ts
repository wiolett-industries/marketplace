import { existsSync } from 'node:fs';
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_OPENAI_ENDPOINT,
  DEFAULT_RESPONSE_MODEL,
  createDefaultMcpConfig,
  getConfigPaths,
  readAiProvidersConfig,
  readMcpConfig,
  updateYamlFile,
  writeGeneratedYaml,
  type AiProvidersConfig,
  type McpConfig,
  type ModelRole,
  type ProviderDefinition,
  type TextApi,
} from '../config.js';
import { ensureConfigAndStorageMigrated } from '../migration.js';
import { resolveEmbeddingProviderConfig, resolveOpenAIProviderConfig } from '../oai-auth/index.js';
import { fetchProviderModels, type CatalogModel } from './model-catalog.js';
import { createConfigCliUi, type ConfigCliUi, type ConfigOption } from './config-ui.js';

type ProviderAction = 'add' | 'edit' | 'remove' | 'back';
type RouteAction = 'set' | 'disable' | 'inherit' | 'back';

export interface ConfigCommandInput {
  env?: NodeJS.ProcessEnv;
  ui?: ConfigCliUi;
  fetch?: typeof globalThis.fetch;
  showIntro?: boolean;
  showOutro?: boolean;
}

export async function runConfigCommand(argv: string[], input: ConfigCommandInput = {}): Promise<void> {
  const env = { ...process.env, ...input.env, ...parseConfigArgs(argv) };
  const paths = getConfigPaths(env);
  const ui = input.ui ?? createConfigCliUi();
  await ensureConfigAndStorageMigrated({ trigger: 'init', env, log: (message) => ui.info(message) });

  if (input.showIntro !== false) ui.intro('Agent Memory Configuration');
  const initialState = readConfigState(paths.aiProviders, paths.mcpConfig);
  ui.note(renderOverview(initialState, paths.aiProviders, paths.mcpConfig), 'Current configuration');
  while (true) {
    const action = await ui.select('What do you want to configure?', menuOptions());
    if (!action || action === 'exit') {
      if (input.showOutro !== false) ui.outro('Configuration complete.');
      return;
    }
    if (action === 'provider') await manageProviders(ui, paths.aiProviders, paths.mcpConfig);
    if (action === 'routing') await manageRouting(ui, paths.aiProviders, paths.mcpConfig, input.fetch);
    if (action === 'storage') await manageStorage(ui, paths.mcpConfig, paths.agentsHome);
    if (action === 'check') checkConfiguration(ui, paths.aiProviders, paths.mcpConfig);
  }
}

function parseConfigArgs(argv: string[]): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--config-dir') {
      const value = argv[index + 1]?.trim();
      if (!value) throw new Error('--config-dir requires a value.');
      env.WIOLETT_CONFIG_DIR = value;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: agent-memory config [--config-dir <path>]');
      process.exit(0);
    } else throw new Error(`Unknown config option: ${arg}`);
  }
  return env;
}

function readConfigState(providersPath: string, mcpPath: string): { providers: AiProvidersConfig; mcp: McpConfig } {
  const providers = readAiProvidersConfig(providersPath);
  const mcp = readMcpConfig(mcpPath);
  if (!providers || !mcp) throw new Error('Agent Memory configuration is missing after bootstrap.');
  return { providers, mcp };
}

function menuOptions(): ConfigOption[] {
  return [
    { value: 'provider', label: 'Manage providers', hint: 'Add, edit, or remove OpenAI-compatible providers' },
    { value: 'routing', label: 'Assign models and routes', hint: 'Configure Gate, Synthesis, and Embeddings independently' },
    { value: 'storage', label: 'Configure storage paths', hint: 'Agent Memory, Workflow, and review artifact locations' },
    { value: 'check', label: 'Validate configuration', hint: 'Resolve every configured role without exposing secrets' },
    { value: 'exit', label: 'Exit' },
  ];
}

async function manageProviders(ui: ConfigCliUi, providersPath: string, mcpPath: string): Promise<void> {
  const state = readConfigState(providersPath, mcpPath);
  const choices: ConfigOption[] = [
    { value: 'add', label: 'Add provider' },
    ...Object.keys(state.providers.providers).sort().map((id) => ({ value: `edit:${id}`, label: `Edit ${id}` })),
    ...Object.keys(state.providers.providers).sort().map((id) => ({ value: `remove:${id}`, label: `Remove ${id}` })),
    { value: 'back', label: 'Back' },
  ];
  const choice = await ui.select('Providers', choices);
  if (!choice || choice === 'back') return;
  const [action, id] = choice.split(':') as [ProviderAction, string | undefined];
  if (action === 'remove' && id) await removeProvider(ui, providersPath, mcpPath, id);
  if ((action === 'add' || action === 'edit') && (action === 'add' || id)) {
    await editProvider(ui, providersPath, action === 'add' ? undefined : id);
  }
}

async function editProvider(ui: ConfigCliUi, providersPath: string, existingId?: string): Promise<void> {
  const providers = readAiProvidersConfig(providersPath);
  if (!providers) throw new Error('Provider configuration is unavailable.');
  const existing = existingId ? providers.providers[existingId] : undefined;
  const id = existingId ?? await ui.text('Provider ID', {
    placeholder: 'gateway',
    validate: (value) => /^[a-z][a-z0-9_-]*$/u.test(value ?? '') ? undefined : 'Use lowercase letters, digits, hyphens, or underscores.',
  });
  if (!id) return;
  if (!existing && providers.providers[id]) {
    ui.info(`Provider "${id}" already exists.`);
    return;
  }
  const driver = await ui.select('Driver', [
    { value: 'openai', label: 'OpenAI' },
    { value: 'openai-compatible', label: 'OpenAI-compatible' },
  ], existing?.driver ?? 'openai-compatible');
  if (!driver) return;
  const baseUrl = await ui.text('Base URL', {
    initialValue: existing?.base_url ?? DEFAULT_OPENAI_ENDPOINT,
    validate: validUrl,
  });
  if (!baseUrl) return;

  let apiKey = existing?.auth?.api_key;
  const changeKey = await ui.confirm(existing ? 'Change the stored API key?' : 'Store an API key now?', false);
  if (changeKey === null) return;
  if (changeKey) {
    const nextKey = await ui.password('API key (leave empty to remove)');
    if (nextKey === null) return;
    apiKey = nextKey || undefined;
  }
  const textApi = await ui.select('Default text API', [
    { value: 'responses', label: 'Responses' },
    { value: 'chat_completions', label: 'Chat Completions' },
  ], existing?.defaults?.text_api ?? 'responses') as TextApi | null;
  if (!textApi) return;
  const textModel = await ui.text('Default text model', { initialValue: existing?.defaults?.models?.text ?? DEFAULT_RESPONSE_MODEL });
  if (textModel === null) return;
  const embeddingModel = await ui.text('Default embedding model', { initialValue: existing?.defaults?.models?.embeddings ?? DEFAULT_EMBEDDING_MODEL });
  if (embeddingModel === null) return;
  const timeout = await ui.text('Timeout in milliseconds', {
    initialValue: String(existing?.timeout_ms ?? 30_000),
    validate: (value) => /^\d+$/u.test(value ?? '') && Number(value) > 0 ? undefined : 'Enter a positive whole number.',
  });
  if (timeout === null) return;

  const provider: ProviderDefinition = {
    driver: driver as ProviderDefinition['driver'],
    base_url: baseUrl,
    ...(apiKey ? { auth: { api_key: apiKey } } : {}),
    apis: existing?.apis ?? {
      responses: { path: '/responses', store: false },
      chat_completions: { path: '/chat/completions' },
      embeddings: { path: '/embeddings' },
    },
    defaults: {
      text_api: textApi,
      models: {
        ...(textModel ? { text: textModel } : {}),
        ...(embeddingModel ? { embeddings: embeddingModel } : {}),
      },
    },
    timeout_ms: Number(timeout),
    ...(existing?.headers ? { headers: existing.headers } : {}),
  };
  if (!(await confirmSave(ui, `Save provider "${id}" (${provider.driver}, ${provider.base_url})?`))) return;
  updateYamlFile(providersPath, [{ type: 'set', path: ['providers', id], value: provider }]);
  ui.info(`Saved provider "${id}". API keys and custom headers remain redacted.`);
}

async function removeProvider(ui: ConfigCliUi, providersPath: string, mcpPath: string, id: string): Promise<void> {
  const { mcp } = readConfigState(providersPath, mcpPath);
  const routes = mcp.mcp['agent-memory']?.routing ?? {};
  const usedBy = (Object.entries(routes) as Array<[ModelRole, unknown]>).flatMap(([role, route]) =>
    route && typeof route === 'object' && 'provider' in route && route.provider === id ? [role] : []
  );
  const implicitDefaultRoles = id === 'openai'
    ? (['gate', 'synthesis', 'embeddings'] as ModelRole[]).filter((role) => routes[role] === undefined)
    : [];
  if (usedBy.length) {
    ui.info(`Provider "${id}" is used by ${usedBy.join(', ')}. Reassign or disable those roles before removing it.`);
    return;
  }
  if (implicitDefaultRoles.length) {
    ui.info(`Provider "${id}" is the default route for ${implicitDefaultRoles.join(', ')}. Assign or disable those roles before removing it.`);
    return;
  }
  if (!(await confirmSave(ui, `Remove provider "${id}"? This cannot be undone by the CLI.`))) return;
  updateYamlFile(providersPath, [{ type: 'delete', path: ['providers', id] }]);
  ui.info(`Removed provider "${id}".`);
}

async function manageRouting(
  ui: ConfigCliUi,
  providersPath: string,
  mcpPath: string,
  fetcher?: typeof globalThis.fetch,
): Promise<void> {
  const { providers, mcp } = readConfigState(providersPath, mcpPath);
  const role = await ui.select('Select a role', [
    { value: 'gate', label: 'Gate', hint: routeLabel(mcp, 'gate') },
    { value: 'synthesis', label: 'Synthesis', hint: routeLabel(mcp, 'synthesis') },
    { value: 'embeddings', label: 'Embeddings', hint: routeLabel(mcp, 'embeddings') },
    { value: 'back', label: 'Back' },
  ]) as ModelRole | 'back' | null;
  if (!role || role === 'back') return;
  const action = await ui.select(`Configure ${role}`, [
    { value: 'set', label: 'Assign provider and model' },
    { value: 'disable', label: 'Disable this role' },
    { value: 'inherit', label: 'Use default OpenAI route', hint: 'Remove this explicit routing entry' },
    { value: 'back', label: 'Back' },
  ]) as RouteAction | null;
  if (!action || action === 'back') return;
  const routePath = ['mcp', 'agent-memory', 'routing', role];
  if (action === 'disable') {
    if (await confirmSave(ui, `Disable ${role}?`)) updateYamlFile(mcpPath, [{ type: 'set', path: routePath, value: null }]);
    return;
  }
  if (action === 'inherit') {
    if (await confirmSave(ui, `Remove explicit ${role} routing?`)) updateYamlFile(mcpPath, [{ type: 'delete', path: routePath }]);
    return;
  }
  const providerId = await ui.select('Provider', Object.keys(providers.providers).sort().map((id) => ({ value: id, label: id })));
  if (!providerId) return;
  const provider = providers.providers[providerId];
  const route = role === 'embeddings'
    ? await embeddingRoute(ui, providerId, provider)
    : await textRoute(ui, providerId, provider, fetcher);
  if (!route) return;
  if (await confirmSave(ui, `Assign ${role} to ${providerId}${route.model ? ` / ${route.model}` : ''}?`)) {
    updateYamlFile(mcpPath, [{ type: 'set', path: routePath, value: route }]);
  }
}

async function textRoute(
  ui: ConfigCliUi,
  provider: string,
  definition: ProviderDefinition,
  fetcher?: typeof globalThis.fetch,
) {
  const api = await ui.select('Text API', [
    { value: 'responses', label: 'Responses' },
    { value: 'chat_completions', label: 'Chat Completions' },
  ], definition.defaults?.text_api ?? 'responses') as TextApi | null;
  if (!api) return null;
  const models = await loadModels(ui, definition, fetcher);
  if (!models) return null;
  const modelId = await ui.select('Model', models.map((model) => ({
    value: model.id,
    label: model.id,
    ...(model.reasoningEfforts.length ? { hint: `Reasoning: ${model.reasoningEfforts.join(', ')}` } : {}),
  })), definition.defaults?.models?.text);
  if (!modelId) return null;
  const model = models.find((candidate) => candidate.id === modelId);
  if (!model) return null;
  const reasoningEffort = await selectReasoningEffort(ui, model);
  if (reasoningEffort === null) return null;
  return { provider, api, model: model.id, ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}) };
}

async function embeddingRoute(ui: ConfigCliUi, provider: string, definition: ProviderDefinition) {
  const model = await ui.text('Embedding model', { initialValue: definition.defaults?.models?.embeddings ?? DEFAULT_EMBEDDING_MODEL });
  return model === null ? null : { provider, api: 'embeddings' as const, ...(model ? { model } : {}) };
}

async function manageStorage(ui: ConfigCliUi, mcpPath: string, agentsHome: string): Promise<void> {
  const mcp = readMcpConfig(mcpPath) ?? createDefaultMcpConfig(agentsHome);
  const memory = mcp.mcp['agent-memory']?.storage?.memory;
  const paths: Array<[string, string[], string]> = [
    ['Global memory', ['mcp', 'agent-memory', 'storage', 'memory', 'global'], memory?.global ?? '.wiolett/global-memory'],
    ['Project memory', ['mcp', 'agent-memory', 'storage', 'memory', 'project'], memory?.project ?? '.memory'],
    ['Workflow artifacts', ['mcp', 'workflow', 'artifacts', 'root'], mcp.mcp.workflow?.artifacts?.root ?? '.workflow'],
    ['MR review artifacts', ['mcp', 'merge-request-review', 'artifacts', 'root'], mcp.mcp['merge-request-review']?.artifacts?.root ?? '.workflow/mr-reviews'],
  ];
  const selected = await ui.select('Storage location', [...paths.map(([label, _path, value], index) => ({ value: String(index), label, hint: value })), { value: 'back', label: 'Back' }]);
  if (!selected || selected === 'back') return;
  const [label, targetPath, current] = paths[Number(selected)];
  const value = await ui.text(label, { initialValue: current, validate: (input) => input?.trim() ? undefined : 'Path is required.' });
  if (!value || !(await confirmSave(ui, `Set ${label} to ${value}?`))) return;
  if (!existsSync(mcpPath)) writeGeneratedYaml(mcpPath, createDefaultMcpConfig(agentsHome), 'mcp');
  updateYamlFile(mcpPath, [{ type: 'set', path: targetPath, value }]);
}

function checkConfiguration(ui: ConfigCliUi, providersPath: string, mcpPath: string): void {
  const spinner = ui.spinner('Resolving configured roles...');
  try {
    const { mcp } = readConfigState(providersPath, mcpPath);
    const routes = mcp.mcp['agent-memory']?.routing ?? {};
    const lines = (['gate', 'synthesis', 'embeddings'] as ModelRole[]).map((role) => {
      if (routes[role] === null) return `${role}: disabled`;
      const resolved = role === 'embeddings'
        ? resolveEmbeddingProviderConfig({ providersConfigPath: providersPath, mcpConfigPath: mcpPath, role })
        : resolveOpenAIProviderConfig({ providersConfigPath: providersPath, mcpConfigPath: mcpPath, role });
      return resolved ? `${role}: ${resolved.providerId} / ${role === 'embeddings' ? resolved.model : resolved.model ?? DEFAULT_RESPONSE_MODEL}` : `${role}: unresolved`;
    });
    spinner.stop(lines.some((line) => line.endsWith('unresolved')) ? 'Configuration needs attention' : 'Configuration is valid');
    ui.note(lines.join('\n'), 'Role resolution');
  } catch (error) {
    spinner.error('Configuration could not be validated');
    ui.info(error instanceof Error ? error.message : String(error));
  }
}

function renderOverview(state: { providers: AiProvidersConfig; mcp: McpConfig }, providersPath: string, mcpPath: string): string {
  const providerLines = Object.entries(state.providers.providers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, provider]) => `${id}: ${provider.driver} · ${provider.base_url} · ${provider.auth?.api_key ? 'credential configured' : 'no credential'}`);
  return [
    `Providers\n${providerLines.join('\n') || 'None'}`,
    `Routes\n${(['gate', 'synthesis', 'embeddings'] as ModelRole[]).map((role) => `${role}: ${routeLabel(state.mcp, role)}`).join('\n')}`,
    `Files\nproviders: ${providersPath}\nmcp: ${mcpPath}`,
  ].join('\n\n');
}

function routeLabel(mcp: McpConfig, role: ModelRole): string {
  const route = mcp.mcp['agent-memory']?.routing?.[role];
  if (route === null) return 'disabled';
  if (!route) return 'default openai route';
  const reasoningEffort = 'reasoning_effort' in route ? route.reasoning_effort : undefined;
  return `${route.provider}${route.model ? ` / ${route.model}` : ''}${reasoningEffort ? ` · reasoning ${reasoningEffort}` : ''}`;
}

async function loadModels(
  ui: ConfigCliUi,
  provider: ProviderDefinition,
  fetcher?: typeof globalThis.fetch,
): Promise<CatalogModel[] | null> {
  const spinner = ui.spinner('Loading models available to this credential...');
  try {
    const models = await fetchProviderModels({ provider, fetch: fetcher });
    spinner.stop(`Loaded ${models.length} available model${models.length === 1 ? '' : 's'}`);
    return models;
  } catch (error) {
    spinner.error('Could not load available models');
    ui.info(error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function selectReasoningEffort(ui: ConfigCliUi, model: CatalogModel): Promise<string | null> {
  if (!model.reasoningEfforts.length) {
    ui.info(`The catalog does not advertise reasoning levels for "${model.id}". You can still send a standard or custom override; the provider will validate it when the route is used.`);
    const fallback = await ui.select('Reasoning effort', [
      { value: '', label: 'No reasoning override', hint: 'Do not send a reasoning effort for this route' },
      ...FALLBACK_REASONING_EFFORTS.map((value) => ({ value, label: value, hint: 'Not advertised by this provider' })),
      { value: 'custom', label: 'Custom value', hint: 'For provider-specific levels such as xhigh' },
    ]);
    if (fallback !== 'custom') return fallback;
    const custom = await ui.text('Custom reasoning effort', {
      validate: (value) => value?.trim() ? undefined : 'Reasoning effort is required.',
    });
    return custom?.trim() || null;
  }
  const effort = await ui.select('Reasoning effort', [
    { value: '', label: 'No reasoning override', hint: 'Do not send a reasoning effort for this route' },
    ...model.reasoningEfforts.map((value) => ({ value, label: value })),
  ]);
  return effort;
}

const FALLBACK_REASONING_EFFORTS = ['low', 'medium', 'high'];

async function confirmSave(ui: ConfigCliUi, message: string): Promise<boolean> {
  const confirmed = await ui.confirm(message, false);
  if (confirmed === null) ui.cancel('Configuration change cancelled.');
  return confirmed === true;
}

function validUrl(value: string | undefined): string | undefined {
  try {
    new URL(value ?? '');
    return undefined;
  } catch {
    return 'Enter a valid absolute URL.';
  }
}
