import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { isSemanticSearchEnabled } from './model-provider.js';
import { updateProjectMemoryGitignore } from './project-memory-gitignore.js';
import { resetMemoryReady } from './runtime.js';
import { getGlobalMemoryRoot, getMemoryRoot, getProjectRoot, withProjectRoot } from './scope.js';
import { getDb } from './db.js';

export interface SetupResult {
  scope: 'project' | 'global';
  project_path: string;
  memory_dir: string;
  memories_dir: string;
  index_dir: string;
  embeddings_dir: string;
  graph_dir: string;
  db_path: string;
  gitignore_path: string | null;
  gitignore_updated: boolean;
  semantic_search_enabled: boolean;
}

export function setupProjectMemory(projectPath?: string): SetupResult {
  const resolvedProjectPath = getProjectRoot(projectPath);
  return withProjectRoot(resolvedProjectPath, () => {
    const memoryDir = getMemoryRoot('project', resolvedProjectPath);
    const memoriesDir = path.join(memoryDir, 'memories');
    const indexDir = path.join(memoryDir, 'index');
    const embeddingsDir = path.join(memoryDir, 'embeddings');
    const graphDir = path.join(memoryDir, 'graph');
    const dbPath = path.join(memoryDir, 'memory.db');

    mkdirSync(memoriesDir, { recursive: true });
    mkdirSync(indexDir, { recursive: true });
    mkdirSync(embeddingsDir, { recursive: true });
    mkdirSync(graphDir, { recursive: true });
    getDb('project');

    const { gitignorePath, updated } = updateProjectMemoryGitignore(resolvedProjectPath, memoryDir);
    resetMemoryReady('project', resolvedProjectPath);

    return {
      scope: 'project',
      project_path: resolvedProjectPath,
      memory_dir: memoryDir,
      memories_dir: memoriesDir,
      index_dir: indexDir,
      embeddings_dir: embeddingsDir,
      graph_dir: graphDir,
      db_path: dbPath,
      gitignore_path: gitignorePath,
      gitignore_updated: updated,
      semantic_search_enabled: isSemanticSearchEnabled(),
    };
  });
}

export function setupGlobalMemory(): SetupResult {
  const memoryDir = getGlobalMemoryRoot();
  const memoriesDir = path.join(memoryDir, 'memories');
  const indexDir = path.join(memoryDir, 'index');
  const embeddingsDir = path.join(memoryDir, 'embeddings');
  const graphDir = path.join(memoryDir, 'graph');
  const dbPath = path.join(memoryDir, 'memory.db');

  mkdirSync(memoriesDir, { recursive: true });
  mkdirSync(indexDir, { recursive: true });
  mkdirSync(embeddingsDir, { recursive: true });
  mkdirSync(graphDir, { recursive: true });
  getDb('global');
  resetMemoryReady('global');

  return {
    scope: 'global',
    project_path: memoryDir,
    memory_dir: memoryDir,
    memories_dir: memoriesDir,
    index_dir: indexDir,
    embeddings_dir: embeddingsDir,
    graph_dir: graphDir,
    db_path: dbPath,
    gitignore_path: null,
    gitignore_updated: false,
    semantic_search_enabled: isSemanticSearchEnabled(),
  };
}
