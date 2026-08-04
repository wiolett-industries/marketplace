import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createDefaultModelProvider,
  extractResponseOutputText,
  OpenAIChatCompletionsClient,
  OpenAIEmbeddingsClient,
  OpenAIResponsesClient,
  resolveOpenAIProviderConfig,
} from '../dist/oai-auth/index.js';

async function withoutAmbientAuth(fn) {
  const previousOpenAI = process.env.OPENAI_API_KEY;
  const previousConfig = process.env.WIOLETT_AUTH_CONFIG_PATH;
  delete process.env.OPENAI_API_KEY;
  delete process.env.WIOLETT_AUTH_CONFIG_PATH;
  try {
    return await fn();
  } finally {
    if (previousOpenAI === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAI;
    if (previousConfig === undefined) delete process.env.WIOLETT_AUTH_CONFIG_PATH;
    else process.env.WIOLETT_AUTH_CONFIG_PATH = previousConfig;
  }
}

test('extracts output text from response shapes', () => {
  assert.equal(extractResponseOutputText({ output_text: 'hello' }), 'hello');
  assert.equal(extractResponseOutputText({
    output: [{
      content: [
        { type: 'output_text', text: 'hello' },
        { type: 'output_text', text: 'world' },
      ],
    }],
  }), 'hello\nworld');
});

test('OpenAI responses client defaults to gpt-5.6-luna', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer sk-test');
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, 'gpt-5.6-luna');
    assert.equal(body.store, false);
    return new Response(JSON.stringify({ output_text: 'hi' }), { status: 200 });
  };

  try {
    const client = new OpenAIResponsesClient({ apiKey: 'sk-test', configPath: path.join(os.tmpdir(), 'missing-wiolett-auth-config.json') });
    const response = await client.createTextResponse({ input: 'say hi' });
    assert.equal(response.outputText, 'hi');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('OpenAI fallback requires provider auth', async () => {
  await withoutAmbientAuth(async () => {
    const client = new OpenAIResponsesClient({ apiKey: '', configPath: path.join(os.tmpdir(), 'missing-wiolett-auth-config.json') });
    await assert.rejects(() => client.createResponse({ input: 'hello' }), /OpenAI-compatible auth/);
  });
});

test('reads Wiolett OpenAI-compatible fallback config', async () => {
  const configPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'wiolett-auth-')), 'auth-config.json');
  await fs.writeFile(configPath, JSON.stringify({
    openAIKey: 'sk-test-config',
    endpoint: 'https://provider.test/v1',
    model: 'ignored-generic-config-model',
    defaultModel: 'ignored-default-model',
    responseModel: 'gpt-configured',
    embeddingModel: 'embed-test',
    organization: 'org-test',
    project: 'proj-test',
  }), 'utf8');

  const config = resolveOpenAIProviderConfig({ configPath });
  assert.equal(config?.source, 'wiolett-config');
  assert.equal(config?.apiKey, 'sk-test-config');
  assert.equal(config?.baseUrl, 'https://provider.test/v1');
  assert.equal(config?.model, 'gpt-configured');
  assert.equal(config?.embeddingModel, 'embed-test');
  assert.equal(config?.headers?.['OpenAI-Organization'], 'org-test');
  assert.equal(config?.headers?.['OpenAI-Project'], 'proj-test');
});

test('explicit text model overrides responseModel config', async () => {
  await withoutAmbientAuth(async () => {
    const configPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'wiolett-auth-model-')), 'auth-config.json');
    await fs.writeFile(configPath, JSON.stringify({
      openAIKey: 'sk-test-config',
      responseModel: 'gpt-configured',
    }), 'utf8');

    const config = resolveOpenAIProviderConfig({ configPath, model: 'gpt-explicit' });
    assert.equal(config?.model, 'gpt-explicit');
  });
});

test('reads OPENAI_API_KEY as provider auth', () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test-env';
  try {
    const config = resolveOpenAIProviderConfig({ configPath: path.join(os.tmpdir(), 'missing-wiolett-auth-config.json') });
    assert.equal(config?.source, 'environment');
    assert.equal(config?.apiKey, 'sk-test-env');
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test('provider auth precedence is explicit, environment, then config', async () => {
  const configPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'provider-precedence-')), 'auth-config.json');
  await fs.writeFile(configPath, JSON.stringify({ openAIKey: 'sk-test-config' }), 'utf8');
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test-env';
  try {
    assert.equal(resolveOpenAIProviderConfig({ apiKey: 'sk-test-explicit', configPath })?.apiKey, 'sk-test-explicit');
    assert.equal(resolveOpenAIProviderConfig({ configPath })?.apiKey, 'sk-test-env');
    delete process.env.OPENAI_API_KEY;
    assert.equal(resolveOpenAIProviderConfig({ configPath })?.apiKey, 'sk-test-config');
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test('default provider uses OpenAI-compatible config only', async () => {
  await withoutAmbientAuth(async () => {
    const configPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'provider-auth-')), 'auth-config.json');
    await fs.writeFile(configPath, JSON.stringify({ openAIKey: 'sk-test-provider' }), 'utf8');
    const provider = await createDefaultModelProvider({
      openai: { configPath },
    });

    assert.equal(provider.source, 'openai-compatible');
    assert.ok(provider.modelClient);
    assert.ok(provider.embeddingClient);
  });
});

