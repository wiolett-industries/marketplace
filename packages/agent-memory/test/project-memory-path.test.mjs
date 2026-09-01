import path from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('configured project memory paths', () => {
  test('memory_setup uses a configured repository-relative root and repairs its gitignore contract', () => {
    const result = runHarness('setup-custom-relative');

    expect(result.first.memory_dir).toBe(result.memory_root);
    expect(result.first.db_path).toBe(path.join(result.memory_root, 'memory.db'));
    expect(result.first.gitignore_updated).toBe(true);
    expect(result.second.gitignore_updated).toBe(false);
    expect(result.directories).toEqual({ memories: true, index: true, embeddings: true, graph: true, default_root: false });
    expect(result.gitignore).toContain('keep-me');
    expect(result.gitignore).not.toMatch(/^var\/agent-memory\/$/m);
    expect(result.gitignore.match(/^var\/agent-memory\/memory\.db\*$/gm)).toHaveLength(1);
  });

  test('memory_setup supports an absolute root outside the repository without creating a gitignore', () => {
    const result = runHarness('setup-custom-external');

    expect(result.setup.memory_dir).toBe(result.external_memory_root);
    expect(result.setup.db_path).toBe(path.join(result.external_memory_root, 'memory.db'));
    expect(result.setup.gitignore_path).toBeNull();
    expect(result.setup.gitignore_updated).toBe(false);
    expect(result.memories_created).toBe(true);
    expect(result.gitignore_created).toBe(false);
    expect(result.default_root_created).toBe(false);
  });

  test('automatic write initialization uses the same configured root and cache ignore', () => {
    const result = runHarness('runtime-custom-relative');

    expect(result.memories_created).toBe(true);
    expect(result.gitignore).toContain('state/memory/memory.db*');
    expect(result.default_root_created).toBe(false);
  });
});
