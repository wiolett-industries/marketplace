import type { EntryRecord, EntryRow } from '../entry.js';
import { parseEntryRow } from '../entry.js';
import type { MemoryScope } from '../scope.js';
import { getDb } from './connection.js';

function toIndexRow(row: Omit<EntryRow, 'layer' | 'ref' | 'embedding'> & { memory_id: string | null }): EntryRow {
  return {
    ...row,
    layer: 'lite',
    ref: row.memory_id,
    embedding: '[]',
  };
}

export function upsertIndexEntry(entry: EntryRecord, scope: MemoryScope = 'project'): void {
  const db = getDb(scope);
  const existing = db.prepare('SELECT id FROM memory_index WHERE id = ?').get(entry.id) as { id: string } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE memory_index
      SET memory_id = ?, file_name = ?, content = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(entry.ref, entry.file_name, entry.content, JSON.stringify(entry.tags), entry.updated_at, entry.id);
    return;
  }

  db.prepare(`
    INSERT INTO memory_index (id, memory_id, file_name, content, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(entry.id, entry.ref, entry.file_name, entry.content, JSON.stringify(entry.tags), entry.created_at, entry.updated_at);
}

export function getIndexById(id: string, scope: MemoryScope = 'project'): EntryRecord | null {
  const row = getDb(scope)
    .prepare('SELECT id, memory_id, file_name, content, tags, created_at, updated_at FROM memory_index WHERE id = ?')
    .get(id) as (Omit<EntryRow, 'layer' | 'ref' | 'embedding'> & { memory_id: string | null }) | undefined;
  return row ? parseEntryRow(toIndexRow(row)) : null;
}

export function getIndexByMemoryId(memoryId: string, scope: MemoryScope = 'project'): EntryRecord | null {
  const row = getDb(scope)
    .prepare('SELECT id, memory_id, file_name, content, tags, created_at, updated_at FROM memory_index WHERE memory_id = ?')
    .get(memoryId) as (Omit<EntryRow, 'layer' | 'ref' | 'embedding'> & { memory_id: string | null }) | undefined;
  return row ? parseEntryRow(toIndexRow(row)) : null;
}

export function getLiteEntries(scope: MemoryScope = 'project'): EntryRecord[] {
  const rows = getDb(scope)
    .prepare('SELECT id, memory_id, file_name, content, tags, created_at, updated_at FROM memory_index ORDER BY updated_at DESC')
    .all() as Array<Omit<EntryRow, 'layer' | 'ref' | 'embedding'> & { memory_id: string | null }>;
  return rows.map((row) => parseEntryRow(toIndexRow(row)));
}

export function deleteIndexById(id: string, scope: MemoryScope = 'project'): boolean {
  const result = getDb(scope).prepare('DELETE FROM memory_index WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}

export function deleteIndexForMemory(memoryId: string, scope: MemoryScope = 'project'): void {
  getDb(scope).prepare('DELETE FROM memory_index WHERE memory_id = ?').run(memoryId);
}
