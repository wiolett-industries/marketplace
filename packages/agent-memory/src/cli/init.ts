import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDefaultWiolettAuthConfigPath, resolveOpenAIProviderConfig } from '../oai-auth/index.js';
import { promptConfirm, promptPassword, promptText, renderInitFooter, renderInitHeader } from './prompts.js';

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

type InitArgs = {
  check: boolean;
  force: boolean;
  printPath: boolean;
  key?: string;
  endpoint?: string;
  embeddingModel?: string;
};

interface InitCommandOptions {
  commandName?: string;
}

export async function runInitCommand(argv: string[], options: InitCommandOptions = {}): Promise<void> {
  const commandName = options.commandName ?? 'agent-memory init';
  const args = parseInitArgs(argv, commandName);
  const configPath = getConfigPath();

  if (args.printPath) {
    console.log(configPath);
    return;
  }

  if (args.check) {
    checkConfig(configPath, commandName);
    return;
  }

  await initConfig(configPath, args);
}

function parseInitArgs(argv: string[], commandName: string): InitArgs {
  const args: InitArgs = {
    check: false,
    force: false,
    printPath: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') args.check = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--print-path') args.printPath = true;
    else if (arg === '--key') args.key = readValue(argv, index += 1, '--key');
    else if (arg === '--endpoint') args.endpoint = readValue(argv, index += 1, '--endpoint');
    else if (arg === '--embedding-model') args.embeddingModel = readValue(argv, index += 1, '--embedding-model');
    else if (arg === '--help' || arg === '-h') {
      printInitHelp(commandName);
      process.exit(0);
    } else {
      throw new Error(`Unknown init option: ${arg}`);
    }
  }

  return args;
}

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index]?.trim();
  if (!value) throw new Error(`${flag} requires a value.`);
  return value;
}

function getConfigPath(): string {
  return process.env.WIOLETT_AUTH_CONFIG_PATH?.trim() || getDefaultWiolettAuthConfigPath();
}

function checkConfig(configPath: string, commandName: string): void {
  const provider = resolveOpenAIProviderConfig({ configPath });
  if (!provider) {
    console.log(`Agent Memory auth is not configured. Run: ${commandName}`);
    process.exitCode = 1;
    return;
  }

  const source = provider.source === 'environment' ? 'OPENAI_API_KEY' : configPath;
  console.log(`Agent Memory auth is configured via ${source}.`);
  console.log(`Endpoint: ${provider.baseUrl}`);
  console.log(`Embedding model: ${provider.embeddingModel ?? DEFAULT_EMBEDDING_MODEL}`);
}

async function initConfig(configPath: string, args: InitArgs): Promise<void> {
  const existing = resolveOpenAIProviderConfig({ configPath });
  if (existing && !args.force && !args.key) {
    console.log(`Agent Memory auth is already configured via ${existing.source === 'environment' ? 'OPENAI_API_KEY' : configPath}.`);
    const overwrite = await promptConfirm('Write a config file anyway?', false);
    if (!overwrite) return;
  }

  renderInitHeader();
  try {
    const openAIKey = args.key ?? await promptRequiredPassword('OpenAI API key');
    const endpoint = args.endpoint ?? await promptText('Endpoint', DEFAULT_ENDPOINT);
    const embeddingModel = args.embeddingModel ?? await promptText('Embedding model', DEFAULT_EMBEDDING_MODEL);
    writeConfig(configPath, {
      openAIKey,
      endpoint,
      embeddingModel,
    });
    process.stdout.write(`\x1b[36m│\x1b[0m Saved ${configPath}\n`);
  } finally {
    renderInitFooter();
  }
}

async function promptRequiredPassword(message: string): Promise<string> {
  const value = (await promptPassword(message)).trim();
  if (!value) throw new Error('OpenAI API key is required.');
  return value;
}

function writeConfig(configPath: string, config: { openAIKey: string; endpoint: string; embeddingModel: string }): void {
  mkdirSync(path.dirname(configPath), { recursive: true, mode: 0o700 });
  const existing = readExistingConfig(configPath);
  const next = {
    ...existing,
    openAIKey: config.openAIKey,
    endpoint: config.endpoint || DEFAULT_ENDPOINT,
    embeddingModel: config.embeddingModel || DEFAULT_EMBEDDING_MODEL,
  };
  delete (next as { model?: unknown }).model;
  delete (next as { defaultModel?: unknown }).defaultModel;

  writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  chmodSync(configPath, 0o600);
}

function readExistingConfig(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function printInitHelp(commandName: string): void {
  console.log([
    `Usage: ${commandName} [options]`,
    '',
    'Options:',
    '  --check                    Check whether auth is configured',
    '  --force                    Overwrite existing config without asking',
    '  --print-path               Print config path',
    '  --key <key>                Non-interactive API key setup',
    '  --endpoint <url>           API endpoint (default: https://api.openai.com/v1)',
    '  --embedding-model <model>  Embedding model (default: text-embedding-3-small)',
  ].join('\n'));
}
