import { describe, expect, test } from '@jest/globals';
import { evaluateMemoryWrite } from '../dist/gate/write-gate.js';
import { resetModelProvider } from '../dist/model-provider.js';

async function withMockedProvider(fn) {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  const previousConfigPath = process.env.WIOLETT_AUTH_CONFIG_PATH;
  process.env.OPENAI_API_KEY = 'sk-test-gate';
  process.env.WIOLETT_AUTH_CONFIG_PATH = '/tmp/agent-memory-missing-gate-config.json';
  resetModelProvider();

  try {
    return await fn();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousConfigPath === undefined) delete process.env.WIOLETT_AUTH_CONFIG_PATH;
    else process.env.WIOLETT_AUTH_CONFIG_PATH = previousConfigPath;
    resetModelProvider();
  }
}

describe('memory write gate', () => {
  test('uses strict structured output schema that is accepted by OpenAI-compatible providers', async () => {
    await withMockedProvider(async () => {
      let requestBody;
      globalThis.fetch = async (_url, init) => {
        requestBody = JSON.parse(String(init.body));
        return new Response(JSON.stringify({
          output_text: JSON.stringify({
            decision: 'rewrite',
            reason: 'Durable project workflow.',
            normalized_content: 'Normalized durable workflow.',
            suggested_scope: null,
            suggested_tags: ['workflow'],
            confidence: 0.9,
            importance: 0.8,
          }),
        }), { status: 200 });
      };

      const result = await evaluateMemoryWrite({
        content: 'Durable workflow',
        tags: ['workflow'],
        scope: 'project',
        operation: 'save',
      });

      expect(result).toEqual(expect.objectContaining({
        decision: 'rewrite',
        normalized_content: 'Normalized durable workflow.',
        suggested_tags: ['workflow'],
      }));
      expect(requestBody.model).toBe('gpt-5-nano');
      expect(requestBody.text.format.schema.required).toEqual([
        'decision',
        'reason',
        'normalized_content',
        'suggested_scope',
        'suggested_tags',
        'confidence',
        'importance',
      ]);
    });
  });
});
