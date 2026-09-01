import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from '@jest/globals';
import { needsInteractiveInitialization, runInitCommand } from '../dist/cli/init.js';
import { formatMaskedPasswordLine, isCliAbortError } from '../dist/cli/prompts.js';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(packageDir, 'dist', 'index.js');

function runCli(args, options = {}) {
  const agentsHome = options.agentsHome ?? mkdtempSync(path.join(tmpdir(), 'agent-memory-init-home-'));
  const env = {
    ...process.env,
    OPENAI_API_KEY: '',
    PROJECT_MEMORY_AGENTS_HOME: agentsHome,
    WIOLETT_AUTH_CONFIG_PATH: options.legacyConfigPath ?? path.join(agentsHome, '.wiolett', 'auth-config.json'),
  };

  return execFileSync(process.execPath, [cliPath, ...args], {
    cwd: packageDir,
    encoding: 'utf8',
    env,
  });
}

function tempAgentsHome() {
  return mkdtempSync(path.join(tmpdir(), 'agent-memory-init-home-'));
}

function providersPath(agentsHome) {
  return path.join(agentsHome, '.wiolett', 'config', 'ai-providers.yml');
}

function interactiveUi({ password = 'sk-interactive', texts = [], selections = ['responses'], confirmed = true } = {}) {
  const notes = [];
  return {
    notes,
    intro() {},
    info(message) { notes.push(message); },
    note(message) { notes.push(message); },
    cancel() {},
    outro() {},
    async password() { return password; },
    async text() { return texts.shift() ?? null; },
    async select() { return selections.shift() ?? null; },
    async confirm() { return confirmed; },
    spinner() { return { stop() {}, error() {} }; },
  };
}

