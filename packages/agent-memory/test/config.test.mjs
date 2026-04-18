import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('agent-memory config storage', () => {
  test('persists OpenAI keys and falls back to stored config when env is absent', async () => {
    const result = runHarness('config');
    expect(result.configPath).toContain('/agent-memory/config.json');
    expect(result.persisted).toEqual(
      expect.objectContaining({
        persisted: true,
        configPath: result.configPath,
      })
    );
    expect(result.resolvedAfterEnv).toEqual({
      apiKey: 'sk-test-env-value',
      source: 'stored',
    });
    expect(result.storedPath).toBe(result.configPath);
    expect(result.fileContents.openaiApiKey).toBe('sk-test-manual');
    expect(result.resolvedAfterManual).toEqual({
      apiKey: 'sk-test-manual',
      source: 'stored',
    });
  });
});
