import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createDefaultModelProvider,
  extractResponseOutputText,
  OpenAIEmbeddingsClient,
  OpenAIResponsesClient,
  resolveOpenAIProviderConfig,
} from '../dist/index.js';

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

test('OpenAI responses client defaults to gpt-5-nano', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer sk-test');
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, 'gpt-5-nano');
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
    model: 'ignored-config-model',
    defaultModel: 'ignored-default-model',
    embeddingModel: 'embed-test',
    organization: 'org-test',
    project: 'proj-test',
  }), 'utf8');

  const config = resolveOpenAIProviderConfig({ configPath });
  assert.equal(config?.source, 'wiolett-config');
  assert.equal(config?.apiKey, 'sk-test-config');
  assert.equal(config?.baseUrl, 'https://provider.test/v1');
  assert.equal(config?.model, undefined);
  assert.equal(config?.embeddingModel, 'embed-test');
  assert.equal(config?.headers?.['OpenAI-Organization'], 'org-test');
  assert.equal(config?.headers?.['OpenAI-Project'], 'proj-test');
});

test('allows only explicit text model overrides', async () => {
  await withoutAmbientAuth(async () => {
    const configPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'wiolett-auth-model-')), 'auth-config.json');
    await fs.writeFile(configPath, JSON.stringify({
      openAIKey: 'sk-test-config',
      model: 'ignored-config-model',
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
