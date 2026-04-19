import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('legacy migration behavior', () => {
  test('migrates legacy JSON entries into split file layout with normalized ids', async () => {
    const result = runHarness('legacy-json');
    expect(result.memoryFiles).toEqual([
      'pointe_legacy_minio_workflow.md',
      'qrpwic_legacy_minio_workflow.md',
    ]);
    expect(result.embeddingFiles).toEqual([
      'pointe_legacy_minio_workflow.embeddings',
      'qrpwic_legacy_minio_workflow.embeddings',
    ]);
    expect(result.migrated).toEqual(
      expect.objectContaining({
        id: 'qrpwic',
        file_name: 'qrpwic_legacy_minio_workflow',
        content: 'Legacy MinIO workflow stored in JSON format',
      })
    );
    expect(result.migratedPointer).toEqual(
      expect.objectContaining({
        id: 'pointe',
        file_name: 'pointe_legacy_minio_workflow',
        ref: 'qrpwic',
        content: '[→ qrpwic] Legacy MinIO workflow',
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
