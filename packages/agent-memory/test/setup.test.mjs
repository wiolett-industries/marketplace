import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('setupProjectMemory', () => {
  test('creates memory directories, db, and gitignore entry', async () => {
    const result = runHarness('setup');
    expect(result.setup.project_path).toMatch(/pm-setup/);
    expect(result.setup.memories_dir).toContain('/.memory/memories');
    expect(result.setup.embeddings_dir).toContain('/.memory/embeddings');
    expect(result.setup.graph_dir).toContain('/.memory/graph');
    expect(result.setup.db_path).toContain('/.memory/memory.db');
    expect(result.idempotent.same_db_path).toBe(true);
    expect(result.idempotent.gitignore_entries).toBe(1);
  });
});
