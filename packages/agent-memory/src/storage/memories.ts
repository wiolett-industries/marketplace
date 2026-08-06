import type { EntryRecord, EntryRow } from '../entry.js';
import { parseEntryRow } from '../entry.js';
import type { MemoryScope } from '../scope.js';
import { getDb } from './connection.js';

export interface SearchRow {
  id: string;
  rank: number;
}

function toMemoryRow(row: Omit<EntryRow, 'layer' | 'ref'>): EntryRow {
  return {
    ...row,
    layer: 'deep',
    ref: null,
  };
}

export function upsertMemory(entry: EntryRecord, hash: string, scope: MemoryScope = 'project'): void {
  const db = getDb(scope);
  const existing = db.prepare('SELECT id FROM memories WHERE id = ?').get(entry.id) as { id: string } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE memories
      SET file_name = ?, content = ?, tags = ?, source = ?, confidence = ?, importance = ?, hash = ?, embedding = ?, updated_at = ?
      WHERE id = ?
    `).run(
      entry.file_name,
      entry.content,
      JSON.stringify(entry.tags),
      entry.source ?? 'model_inferred',
      entry.confidence ?? 0.5,
      entry.importance ?? 0.5,
      hash,
      JSON.stringify(entry.embedding),
      entry.updated_at,
      entry.id
    );
    return;
  }

  db.prepare(`
    INSERT INTO memories
      (id, file_name, content, tags, source, confidence, importance, hash, embedding, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id,
    entry.file_name,
    entry.content,
    JSON.stringify(entry.tags),
    entry.source ?? 'model_inferred',
    entry.confidence ?? 0.5,
    entry.importance ?? 0.5,
    hash,
    JSON.stringify(entry.embedding),
    entry.created_at,
    entry.updated_at
  );
}

export function getMemoryById(id: string, scope: MemoryScope = 'project'): EntryRecord | null {
  const row = getDb(scope).prepare('SELECT * FROM memories WHERE id = ?').get(id) as Omit<EntryRow, 'layer' | 'ref'> | undefined;
  return row ? parseEntryRow(toMemoryRow(row)) : null;
}

export function getMemoryHash(id: string, scope: MemoryScope = 'project'): string | null {
  const row = getDb(scope).prepare('SELECT hash FROM memories WHERE id = ?').get(id) as { hash: string | null } | undefined;
  return row?.hash ?? null;
}

export function deleteMemory(id: string, scope: MemoryScope = 'project'): boolean {
  const result = getDb(scope).prepare('DELETE FROM memories WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}

export function getAllMemoryIds(scope: MemoryScope = 'project'): string[] {
  const rows = getDb(scope).prepare('SELECT id FROM memories').all() as { id: string }[];
  return rows.map((row) => row.id);
}

export function getDeepEntries(scope: MemoryScope = 'project'): EntryRecord[] {
  const rows = getDb(scope)
    .prepare('SELECT * FROM memories ORDER BY updated_at DESC')
    .all() as Array<Omit<EntryRow, 'layer' | 'ref'>>;
  return rows.map((row) => parseEntryRow(toMemoryRow(row)));
}

export function searchMemoriesFTS(query: string, scope: MemoryScope = 'project'): Map<string, number> {
  const database = getDb(scope);
  const ftsTable = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'memories_fts'")
    .get() as { name: string } | undefined;
  if (!ftsTable) return new Map();

  const rows = database
    .prepare(`
      SELECT m.id, bm25(memories_fts, 10.0, 5.0) AS rank
      FROM memories_fts
      JOIN memories m ON m.rowid = memories_fts.rowid
      WHERE memories_fts MATCH ?
      ORDER BY rank
    `)
    .all(query) as unknown as SearchRow[];

  const scores = new Map<string, number>();
  for (const row of rows) {
    scores.set(row.id, 1 / (1 + Math.max(row.rank, 0)));
  }
  return scores;
}
