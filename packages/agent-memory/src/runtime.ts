import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { getDb } from './db.js';
import { getEmbeddingsDir, getGraphDir, getIndexDir, getMemoriesDir } from './files.js';
import { updateProjectMemoryGitignore } from './project-memory-gitignore.js';
import { rebuildFromFiles } from './rebuild.js';
import type { MemoryScope } from './scope.js';
import { getMemoryRoot, getProjectRoot, withProjectRoot } from './scope.js';

export interface MemoryState {
  scope: MemoryScope;
  memory_dir: string;
  current_layout: boolean;
  legacy_json_layout: boolean;
  legacy_db_layout: boolean;
  enabled: boolean;
}

const ensuredRoots = new Set<string>();

export function detectMemoryState(scope: MemoryScope = 'project', projectPath?: string): MemoryState {
  const memoryDir = getMemoryRoot(scope, projectPath);

  const currentLayout =
    existsSync(path.join(memoryDir, 'memories')) ||
    existsSync(path.join(memoryDir, 'index')) ||
    existsSync(path.join(memoryDir, 'embeddings')) ||
    existsSync(path.join(memoryDir, 'graph'));

  const legacyJsonLayout = existsSync(path.join(memoryDir, 'entries'));
  const legacyDbLayout = existsSync(path.join(memoryDir, 'memory.db')) && !currentLayout;

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
  getIndexDir('global');
  getEmbeddingsDir('global');
  getGraphDir('global');
  getDb('global');
}

function bootstrapProjectMemory(projectPath?: string): void {
  const resolvedProjectPath = getProjectRoot(projectPath);
  withProjectRoot(resolvedProjectPath, () => {
    const memoryDir = getMemoryRoot('project', resolvedProjectPath);
    mkdirSync(path.join(memoryDir, 'memories'), { recursive: true });
    mkdirSync(path.join(memoryDir, 'index'), { recursive: true });
    mkdirSync(path.join(memoryDir, 'embeddings'), { recursive: true });
    mkdirSync(path.join(memoryDir, 'graph'), { recursive: true });
    getDb('project');
    updateProjectMemoryGitignore(resolvedProjectPath, memoryDir);
  });
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
      bootstrapProjectMemory();
    }
  }

  rebuildFromFiles(scope);
  ensuredRoots.add(memoryRoot);
}

export function ensureMemoryReadable(scope: MemoryScope = 'project'): boolean {
  const memoryRoot = getMemoryRoot(scope);
  if (ensuredRoots.has(memoryRoot)) {
    return true;
  }

  const state = detectMemoryState(scope);
  if (!state.enabled) {
    return false;
  }

  rebuildFromFiles(scope);
  ensuredRoots.add(memoryRoot);
  return true;
}

export function markMemoryReady(scope: MemoryScope = 'project', projectPath?: string): void {
  ensuredRoots.add(getMemoryRoot(scope, projectPath));
}

export function resetMemoryReady(scope: MemoryScope = 'project', projectPath?: string): void {
  ensuredRoots.delete(getMemoryRoot(scope, projectPath));
}
