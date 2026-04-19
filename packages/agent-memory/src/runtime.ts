import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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

function updateGitignore(projectPath: string): void {
  const gitignorePath = path.join(projectPath, '.gitignore');
  const dbIgnoreEntry = '.memory/memory.db*';
  const legacyIgnoreEntry = '.memory/';

  if (existsSync(gitignorePath)) {
    const lines = readFileSync(gitignorePath, 'utf8').split('\n');
    const filtered = lines.filter((line) => line.trim() !== legacyIgnoreEntry);
    const hasDbIgnore = filtered.some((line) => line.trim() === dbIgnoreEntry);

    if (!hasDbIgnore) {
      filtered.push(dbIgnoreEntry, '');
      writeFileSync(gitignorePath, filtered.join('\n'), 'utf8');
    }
    return;
  }

  appendFileSync(gitignorePath, `${dbIgnoreEntry}\n`);
}

function bootstrapProjectMemory(projectPath: string = process.cwd()): void {
  const memoryDir = getMemoryRoot('project', projectPath);
  mkdirSync(path.join(memoryDir, 'memories'), { recursive: true });
  mkdirSync(path.join(memoryDir, 'embeddings'), { recursive: true });
  mkdirSync(path.join(memoryDir, 'graph'), { recursive: true });
  ensureDatabase(path.join(memoryDir, 'memory.db'));
  updateGitignore(projectPath);
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

export function markMemoryReady(scope: MemoryScope = 'project', projectPath: string = process.cwd()): void {
  ensuredRoots.add(getMemoryRoot(scope, projectPath));
}

export function resetMemoryReady(scope: MemoryScope = 'project', projectPath: string = process.cwd()): void {
  ensuredRoots.delete(getMemoryRoot(scope, projectPath));
}
