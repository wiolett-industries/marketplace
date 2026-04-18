import { existsSync, unlinkSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { getMemoryDir } from './files.js';
import type { EntryLayer, EntryRecord, EntryRow } from './entry.js';
import { parseEntryRow } from './entry.js';
import type { GraphDirection, GraphEdgeRecord, GraphEdgeSummary, GraphRelation } from './graph.js';
import type { MemoryScope } from './scope.js';

interface SearchRow {
  id: string;
  rank: number;
}

interface GraphEdgeSummaryRow {
  id: string;
  file_name: string;
  relation: string;
  weight: number;
  reason: string | null;
}

let dbInstance: DatabaseSync | null = null;
let dbInstancePath: string | null = null;

export function getDbPath(scope: MemoryScope = 'project'): string {
  return path.join(getMemoryDir(scope), 'memory.db');
}

function run(database: DatabaseSync, sql: string): void {
  database.prepare(sql).run();
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

  run(
    dbInstance,
    `
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        file_name TEXT DEFAULT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        layer TEXT NOT NULL DEFAULT 'deep',
        ref TEXT DEFAULT NULL,
        hash TEXT DEFAULT NULL,
        embedding TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `
  );

  run(
    dbInstance,
    `
      CREATE TABLE IF NOT EXISTS memory_edges (
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        weight REAL NOT NULL,
        reason TEXT DEFAULT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (from_id, to_id, relation)
      )
    `
  );

  run(
    dbInstance,
    'CREATE INDEX IF NOT EXISTS memory_edges_from_idx ON memory_edges (from_id)'
  );

  run(
    dbInstance,
    'CREATE INDEX IF NOT EXISTS memory_edges_to_idx ON memory_edges (to_id)'
  );

  const columns = dbInstance.prepare('PRAGMA table_info(entries)').all() as { name: string }[];
  if (!columns.some((column) => column.name === 'file_name')) {
    run(dbInstance, 'ALTER TABLE entries ADD COLUMN file_name TEXT DEFAULT NULL');
  }
  if (!columns.some((column) => column.name === 'ref')) {
    run(dbInstance, 'ALTER TABLE entries ADD COLUMN ref TEXT DEFAULT NULL');
  }
  if (!columns.some((column) => column.name === 'hash')) {
    run(dbInstance, 'ALTER TABLE entries ADD COLUMN hash TEXT DEFAULT NULL');
  }

  dbInstance.prepare("UPDATE entries SET layer = 'lite' WHERE layer = 'light'").run();

  run(
    dbInstance,
    `
      CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
        content,
        tags,
        content='entries',
        content_rowid='rowid'
      )
    `
  );

  run(
    dbInstance,
    `
      CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
        INSERT INTO entries_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
      END
    `
  );

  run(
    dbInstance,
    `
      CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
        INSERT INTO entries_fts(entries_fts, rowid, content, tags) VALUES ('delete', old.rowid, old.content, old.tags);
      END
    `
  );

  run(
    dbInstance,
    `
      CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
        INSERT INTO entries_fts(entries_fts, rowid, content, tags) VALUES ('delete', old.rowid, old.content, old.tags);
        INSERT INTO entries_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
      END
    `
  );

  return dbInstance;
}

export function upsertEntry(entry: EntryRecord, hash: string, scope: MemoryScope = 'project'): void {
  const db = getDb(scope);
  const existing = db.prepare('SELECT id FROM entries WHERE id = ?').get(entry.id) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `
        UPDATE entries
        SET file_name = ?, content = ?, tags = ?, layer = ?, ref = ?, hash = ?, embedding = ?, updated_at = ?
        WHERE id = ?
      `
    ).run(
      entry.file_name,
      entry.content,
      JSON.stringify(entry.tags),
      entry.layer,
      entry.ref,
      hash,
      JSON.stringify(entry.embedding),
      entry.updated_at,
      entry.id
    );
    return;
  }

  db.prepare(
    `
      INSERT INTO entries (id, file_name, content, tags, layer, ref, hash, embedding, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    entry.id,
    entry.file_name,
    entry.content,
    JSON.stringify(entry.tags),
    entry.layer,
    entry.ref,
    hash,
    JSON.stringify(entry.embedding),
    entry.created_at,
    entry.updated_at
  );
}

export function getEntryById(id: string, scope: MemoryScope = 'project'): EntryRecord | null {
  const row = getDb(scope).prepare('SELECT * FROM entries WHERE id = ?').get(id) as EntryRow | undefined;
  return row ? parseEntryRow(row) : null;
}

export function getEntryHash(id: string, scope: MemoryScope = 'project'): string | null {
  const row = getDb(scope).prepare('SELECT hash FROM entries WHERE id = ?').get(id) as { hash: string | null } | undefined;
  return row?.hash ?? null;
}

export function getPointerByRef(ref: string, scope: MemoryScope = 'project'): EntryRecord | null {
  const row = getDb(scope).prepare("SELECT * FROM entries WHERE layer = 'lite' AND ref = ?").get(ref) as EntryRow | undefined;
  return row ? parseEntryRow(row) : null;
}

export function deleteEntryFromDb(id: string, scope: MemoryScope = 'project'): boolean {
  const db = getDb(scope);
  db.prepare('DELETE FROM entries WHERE ref = ?').run(id);
  const result = db.prepare('DELETE FROM entries WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}

export function getAllDbIds(scope: MemoryScope = 'project'): string[] {
  const rows = getDb(scope).prepare('SELECT id FROM entries').all() as { id: string }[];
  return rows.map((row) => row.id);
}

export function replaceOutgoingEdges(fromId: string, edges: GraphEdgeRecord[], scope: MemoryScope = 'project'): void {
  const db = getDb(scope);
  db.prepare('DELETE FROM memory_edges WHERE from_id = ?').run(fromId);

  const insert = db.prepare(
    `
      INSERT INTO memory_edges (from_id, to_id, relation, weight, reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  );

  for (const edge of edges) {
    insert.run(
      edge.from_id,
      edge.to_id,
      edge.relation,
      edge.weight,
      edge.reason,
      edge.created_at,
      edge.updated_at
    );
  }
}

