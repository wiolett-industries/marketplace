import { chmodSync, copyFileSync, existsSync } from 'node:fs';
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_OPENAI_ENDPOINT,
  DEFAULT_RESPONSE_MODEL,
  createDefaultAiProvidersConfig,
  createDefaultMcpConfig,
  getConfigPaths,
  readAiProvidersConfig,
  readMcpConfig,
  updateYamlFile,
  writeGeneratedYaml,
} from '../config.js';
import { ensureConfigAndStorageMigrated } from '../migration.js';
import { resolveOpenAIProviderConfig } from '../oai-auth/index.js';
import { createConfigCliUi, type ConfigCliUi } from './config-ui.js';

type InitArgs = {
  check: boolean;
  dryRun: boolean;
  force: boolean;
  nonInteractive: boolean;
  printPath: boolean;
  configDir?: string;
  key?: string;
  endpoint?: string;
  textApi?: 'responses' | 'chat_completions';
  responseModel?: string;
  embeddingModel?: string;
  globalMemory?: string;
  projectMemory?: string;
  workflowArtifacts?: string;
  mrReviewArtifacts?: string;
};

export interface InitCommandOptions {
  commandName?: string;
  env?: NodeJS.ProcessEnv;
  ui?: ConfigCliUi;
}

export function needsInteractiveInitialization(env: NodeJS.ProcessEnv = process.env): boolean {
  const paths = getConfigPaths(env);
  try {
    const mcp = readMcpConfig(paths.mcpConfig);
    if (!readAiProvidersConfig(paths.aiProviders) || !mcp) return true;
    return (['gate', 'synthesis', 'embeddings'] as const).some((role) => {
      if (mcp.mcp['agent-memory']?.routing?.[role] === null) return false;
      return !resolveOpenAIProviderConfig({ providersConfigPath: paths.aiProviders, mcpConfigPath: paths.mcpConfig, role });
    });
  } catch {
    return true;
  }
}

export async function runInitCommand(argv: string[], options: InitCommandOptions = {}): Promise<void> {
  const commandName = options.commandName ?? 'agent-memory init';
  const args = parseInitArgs(argv, commandName);
  const env = { ...process.env, ...options.env, ...(args.configDir ? { WIOLETT_CONFIG_DIR: args.configDir } : {}) };
  const paths = getConfigPaths(env);

  if (args.printPath) {
    console.log(paths.aiProviders);
    return;
  }
  if (args.dryRun) {
    console.log(`Agent Memory would ensure ${paths.aiProviders} and ${paths.mcpConfig}.`);
    console.log(`Legacy provider source: ${paths.legacyAuth}`);
    console.log(`Legacy global memory source: ${paths.agentsHome}/agent-memory`);
    return;
  }

  if (args.check) {
    checkConfig(paths.aiProviders, paths.mcpConfig, commandName);
    return;
  }

  if (!args.nonInteractive) {
    await collectAndConfirmInit(paths.aiProviders, paths.mcpConfig, paths.agentsHome, args, options.ui ?? createConfigCliUi(), env);
    return;
  }

  prepareExplicitMcpPaths(paths.mcpConfig, paths.agentsHome, args);
  await ensureConfigAndStorageMigrated({ trigger: 'init', env, log: (message) => console.log(message) });
  const migratedExisting = readAiProvidersConfig(paths.aiProviders)?.providers.openai;
  await writeInitConfig(paths.aiProviders, paths.mcpConfig, args, {
    apiKey: args.key ?? migratedExisting?.auth?.api_key ?? '',
    endpoint: args.endpoint ?? migratedExisting?.base_url ?? DEFAULT_OPENAI_ENDPOINT,
    textApi: args.textApi ?? migratedExisting?.defaults?.text_api ?? 'responses',
    responseModel: args.responseModel ?? migratedExisting?.defaults?.models?.text ?? DEFAULT_RESPONSE_MODEL,
    embeddingModel: args.embeddingModel ?? migratedExisting?.defaults?.models?.embeddings ?? DEFAULT_EMBEDDING_MODEL,
  });
  if (hasExplicitProviderArgs(args)) console.log(`Saved ${paths.aiProviders}`);
}

