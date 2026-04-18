import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('global memory operations', () => {
  test('auto-initializes global memory and keeps it separate from project memory', async () => {
    const result = runHarness('global');
    expect(result.initialProjectState.enabled).toBe(false);
    expect(result.initialGlobalState.enabled).toBe(false);
    expect(result.finalGlobalState.enabled).toBe(true);
    expect(result.projectMemoryDirCreated).toBe(false);
    expect(result.globalMemoryFiles).toHaveLength(3);
    expect(result.globalEmbeddingFiles).toHaveLength(3);
    expect(result.globalReadLite).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ref: result.ids.deep, content: expect.stringContaining(`[→ ${result.ids.deep}]`) }),
        expect.objectContaining({ id: result.ids.lite, ref: null }),
      ])
    );
    expect(result.globalSearch[0]).toEqual(expect.objectContaining({ id: result.ids.deep }));
    expect(result.globalEntry).toEqual(expect.objectContaining({ id: result.ids.deep, layer: 'deep' }));
    expect(result.globalReadAll).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: result.ids.deep, layer: 'deep' }),
        expect.objectContaining({ id: result.ids.lite, layer: 'lite' }),
      ])
    );
  });
});