describe('agent-memory init', () => {
  test('caps masked password rendering to one terminal line', () => {
    const line = formatMaskedPasswordLine('OpenAI API key: ', 200, 40);
    expect(line.length).toBeLessThanOrEqual(40);
    expect(line.startsWith('OpenAI API key: ■')).toBe(true);
    expect(line.endsWith('…')).toBe(true);
  });

  test('recognizes readline Ctrl-C abort errors', () => {
    expect(isCliAbortError({ code: 'ABORT_ERR' })).toBe(true);
  });

  test('collects interactive input before any bootstrap writes and leaves no files on final cancellation', async () => {
    const agentsHome = tempAgentsHome();
    const ui = interactiveUi({
      texts: ['https://interactive.test/v1', 'gpt-interactive', 'embed-interactive'],
      confirmed: false,
    });

    await runInitCommand([], {
      env: { PROJECT_MEMORY_AGENTS_HOME: agentsHome, OPENAI_API_KEY: '' },
      ui,
    });

    expect(existsSync(providersPath(agentsHome))).toBe(false);
    expect(existsSync(path.join(agentsHome, '.wiolett', 'config', 'mcp-config.yml'))).toBe(false);
    expect(existsSync(path.join(agentsHome, '.wiolett', 'migration', 'agent-memory-v1.json'))).toBe(false);
    expect(ui.notes).toHaveLength(1);
    expect(ui.notes[0]).not.toContain('sk-interactive');
    expect(ui.notes[0]).toContain('gpt-interactive');
  });

  test('writes the collected interactive draft only after the final confirmation', async () => {
    const agentsHome = tempAgentsHome();
    const ui = interactiveUi({
      texts: ['https://interactive.test/v1', 'gpt-interactive', 'embed-interactive'],
    });

    await runInitCommand([], {
      env: { PROJECT_MEMORY_AGENTS_HOME: agentsHome, OPENAI_API_KEY: '' },
      ui,
    });

    const config = readFileSync(providersPath(agentsHome), 'utf8');
    expect(config).toContain('base_url: https://interactive.test/v1');
    expect(config).toContain('text: gpt-interactive');
    expect(config).toContain('embeddings: embed-interactive');
    expect(ui.notes.at(-1)).toContain('npx -y @wiolett/agent-memory');
  });

  test('requires interactive initialization until every enabled route resolves', () => {
    const agentsHome = tempAgentsHome();
    const env = { PROJECT_MEMORY_AGENTS_HOME: agentsHome, OPENAI_API_KEY: '' };
    expect(needsInteractiveInitialization(env)).toBe(true);

    runCli([
      'init', '--key', 'sk-test', '--response-model', 'gpt-test', '--embedding-model', 'embed-test', '--non-interactive', '--force',
    ], { agentsHome });

    expect(needsInteractiveInitialization(env)).toBe(false);
  });

  test('prints the resolved config path', () => {
    const agentsHome = tempAgentsHome();
    const output = runCli(['init', '--print-path'], { agentsHome });
    expect(output.trim()).toBe(providersPath(agentsHome));
  });

  test('check exits non-zero when auth is not configured', () => {
    expect(() => runCli(['init', '--check'])).toThrow(
      expect.objectContaining({
        status: 1,
        stdout: expect.stringContaining('Agent Memory configuration is unresolved'),
      })
    );
  });

  test('writes non-interactive API key config with a dedicated response model', () => {
    const agentsHome = tempAgentsHome();
    const configPath = providersPath(agentsHome);
    const output = runCli(
      [
        'init',
        '--key',
        'sk-test',
        '--endpoint',
        'https://provider.test/v1',
        '--response-model',
        'gpt-provider',
        '--embedding-model',
        'embed-test',
        '--non-interactive',
        '--force',
      ],
      { agentsHome }
    );

    expect(output).toContain(`Saved ${configPath}`);
    const config = readFileSync(configPath, 'utf8');
    expect(config).toContain('# Generated by Agent Memory.');
    expect(config).toMatch(/api_key: ["']?sk-test["']?/);
    expect(config).toContain('base_url: https://provider.test/v1');
    expect(config).toContain('text: gpt-provider');
    expect(config).toContain('embeddings: embed-test');
    expect(statSync(configPath).mode & 0o777).toBe(0o600);

    const checkOutput = runCli(['init', '--check'], { agentsHome });
    expect(checkOutput).toContain(`Agent Memory providers are configured via ${configPath}`);
    expect(checkOutput).toContain('Synthesis: provider=openai api=responses model=gpt-provider endpoint=https://provider.test/v1');
    expect(checkOutput).toContain('Embeddings: provider=openai model=embed-test endpoint=https://provider.test/v1');

    writeFileSync(configPath, config.replace('providers:', '# User comment must survive init updates.\nproviders:'), 'utf8');
    runCli(['init', '--response-model', 'gpt-updated', '--non-interactive', '--force'], { agentsHome });
    const updated = readFileSync(configPath, 'utf8');
    expect(updated).toContain('# User comment must survive init updates.');
    expect(updated).toContain('text: gpt-updated');
  });

  test('prompts for a key when bootstrap created an empty canonical credential', async () => {
    const agentsHome = tempAgentsHome();
    runCli(['init', '--non-interactive'], { agentsHome });
    expect(readFileSync(providersPath(agentsHome), 'utf8')).toMatch(/api_key:\s*["']?["']?\s*$/m);

    const ui = interactiveUi({
      password: 'sk-recovered',
      texts: ['https://interactive.test/v1', 'gpt-interactive', 'embed-interactive'],
    });
    await runInitCommand([], {
      env: { PROJECT_MEMORY_AGENTS_HOME: agentsHome, OPENAI_API_KEY: '' },
      ui,
    });

    expect(readFileSync(providersPath(agentsHome), 'utf8')).toMatch(/api_key:\s*["']?sk-recovered["']?/);
  });

  test('preserves custom role routes while updating OpenAI defaults', () => {
    const agentsHome = tempAgentsHome();
    const configDir = path.join(agentsHome, '.wiolett', 'config');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(path.join(configDir, 'ai-providers.yml'), `version: 1
providers:
  openai:
    driver: openai
    base_url: https://api.openai.com/v1
    auth: { api_key: sk-openai }
    apis:
      responses: { path: /responses }
      embeddings: { path: /embeddings }
    defaults:
      text_api: responses
      models: { text: gpt-old, embeddings: embed-old }
  custom:
    driver: openai-compatible
    base_url: https://custom.test/v1
    auth: { api_key: sk-custom }
    apis:
      chat_completions: { path: /chat/completions }
`, 'utf8');
    const mcpPath = path.join(configDir, 'mcp-config.yml');
    writeFileSync(mcpPath, `version: 1
mcp:
  agent-memory:
    routing:
      embeddings: { provider: openai, api: embeddings, model: embed-old }
      gate: { provider: custom, api: chat_completions, model: custom-gate }
      synthesis: { provider: custom, api: chat_completions, model: custom-synthesis }
`, 'utf8');

    runCli(['init', '--response-model', 'gpt-updated', '--embedding-model', 'embed-updated', '--non-interactive', '--force'], { agentsHome });
    const updated = readFileSync(mcpPath, 'utf8');
    expect(updated).toContain('model: custom-gate');
    expect(updated).toContain('model: custom-synthesis');
    expect(updated).toContain('model: embed-updated');

    const checkOutput = runCli(['init', '--check'], { agentsHome });
    expect(checkOutput).toContain('Gate: provider=custom api=chat-completions model=custom-gate endpoint=https://custom.test/v1');
    expect(checkOutput).toContain('Synthesis: provider=custom api=chat-completions model=custom-synthesis endpoint=https://custom.test/v1');
  });
});