function parseInitArgs(argv: string[], commandName: string): InitArgs {
  const args: InitArgs = { check: false, dryRun: false, force: false, nonInteractive: false, printPath: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') args.check = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--non-interactive') args.nonInteractive = true;
    else if (arg === '--print-path') args.printPath = true;
    else if (arg === '--config-dir') args.configDir = readValue(argv, index += 1, arg);
    else if (arg === '--key') args.key = readValue(argv, index += 1, arg);
    else if (arg === '--endpoint') args.endpoint = readValue(argv, index += 1, arg);
    else if (arg === '--text-api') args.textApi = readTextApi(readValue(argv, index += 1, arg));
    else if (arg === '--response-model') args.responseModel = readValue(argv, index += 1, arg);
    else if (arg === '--embedding-model') args.embeddingModel = readValue(argv, index += 1, arg);
    else if (arg === '--global-memory') args.globalMemory = readValue(argv, index += 1, arg);
    else if (arg === '--project-memory') args.projectMemory = readValue(argv, index += 1, arg);
    else if (arg === '--workflow-artifacts') args.workflowArtifacts = readValue(argv, index += 1, arg);
    else if (arg === '--mr-review-artifacts') args.mrReviewArtifacts = readValue(argv, index += 1, arg);
    else if (arg === '--help' || arg === '-h') {
      printInitHelp(commandName);
      process.exit(0);
    } else throw new Error(`Unknown init option: ${arg}`);
  }
  return args;
}

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index]?.trim();
  if (!value) throw new Error(`${flag} requires a value.`);
  return value;
}

function readTextApi(value: string): 'responses' | 'chat_completions' {
  if (value === 'responses') return value;
  if (value === 'chat-completions' || value === 'chat_completions') return 'chat_completions';
  throw new Error('--text-api must be responses or chat-completions.');
}