export function deleteEdgesForEntry(id: string, scope: MemoryScope = 'project'): void {
  const db = getDb(scope);
  db.prepare('DELETE FROM memory_edges WHERE from_id = ? OR to_id = ?').run(id, id);
}

export function getOutgoingEdgeRecords(fromId: string, scope: MemoryScope = 'project'): GraphEdgeRecord[] {
  return getDb(scope)
    .prepare(
      `
        SELECT from_id, to_id, relation, weight, reason, created_at, updated_at
        FROM memory_edges
        WHERE from_id = ?
        ORDER BY weight DESC, updated_at DESC, to_id ASC
      `
    )
    .all(fromId) as unknown as GraphEdgeRecord[];
}

export function getAllEdgeRows(scope: MemoryScope = 'project'): GraphEdgeRecord[] {
  return getDb(scope)
    .prepare(
      `
        SELECT from_id, to_id, relation, weight, reason, created_at, updated_at
        FROM memory_edges
      `
    )
    .all() as unknown as GraphEdgeRecord[];
}

export function getEntries(layer: EntryLayer, scope: MemoryScope = 'project'): EntryRecord[] {
  const rows = getDb(scope)
    .prepare('SELECT * FROM entries WHERE layer = ? ORDER BY updated_at DESC')
    .all(layer) as unknown as EntryRow[];

  return rows.map(parseEntryRow);
}

export function getLiteEntries(scope: MemoryScope = 'project'): EntryRecord[] {
  return getEntries('lite', scope);
}

export function getDeepEntries(scope: MemoryScope = 'project'): EntryRecord[] {
  return getEntries('deep', scope);
}

export function getAllEntries(scope: MemoryScope = 'project'): Omit<EntryRecord, 'embedding'>[] {
  const rows = getDb(scope).prepare('SELECT * FROM entries ORDER BY updated_at DESC').all() as unknown as EntryRow[];
  return rows.map((row) => {
    const entry = parseEntryRow(row);
    const { embedding: _embedding, ...rest } = entry;
    return rest;
  });
}

export function getEdgeSummaries(id: string, scope: MemoryScope = 'project'): { outgoing: GraphEdgeSummary[]; incoming: GraphEdgeSummary[] } {
  const db = getDb(scope);

  const outgoingRows = db.prepare(
    `
      SELECT e.id, e.file_name, me.relation, me.weight, me.reason
      FROM memory_edges me
      JOIN entries e ON e.id = me.to_id
      WHERE me.from_id = ?
      ORDER BY me.weight DESC, me.updated_at DESC, e.file_name ASC
    `
  ).all(id) as unknown as GraphEdgeSummaryRow[];

  const incomingRows = db.prepare(
    `
      SELECT e.id, e.file_name, me.relation, me.weight, me.reason
      FROM memory_edges me
      JOIN entries e ON e.id = me.from_id
      WHERE me.to_id = ?
      ORDER BY me.weight DESC, me.updated_at DESC, e.file_name ASC
    `
  ).all(id) as unknown as GraphEdgeSummaryRow[];

  return {
    outgoing: outgoingRows.map((row) => ({
      id: row.id,
      file_name: row.file_name,
      relation: row.relation as GraphRelation,
      weight: row.weight,
      reason: row.reason,
      direction: 'outgoing' as const,
    })),
    incoming: incomingRows.map((row) => ({
      id: row.id,
      file_name: row.file_name,
      relation: row.relation as GraphRelation,
      weight: row.weight,
      reason: row.reason,
      direction: 'incoming' as const,
    })),
  };
}

