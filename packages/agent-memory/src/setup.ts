import { DatabaseSync } from 'node:sqlite';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getResolvedOpenAIApiKey } from './openai.js';
import { resetMemoryReady } from './runtime.js';
import { getGlobalMemoryRoot } from './scope.js';

export interface SetupResult {
  scope: 'project' | 'global';
  project_path: string;
  memory_dir: string;
  memories_dir: string;
  embeddings_dir: string;
  graph_dir: string;
  db_path: string;
  gitignore_path: string | null;
  gitignore_updated: boolean;
  semantic_search_enabled: boolean;
}

function ensureDatabase(dbPath: string): void {
  const db = new DatabaseSync(dbPath);
  db.prepare(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      layer TEXT NOT NULL DEFAULT 'deep',
      ref TEXT DEFAULT NULL,
      hash TEXT DEFAULT NULL,
      embedding TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
  db.prepare(`
    CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
      content,
      tags,
      content='entries',
      content_rowid='rowid'
    )
  `).run();
  db.close();
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

export function setupProjectMemory(): SetupResult {
  const projectPath = process.cwd();
  const memoryDir = path.join(projectPath, '.memory');
  const memoriesDir = path.join(memoryDir, 'memories');
  const embeddingsDir = path.join(memoryDir, 'embeddings');
  const graphDir = path.join(memoryDir, 'graph');
  const dbPath = path.join(memoryDir, 'memory.db');

  mkdirSync(memoriesDir, { recursive: true });
  mkdirSync(embeddingsDir, { recursive: true });
  mkdirSync(graphDir, { recursive: true });
  ensureDatabase(dbPath);

  const { gitignorePath, updated } = updateGitignore(projectPath);
  resetMemoryReady('project', projectPath);

  const { apiKey } = getResolvedOpenAIApiKey();
  return {
    scope: 'project',
    project_path: projectPath,
    memory_dir: memoryDir,
    memories_dir: memoriesDir,
    embeddings_dir: embeddingsDir,
    graph_dir: graphDir,
    db_path: dbPath,
    gitignore_path: gitignorePath,
    gitignore_updated: updated,
    semantic_search_enabled: Boolean(apiKey),
  };
}

export function setupGlobalMemory(): SetupResult {
  const memoryDir = getGlobalMemoryRoot();
  const memoriesDir = path.join(memoryDir, 'memories');
  const embeddingsDir = path.join(memoryDir, 'embeddings');
  const graphDir = path.join(memoryDir, 'graph');
  const dbPath = path.join(memoryDir, 'memory.db');

  mkdirSync(memoriesDir, { recursive: true });
  mkdirSync(embeddingsDir, { recursive: true });
  mkdirSync(graphDir, { recursive: true });
  ensureDatabase(dbPath);
  resetMemoryReady('global');

  const { apiKey } = getResolvedOpenAIApiKey();
  return {
    scope: 'global',
    project_path: memoryDir,
    memory_dir: memoryDir,
    memories_dir: memoriesDir,
    embeddings_dir: embeddingsDir,
    graph_dir: graphDir,
    db_path: dbPath,
    gitignore_path: null,
    gitignore_updated: false,
    semantic_search_enabled: Boolean(apiKey),
  };
}