function checkConfig(providersPath: string, mcpPath: string, commandName: string): void {
  const mcp = readMcpConfig(mcpPath);
  const roles = {
    gate: resolveOpenAIProviderConfig({ providersConfigPath: providersPath, mcpConfigPath: mcpPath, role: 'gate' }),
    synthesis: resolveOpenAIProviderConfig({ providersConfigPath: providersPath, mcpConfigPath: mcpPath, role: 'synthesis' }),
    embeddings: resolveOpenAIProviderConfig({ providersConfigPath: providersPath, mcpConfigPath: mcpPath, role: 'embeddings' }),
  };
  const unresolved = (Object.keys(roles) as Array<keyof typeof roles>)
    .filter((role) => mcp?.mcp['agent-memory']?.routing?.[role] !== null && !roles[role]);
  if (unresolved.length) {
    console.log(`Agent Memory configuration is unresolved for: ${unresolved.join(', ')}. Run: ${commandName}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Agent Memory providers are configured via ${providersPath}.`);
  printTextRole('Gate', roles.gate, mcp?.mcp['agent-memory']?.routing?.gate === null);
  printTextRole('Synthesis', roles.synthesis, mcp?.mcp['agent-memory']?.routing?.synthesis === null);
  printEmbeddingRole(roles.embeddings, mcp?.mcp['agent-memory']?.routing?.embeddings === null);
}

type InitDraft = {
  apiKey: string;
  endpoint: string;
  textApi: 'responses' | 'chat_completions';
  responseModel: string;
  embeddingModel: string;
};

async function collectAndConfirmInit(
  configPath: string,
  mcpConfigPath: string,
  agentsHome: string,
  args: InitArgs,
  ui: ConfigCliUi,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const providersConfig = readAiProvidersConfig(configPath);
  const existing = providersConfig?.providers.openai;
  ui.intro('Agent Memory · Initialize');
  if (existing?.auth?.api_key) ui.info(`Existing OpenAI settings from ${configPath} will be used as defaults.`);

  const apiKey = args.key ?? existing?.auth?.api_key ?? await ui.password('OpenAI API key', {
    validate: (value) => value?.trim() ? undefined : 'OpenAI API key is required.',
  });
  if (apiKey === null) return cancelInit(ui);
  const endpoint = args.endpoint ?? await ui.text('Endpoint', {
    initialValue: existing?.base_url ?? DEFAULT_OPENAI_ENDPOINT,
    validate: validUrl,
  });
  if (endpoint === null) return cancelInit(ui);
  const textApi = args.textApi ?? await ui.select('Text API', [
    { value: 'responses', label: 'Responses' },
    { value: 'chat_completions', label: 'Chat Completions' },
  ], existing?.defaults?.text_api ?? 'responses') as InitDraft['textApi'] | null;
  if (textApi === null) return cancelInit(ui);
  const responseModel = args.responseModel ?? await ui.text('Response model', {
    initialValue: existing?.defaults?.models?.text ?? DEFAULT_RESPONSE_MODEL,
    validate: nonEmpty('Response model is required.'),
  });
  if (responseModel === null) return cancelInit(ui);
  const embeddingModel = args.embeddingModel ?? await ui.text('Embedding model', {
    initialValue: existing?.defaults?.models?.embeddings ?? DEFAULT_EMBEDDING_MODEL,
    validate: nonEmpty('Embedding model is required.'),
  });
  if (embeddingModel === null) return cancelInit(ui);

  const draft: InitDraft = { apiKey: apiKey.trim(), endpoint, textApi, responseModel, embeddingModel };
  ui.note(renderInitSummary(draft, configPath, mcpConfigPath, args), 'Ready to initialize');
  const confirmed = await ui.confirm('Write this Agent Memory configuration?', false);
  if (confirmed !== true) return cancelInit(ui);

  // Bootstrap may create or migrate files, so it intentionally happens only after confirmation.
  prepareExplicitMcpPaths(mcpConfigPath, agentsHome, args);
  await ensureConfigAndStorageMigrated({ trigger: 'init', env, log: (message) => ui.info(message) });
  await writeInitConfig(configPath, mcpConfigPath, args, draft);
  ui.info(`Saved ${configPath}`);
  ui.info([
    'Continue configuration and access additional commands with:',
    'npx -y @wiolett/agent-memory',
    '',
    'This opens the interactive menu. Direct shortcuts include config, consolidate, usage, doctor, and view.',
  ].join('\n'));
  ui.outro('Agent Memory initialization complete.');
}

async function writeInitConfig(configPath: string, mcpConfigPath: string, args: InitArgs, draft: InitDraft): Promise<void> {
  const providersConfig = readAiProvidersConfig(configPath);
  const existing = providersConfig?.providers.openai;
  if (args.nonInteractive && !hasExplicitProviderArgs(args)) return;
  if (args.force && existsSync(configPath)) backupFile(configPath);
  if (args.force && existsSync(mcpConfigPath)) backupFile(mcpConfigPath);
  if (existing) {
    updateYaml(configPath, [
      [['providers', 'openai', 'auth', 'api_key'], draft.apiKey],
      [['providers', 'openai', 'base_url'], draft.endpoint],
      [['providers', 'openai', 'defaults', 'text_api'], draft.textApi],
      [['providers', 'openai', 'defaults', 'models', 'text'], draft.responseModel],
      [['providers', 'openai', 'defaults', 'models', 'embeddings'], draft.embeddingModel],
    ]);
  } else {
    const definition = createDefaultAiProvidersConfig().providers.openai;
    definition.auth = { api_key: draft.apiKey };
    definition.base_url = draft.endpoint;
    definition.defaults = { text_api: draft.textApi, models: { text: draft.responseModel, embeddings: draft.embeddingModel } };
    updateYaml(configPath, [[['providers', 'openai'], definition]]);
  }
  updateYaml(mcpConfigPath, routeUpdates(readMcpConfig(mcpConfigPath), draft.textApi, draft.responseModel, draft.embeddingModel));
}

function cancelInit(ui: ConfigCliUi): void {
  ui.cancel('Initialization cancelled. No configuration was written.');
}

function renderInitSummary(draft: InitDraft, configPath: string, mcpConfigPath: string, args: InitArgs): string {
  return [
    `Endpoint: ${draft.endpoint}`,
    `Text API: ${draft.textApi === 'chat_completions' ? 'Chat Completions' : 'Responses'}`,
    `Response model: ${draft.responseModel}`,
    `Embedding model: ${draft.embeddingModel}`,
    `Providers file: ${configPath}`,
    `MCP file: ${mcpConfigPath}`,
    ...(args.globalMemory ? [`Global memory: ${args.globalMemory}`] : []),
    ...(args.projectMemory ? [`Project memory: ${args.projectMemory}`] : []),
  ].join('\n');
}

function validUrl(value: string | undefined): string | undefined {
  try {
    new URL(value ?? '');
    return undefined;
  } catch {
    return 'Enter a valid absolute URL.';
  }
}

function nonEmpty(message: string): (value: string | undefined) => string | undefined {
  return (value) => value?.trim() ? undefined : message;
}

function routeUpdates(
  config: ReturnType<typeof readMcpConfig>,
  textApi: 'responses' | 'chat_completions',
  responseModel: string,
  embeddingModel: string,
): Array<[Array<string>, unknown]> {
  const routing = config?.mcp['agent-memory']?.routing;
  const updates: Array<[Array<string>, unknown]> = [];
  for (const role of ['gate', 'synthesis'] as const) {
    const route = routing?.[role];
    if (route === null || (route && route.provider !== 'openai')) continue;
    if (!route) updates.push([['mcp', 'agent-memory', 'routing', role], { provider: 'openai', api: textApi, model: responseModel }]);
    else {
      updates.push([['mcp', 'agent-memory', 'routing', role, 'api'], textApi]);
      updates.push([['mcp', 'agent-memory', 'routing', role, 'model'], responseModel]);
    }
  }
  const embedding = routing?.embeddings;
  if (embedding !== null && (!embedding || embedding.provider === 'openai')) {
    if (!embedding) updates.push([['mcp', 'agent-memory', 'routing', 'embeddings'], { provider: 'openai', api: 'embeddings', model: embeddingModel }]);
    else updates.push([['mcp', 'agent-memory', 'routing', 'embeddings', 'model'], embeddingModel]);
  }
  return updates;
}

function printTextRole(
  label: string,
  provider: ReturnType<typeof resolveOpenAIProviderConfig>,
  disabled: boolean,
): void {
  if (disabled) {
    console.log(`${label}: disabled`);
    return;
  }
  if (!provider) return;
  console.log(`${label}: provider=${provider.providerId} api=${provider.textApi === 'chat_completions' ? 'chat-completions' : provider.textApi} model=${provider.model ?? DEFAULT_RESPONSE_MODEL} endpoint=${provider.baseUrl}`);
}

function printEmbeddingRole(
  provider: ReturnType<typeof resolveOpenAIProviderConfig>,
  disabled: boolean,
): void {
  if (disabled) {
    console.log('Embeddings: disabled');
    return;
  }
  if (!provider) return;
  console.log(`Embeddings: provider=${provider.providerId} model=${provider.embeddingModel ?? DEFAULT_EMBEDDING_MODEL} endpoint=${provider.baseUrl}`);
}

function prepareExplicitMcpPaths(configPath: string, agentsHome: string, args: InitArgs): void {
  const updates: Array<[Array<string>, string]> = [];
  if (args.globalMemory) updates.push([['mcp', 'agent-memory', 'storage', 'memory', 'global'], args.globalMemory]);
  if (args.projectMemory) updates.push([['mcp', 'agent-memory', 'storage', 'memory', 'project'], args.projectMemory]);
  if (args.workflowArtifacts) updates.push([['mcp', 'workflow', 'artifacts', 'root'], args.workflowArtifacts]);
  if (args.mrReviewArtifacts) updates.push([['mcp', 'merge-request-review', 'artifacts', 'root'], args.mrReviewArtifacts]);
  if (!updates.length) return;
  if (!existsSync(configPath)) writeGeneratedYaml(configPath, createDefaultMcpConfig(agentsHome), 'mcp');
  if (args.force) backupFile(configPath);
  updateYaml(configPath, updates);
}

function updateYaml(configPath: string, updates: Array<[Array<string>, unknown]>): void {
  updateYamlFile(configPath, updates.map(([path, value]) => ({ type: 'set', path, value })));
}

function backupFile(configPath: string): void {
  const backup = `${configPath}.bak-${new Date().toISOString().replace(/[:.]/gu, '-')}`;
  copyFileSync(configPath, backup);
  chmodSync(backup, 0o600);
}

function hasExplicitProviderArgs(args: InitArgs): boolean {
  return Boolean(args.key || args.endpoint || args.textApi || args.responseModel || args.embeddingModel);
}

function printInitHelp(commandName: string): void {
  console.log([
    `Usage: ${commandName} [options]`,
    '',
    'Options:',
    '  --check                         Validate and display the active configuration',
    '  --dry-run                       Show bootstrap paths without writing files',
    '  --force                         Update without confirmation and create a backup',
    '  --non-interactive               Do not prompt for missing values',
    '  --print-path                    Print the AI providers config path',
    '  --config-dir <path>             Override the Wiolett config directory',
    '  --key <key>                     Store an API key in ai-providers.yml',
    `  --endpoint <url>                Provider base URL (default: ${DEFAULT_OPENAI_ENDPOINT})`,
    '  --text-api <api>                responses or chat-completions',
    `  --response-model <model>        Text model (default: ${DEFAULT_RESPONSE_MODEL})`,
    `  --embedding-model <model>       Embedding model (default: ${DEFAULT_EMBEDDING_MODEL})`,
    '  --global-memory <path>          Configure global Agent Memory storage',
    '  --project-memory <path>         Configure project Agent Memory storage',
    '  --workflow-artifacts <path>     Configure Workflow artifact root',
    '  --mr-review-artifacts <path>    Configure Merge Request Review artifact root',
  ].join('\n'));
}
