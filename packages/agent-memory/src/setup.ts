import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isSemanticSearchEnabled } from './model-provider.js';
import { resetMemoryReady } from './runtime.js';
import { getGlobalMemoryRoot, getProjectRoot } from './scope.js';
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

function updateGitignore(projectPath: string): { gitignorePath: string; updated: boolean } {
  const gitignorePath = path.join(projectPath, '.gitignore');
  const dbIgnoreEntry = '.memory/memory.db*';
  const legacyIgnoreEntry = '.memory/';

  if (existsSync(gitignorePath)) {
    const lines = readFileSync(gitignorePath, 'utf8').split('\n');
    const filtered = lines.filter((line) => line.trim() !== legacyIgnoreEntry);
    const hasDbIgnore = filtered.some((line) => line.trim() === dbIgnoreEntry);

    if (hasDbIgnore) {
      return { gitignorePath, updated: false };
    }

    filtered.push(dbIgnoreEntry, '');
    writeFileSync(gitignorePath, filtered.join('\n'), 'utf8');
    return { gitignorePath, updated: true };
  }

  appendFileSync(gitignorePath, `${dbIgnoreEntry}\n`);
  return { gitignorePath, updated: true };
}

export function setupProjectMemory(projectPath?: string): SetupResult {
  const resolvedProjectPath = getProjectRoot(projectPath);
  const memoryDir = path.join(resolvedProjectPath, '.memory');
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

  const { gitignorePath, updated } = updateGitignore(resolvedProjectPath);
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
