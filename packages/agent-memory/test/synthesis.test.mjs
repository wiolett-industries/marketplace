import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('multi-memory synthesis and recap', () => {
  const result = runHarness('synthesis');

  test('query synthesis receives the original query and multiple ranked memories', () => {
    const input = JSON.parse(result.responseRequest.input);
    expect(result.responseRequest.model).toBe('gpt-5.6-luna');
    expect(result.responseRequest.reasoning).toEqual({ effort: 'medium' });
    expect(input.query).toBe('deploy health release');
    expect(input.memories.map((item) => item.memory.id)).toEqual(
      expect.arrayContaining([result.ids.first, result.ids.second]),
    );
    expect(result.query.answer).toContain('release build');
    expect(result.query.sources.map((source) => source.id)).toEqual(
      expect.arrayContaining([result.ids.first, result.ids.second]),
    );
  });

  test('recap compiles multiple current memories without a topic', () => {
    expect(result.recap.answer).toContain(result.ids.first);
    expect(result.recap.answer).toContain(result.ids.second);
    expect(result.recap.sources.map((source) => source.id)).toEqual(
      expect.arrayContaining([result.ids.first, result.ids.second]),
    );
  });
});