test('OpenAI embeddings client parses vectors', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer sk-test');
    return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 'bad'] }] }), { status: 200 });
  };

  try {
    const client = new OpenAIEmbeddingsClient({ apiKey: 'sk-test' });
    assert.deepEqual(await client.createEmbedding('hello'), [0.1, 0.2]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('routes Chat Completions through its own request and response adapter', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-provider-'));
  const providersPath = path.join(root, 'ai-providers.yml');
  const mcpPath = path.join(root, 'mcp-config.yml');
  await fs.writeFile(providersPath, `version: 1
providers:
  chat:
    driver: openai-compatible
    base_url: https://chat.test/v1
    auth:
      api_key: sk-chat
    apis:
      chat_completions:
        path: /chat/completions
      embeddings:
        path: /embeddings
    defaults:
      text_api: chat_completions
      models:
        text: chat-model
`, 'utf8');
  await fs.writeFile(mcpPath, `version: 1
mcp:
  agent-memory:
    routing:
      gate:
        provider: chat
        api: chat_completions
        model: gate-model
        reasoning_effort: high
`, 'utf8');

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://chat.test/v1/chat/completions');
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, 'gate-model');
    assert.deepEqual(body.messages, [
      { role: 'developer', content: 'Return JSON.' },
      { role: 'user', content: 'hello' },
    ]);
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.reasoning_effort, 'high');
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 });
  };
  try {
    const client = new OpenAIChatCompletionsClient({
      role: 'gate',
      providersConfigPath: providersPath,
      mcpConfigPath: mcpPath,
    });
    const response = await client.createTextResponse({
      instructions: 'Return JSON.',
      input: 'hello',
      text: { format: { type: 'json_schema', name: 'result', strict: true, schema: { type: 'object' } } },
    });
    assert.equal(response.outputText, '{"ok":true}');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('resolves embeddings, gate, and synthesis from independently selected providers', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mixed-provider-routing-'));
  const providersPath = path.join(root, 'ai-providers.yml');
  const mcpPath = path.join(root, 'mcp-config.yml');
  await fs.writeFile(providersPath, `version: 1
providers:
  primary:
    driver: openai
    base_url: https://primary.test/v1
    auth:
      api_key: sk-primary
    apis:
      responses: { path: /responses, store: false }
      embeddings: { path: /embeddings }
  cheap:
    driver: openai-compatible
    base_url: https://cheap.test/v1
    auth:
      api_key: sk-cheap
    apis:
      chat_completions: { path: /chat/completions }
      embeddings: { path: /embed }
`, 'utf8');
  await fs.writeFile(mcpPath, `version: 1
mcp:
  agent-memory:
    routing:
      embeddings: { provider: cheap, api: embeddings, model: embed-cheap }
      gate: { provider: cheap, api: chat_completions, model: gate-cheap, reasoning_effort: low }
      synthesis: { provider: primary, api: responses, model: synth-primary }
`, 'utf8');

  const shared = { providersConfigPath: providersPath, mcpConfigPath: mcpPath };
  const embedding = resolveOpenAIProviderConfig({ ...shared, role: 'embeddings' });
  const gate = resolveOpenAIProviderConfig({ ...shared, role: 'gate' });
  const synthesis = resolveOpenAIProviderConfig({ ...shared, role: 'synthesis' });
  assert.equal(embedding?.providerId, 'cheap');
  assert.equal(embedding?.embeddingModel, 'embed-cheap');
  assert.equal(embedding?.apiPath, '/embed');
  assert.equal(gate?.providerId, 'cheap');
  assert.equal(gate?.textApi, 'chat_completions');
  assert.equal(gate?.model, 'gate-cheap');
  assert.equal(gate?.reasoningEffort, 'low');
  assert.equal(synthesis?.providerId, 'primary');
  assert.equal(synthesis?.textApi, 'responses');
  assert.equal(synthesis?.model, 'synth-primary');
});

test('never reuses legacy credentials for a named provider', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'provider-credential-boundary-'));
  const providersPath = path.join(root, 'ai-providers.yml');
  const mcpPath = path.join(root, 'mcp-config.yml');
  const legacyPath = path.join(root, 'auth-config.json');
  await fs.writeFile(providersPath, `version: 1
providers:
  custom:
    driver: openai-compatible
    base_url: https://third-party.test/v1
    apis:
      chat_completions: { path: /chat/completions }
`, 'utf8');
  await fs.writeFile(mcpPath, `version: 1
mcp:
  agent-memory:
    routing:
      gate: { provider: custom, api: chat_completions, model: custom-gate }
`, 'utf8');
  await fs.writeFile(legacyPath, JSON.stringify({ openAIKey: 'sk-legacy-secret' }), 'utf8');

  assert.equal(resolveOpenAIProviderConfig({
    role: 'gate',
    providersConfigPath: providersPath,
    mcpConfigPath: mcpPath,
    configPath: legacyPath,
  }), null);
});
