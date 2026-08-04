import { describe, expect, test } from '@jest/globals';
import { fetchProviderModels, parseCatalog } from '../dist/cli/model-catalog.js';

describe('provider model catalog', () => {
  test('parses Gateway model capabilities and excludes unavailable models', () => {
    expect(parseCatalog({
      models: [
        { slug: 'visible', visibility: 'list', supported_in_api: true, supported_reasoning_levels: ['low', 'high'] },
        { slug: 'hidden', visibility: 'hidden', supported_in_api: true, supported_reasoning_levels: ['medium'] },
        { slug: 'disabled', visibility: 'list', supported_in_api: false, supported_reasoning_levels: [] },
      ],
    })).toEqual([{ id: 'visible', reasoningEfforts: ['low', 'high'] }]);
  });

  test('loads a standard OpenAI-compatible catalog with authenticated request', async () => {
    const models = await fetchProviderModels({
      provider: {
        driver: 'openai-compatible',
        base_url: 'https://models.test/v1',
        auth: { api_key: 'sk-catalog' },
        headers: { 'X-Provider': 'memory' },
        apis: { responses: { path: '/responses' } },
      },
      fetch: async (url, init) => {
        expect(url).toBe('https://models.test/v1/models');
        expect(init.headers.Authorization).toBe('Bearer sk-catalog');
        expect(init.headers['X-Provider']).toBe('memory');
        return new Response(JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }] }), { status: 200 });
      },
    });
    expect(models).toEqual([
      { id: 'model-a', reasoningEfforts: [] },
      { id: 'model-b', reasoningEfforts: [] },
    ]);
  });
});