export function getNeighborSummaries(args: {
  id: string;
  direction: GraphDirection;
  relations?: GraphRelation[];
  minWeight: number;
  limit: number;
  scope?: MemoryScope;
}): GraphEdgeSummary[] {
  const db = getDb(args.scope);
  const conditions: string[] = ['me.weight >= ?'];
  const params: Array<string | number> = [args.minWeight];

  if (args.relations && args.relations.length > 0) {
    conditions.push(`me.relation IN (${args.relations.map(() => '?').join(', ')})`);
    params.push(...args.relations);
  }

  const where = conditions.join(' AND ');
  const limit = Math.max(1, args.limit);
  const summaries: GraphEdgeSummary[] = [];

  if (args.direction === 'outgoing' || args.direction === 'both') {
    const rows = db.prepare(
      `
        SELECT e.id, e.file_name, me.relation, me.weight, me.reason
        FROM memory_edges me
        JOIN entries e ON e.id = me.to_id
        WHERE me.from_id = ? AND ${where}
        ORDER BY me.weight DESC, me.updated_at DESC, e.file_name ASC
        LIMIT ?
      `
    ).all(args.id, ...params, limit) as unknown as GraphEdgeSummaryRow[];

    summaries.push(
      ...rows.map((row) => ({
        id: row.id,
        file_name: row.file_name,
        relation: row.relation as GraphRelation,
        weight: row.weight,
        reason: row.reason,
        direction: 'outgoing' as const,
      }))
    );
  }

  if (args.direction === 'incoming' || args.direction === 'both') {
    const rows = db.prepare(
      `
        SELECT e.id, e.file_name, me.relation, me.weight, me.reason
        FROM memory_edges me
        JOIN entries e ON e.id = me.from_id
        WHERE me.to_id = ? AND ${where}
        ORDER BY me.weight DESC, me.updated_at DESC, e.file_name ASC
        LIMIT ?
      `
    ).all(args.id, ...params, limit) as unknown as GraphEdgeSummaryRow[];

    summaries.push(
      ...rows.map((row) => ({
        id: row.id,
        file_name: row.file_name,
        relation: row.relation as GraphRelation,
        weight: row.weight,
        reason: row.reason,
        direction: 'incoming' as const,
      }))
    );
  }

  return summaries
    .sort((left, right) => right.weight - left.weight || left.file_name.localeCompare(right.file_name))
    .slice(0, limit);
}

export function getFilteredEdgeRows(args: {
  ids: string[];
  direction: GraphDirection;
  relations?: GraphRelation[];
  minWeight: number;
  scope?: MemoryScope;
}): GraphEdgeRecord[] {
  if (args.ids.length === 0) {
    return [];
  }

  const filters: string[] = ['weight >= ?'];
  const filterParams: Array<string | number> = [args.minWeight];

  if (args.relations && args.relations.length > 0) {
    filters.push(`relation IN (${args.relations.map(() => '?').join(', ')})`);
    filterParams.push(...args.relations);
  }

  const idPlaceholders = args.ids.map(() => '?').join(', ');
  let directionClause = '';
  const directionParams: Array<string | number> = [];

  if (args.direction === 'outgoing') {
    directionClause = `from_id IN (${idPlaceholders})`;
    directionParams.push(...args.ids);
  } else if (args.direction === 'incoming') {
    directionClause = `to_id IN (${idPlaceholders})`;
    directionParams.push(...args.ids);
  } else {
    directionClause = `(from_id IN (${idPlaceholders}) OR to_id IN (${idPlaceholders}))`;
    directionParams.push(...args.ids, ...args.ids);
  }

  return getDb(args.scope)
    .prepare(
      `
        SELECT from_id, to_id, relation, weight, reason, created_at, updated_at
        FROM memory_edges
        WHERE ${directionClause} AND ${filters.join(' AND ')}
      `
    )
    .all(...directionParams, ...filterParams) as unknown as GraphEdgeRecord[];
}

export function getAllRows(scope: MemoryScope = 'project'): EntryRow[] {
  return getDb(scope).prepare('SELECT * FROM entries').all() as unknown as EntryRow[];
}

export function searchFTS(query: string, layer: EntryLayer = 'deep', scope: MemoryScope = 'project'): Map<string, number> {
  const rows = getDb(scope)
    .prepare(
      `
        SELECT e.id, bm25(entries_fts, 10.0, 5.0) AS rank
        FROM entries_fts
        JOIN entries e ON e.rowid = entries_fts.rowid
        WHERE entries_fts MATCH ? AND e.layer = ?
        ORDER BY rank
      `
    )
    .all(query, layer) as unknown as SearchRow[];

  const scores = new Map<string, number>();
  for (const row of rows) {
    scores.set(row.id, 1 / (1 + Math.max(row.rank, 0)));
  }
  return scores;
}
