import { existsSync, unlinkSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { getMemoryDir } from '../files.js';
import type { MemoryScope } from '../scope.js';
import { ensureSchema } from './schema.js';

let dbInstance: DatabaseSync | null = null;
let dbInstancePath: string | null = null;

export function getDbPath(scope: MemoryScope = 'project'): string {
  return path.join(getMemoryDir(scope), 'memory.db');
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbInstancePath = null;
  }
}

export function resetDbCacheFiles(scope: MemoryScope = 'project'): void {
  const dbPath = getDbPath(scope);
  if (dbInstancePath === dbPath) {
    closeDb();
  }

  for (const suffix of ['', '-shm', '-wal']) {
    const target = `${dbPath}${suffix}`;
    if (existsSync(target)) {
      unlinkSync(target);
    }
  }
}

export function getDb(scope: MemoryScope = 'project'): DatabaseSync {
  const currentDbPath = getDbPath(scope);

  if (dbInstance && dbInstancePath === currentDbPath) {
    return dbInstance;
  }

  if (dbInstance && dbInstancePath !== currentDbPath) {
    closeDb();
  }

  getMemoryDir(scope);
  dbInstance = new DatabaseSync(currentDbPath);
  dbInstancePath = currentDbPath;
  dbInstance.prepare('PRAGMA journal_mode = WAL').run();
  ensureSchema(dbInstance);
  return dbInstance;
}
