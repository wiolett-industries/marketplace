import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readAiProvidersConfig, readMcpConfig } from '../dist/config.js';
import { runConfigCommand } from '../dist/cli/config-command.js';

function createUi({ selects = [], texts = [], passwords = [], confirms = [] }) {
  const messages = [];
  const take = (items, kind) => {
    if (!items.length) throw new Error(`Missing ${kind} test response.`);
    return items.shift();
  };
  return {
    messages,
    intro(message) { messages.push(message); },
    info(message) { messages.push(message); },
    note(message) { messages.push(message); },
    cancel(message) { messages.push(message); },
    outro(message) { messages.push(message); },
    async select() { return take(selects, 'select'); },
    async text() { return take(texts, 'text'); },
    async password() { return take(passwords, 'password'); },
    async confirm() { return take(confirms, 'confirm'); },
    spinner() { return { stop(message) { messages.push(message); }, error(message) { messages.push(message); } }; },
  };
}

function createInput(ui) {
  const agentsHome = mkdtempSync(path.join(tmpdir(), 'agent-memory-config-'));
  return {
    agentsHome,
    input: { env: { PROJECT_MEMORY_AGENTS_HOME: agentsHome, OPENAI_API_KEY: '' }, ui },
  };
}

function configPaths(agentsHome) {
  const configDir = path.join(agentsHome, '.wiolett', 'config');
  return {
    providers: path.join(configDir, 'ai-providers.yml'),
    mcp: path.join(configDir, 'mcp-config.yml'),
  };
}

describe('agent-memory config', () => {
  test('adds an OpenAI-compatible provider without displaying its API key', async () => {
    const apiKey = 'sk-config-secret';
    const ui = createUi({
      selects: ['provider', 'add', 'openai-compatible', 'responses', 'exit'],
      texts: ['gateway', 'https://gateway.test/v1', 'gateway-chat', 'gateway-embed', '45000'],
      passwords: [apiKey],
      confirms: [true, true],
    });
    const { agentsHome, input } = createInput(ui);

    await runConfigCommand([], input);

    const paths = configPaths(agentsHome);
    const provider = readAiProvidersConfig(paths.providers)?.providers.gateway;
    expect(provider).toMatchObject({
      driver: 'openai-compatible',
      base_url: 'https://gateway.test/v1',
      auth: { api_key: apiKey },
      defaults: { text_api: 'responses', models: { text: 'gateway-chat', embeddings: 'gateway-embed' } },
      timeout_ms: 45000,
    });
    expect(readFileSync(paths.providers, 'utf8')).toContain('gateway:');
    expect(ui.messages.join('\n')).not.toContain(apiKey);
  });

  test('assigns Gate independently to a provider and Chat Completions model', async () => {
    const providerUi = createUi({
      selects: ['provider', 'add', 'openai-compatible', 'responses', 'exit'],
      texts: ['gateway', 'https://gateway.test/v1', 'gateway-default', 'gateway-embed', '30000'],
      passwords: ['sk-route-secret'],
      confirms: [true, true],
    });
    const { agentsHome, input } = createInput(providerUi);
    await runConfigCommand([], input);

    const routeUi = createUi({
      selects: ['routing', 'gate', 'set', 'gateway', 'chat_completions', 'gate-specific', 'high', 'exit'],
      confirms: [true],
    });
    await runConfigCommand([], {
      ...input,
      ui: routeUi,
      fetch: async (url, init) => {
        expect(url).toBe('https://gateway.test/v1/models');
        expect(init.headers.Authorization).toBe('Bearer sk-route-secret');
        return new Response(JSON.stringify({
          models: [{ slug: 'gate-specific', visibility: 'list', supported_in_api: true, supported_reasoning_levels: ['low', 'high'] }],
        }), { status: 200 });
      },
    });

    const config = readMcpConfig(configPaths(agentsHome).mcp);
    expect(config?.mcp['agent-memory']?.routing?.gate).toEqual({
      provider: 'gateway',
      api: 'chat_completions',
      model: 'gate-specific',
      reasoning_effort: 'high',
    });
    expect(config?.mcp['agent-memory']?.routing?.synthesis).toMatchObject({ provider: 'openai' });
  });

  test('allows a reasoning override when the provider catalog omits reasoning metadata', async () => {
    const providerUi = createUi({
      selects: ['provider', 'add', 'openai-compatible', 'responses', 'exit'],
      texts: ['gateway', 'https://gateway.test/v1', 'gateway-default', 'gateway-embed', '30000'],
      passwords: ['sk-route-secret'],
      confirms: [true, true],
    });
    const { agentsHome, input } = createInput(providerUi);
    await runConfigCommand([], input);

    const routeUi = createUi({
      selects: ['routing', 'gate', 'set', 'gateway', 'responses', 'model-without-metadata', 'high', 'exit'],
      confirms: [true],
    });
    await runConfigCommand([], {
      ...input,
      ui: routeUi,
      fetch: async () => new Response(JSON.stringify({
        data: [{ id: 'model-without-metadata' }],
      }), { status: 200 }),
    });

    const route = readMcpConfig(configPaths(agentsHome).mcp)?.mcp['agent-memory']?.routing?.gate;
    expect(route).toEqual({
      provider: 'gateway',
      api: 'responses',
      model: 'model-without-metadata',
      reasoning_effort: 'high',
    });
    expect(routeUi.messages.join('\n')).toContain('does not advertise reasoning levels');
  });
});
