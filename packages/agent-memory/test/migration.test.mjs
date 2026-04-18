import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('legacy migration behavior', () => {
  test('migrates legacy JSON entries into split file layout', async () => {
    const result = runHarness('legacy-json');
    expect(result.memoryFiles).toEqual(['abc123_legacy_minio_workflow.md']);
    expect(result.embeddingFiles).toEqual(['abc123_legacy_minio_workflow.embeddings']);
    expect(result.migrated).toEqual(
      expect.objectContaining({
        id: 'abc123',
        file_name: 'abc123_legacy_minio_workflow',
        content: 'Legacy MinIO workflow stored in JSON format',
      })
    );
  });

  test('drops DB-only legacy cache instead of migrating it', async () => {
    const result = runHarness('legacy-db');
    expect(result.memoryFiles).toEqual([]);
    expect(result.embeddingFiles).toEqual([]);
    expect(result.migrated).toBeNull();
    expect(result.state.enabled).toBe(true);
  });
});
