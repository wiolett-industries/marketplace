import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('agent-memory config behavior', () => {
  test('does not persist unresolved OPENAI_API_KEY placeholders over a real stored key', async () => {
    const result = runHarness('config');
    expect(result.persisted.persisted).toBe(true);
    expect(result.resolvedAfterEnv).toEqual({
      apiKey: 'sk-test-env-value',
      source: 'stored',
    });
    expect(result.resolvedAfterManual).toEqual({
      apiKey: 'sk-test-manual',
      source: 'stored',
    });
    expect(result.placeholderPersisted).toEqual({
      persisted: false,
      configPath: null,
    });
    expect(result.resolvedAfterPlaceholder).toEqual({
      apiKey: 'sk-test-manual',
      source: 'stored',
    });
    expect(result.fileContents.openaiApiKey).toBe('sk-test-manual');
  });
});
