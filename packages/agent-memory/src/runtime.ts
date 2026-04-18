import { existsSync } from 'node:fs';
import path from 'node:path';
import { getDb } from './db.js';
import { getEmbeddingsDir, getGraphDir, getMemoriesDir } from './files.js';
import { rebuildFromFiles } from './rebuild.js';
import type { MemoryScope } from './scope.js';
import { getMemoryRoot } from './scope.js';

export interface MemoryState {
  scope: MemoryScope;
  memory_dir: string;
  current_layout: boolean;
  legacy_json_layout: boolean;
  legacy_db_layout: boolean;
  enabled: boolean;
}

const ensuredRoots = new Set<string>();

export function detectMemoryState(scope: MemoryScope = 'project', projectPath: string = process.cwd()): MemoryState {
  const memoryDir = getMemoryRoot(scope, projectPath);

  const currentLayout =
    existsSync(path.join(memoryDir, 'memories')) ||
    existsSync(path.join(memoryDir, 'embeddings')) ||
    existsSync(path.join(memoryDir, 'graph'));

  const legacyJsonLayout = existsSync(path.join(memoryDir, 'entries'));
  const legacyDbLayout = existsSync(path.join(memoryDir, 'memory.db'));

  return {
    scope,
    memory_dir: memoryDir,
    current_layout: currentLayout,
    legacy_json_layout: legacyJsonLayout,
    legacy_db_layout: legacyDbLayout,
    enabled: currentLayout || legacyJsonLayout || legacyDbLayout,
  };
}

function bootstrapGlobalMemory(): void {
  getMemoriesDir('global');
  getEmbeddingsDir('global');
  getGraphDir('global');
  getDb('global');
}

export function ensureMemoryReady(scope: MemoryScope = 'project'): void {
  const memoryRoot = getMemoryRoot(scope);
  if (ensuredRoots.has(memoryRoot)) {
    return;
  }

  const state = detectMemoryState(scope);
  if (!state.enabled) {
    if (scope === 'global') {
      bootstrapGlobalMemory();
    } else {
      throw new Error('Project memory is not initialized in this repo. Call memory_setup() first.');
    }
  }

  rebuildFromFiles(scope);
  ensuredRoots.add(memoryRoot);
}

export function markMemoryReady(scope: MemoryScope = 'project', projectPath: string = process.cwd()): void {
  ensuredRoots.add(getMemoryRoot(scope, projectPath));
}

export function resetMemoryReady(scope: MemoryScope = 'project', projectPath: string = process.cwd()): void {
  ensuredRoots.delete(getMemoryRoot(scope, projectPath));
}
