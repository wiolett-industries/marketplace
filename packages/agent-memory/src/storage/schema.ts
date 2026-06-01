import type { DatabaseSync } from 'node:sqlite';

function run(database: DatabaseSync, sql: string): void {
  database.prepare(sql).run();
}

function hasTable(database: DatabaseSync, tableName: string): boolean {
  const row = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName) as { name: string } | undefined;
  return Boolean(row);
}

function hasColumn(database: DatabaseSync, tableName: string, columnName: string): boolean {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function migrateLegacyEntries(database: DatabaseSync): void {
  if (!hasTable(database, 'entries')) return;

  const rows = database.prepare('SELECT * FROM entries').all() as Array<{
    id: string;
    file_name: string | null;
    content: string;
    tags: string;
    layer: string;
    ref: string | null;
    hash: string | null;
    embedding: string;
    created_at: number;
    updated_at: number;
  }>;

  const insertMemory = database.prepare(`
    INSERT OR IGNORE INTO memories
      (id, file_name, content, tags, source, confidence, importance, hash, embedding, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertIndex = database.prepare(`
    INSERT OR IGNORE INTO memory_index
      (id, memory_id, file_name, content, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of rows) {
    const layer = row.layer === 'light' ? 'lite' : row.layer;
    const fileName = row.file_name ?? row.id;
    if (layer === 'lite' && row.ref) {
      insertIndex.run(row.id, row.ref, fileName, row.content, row.tags, row.created_at, row.updated_at);
      continue;
    }

    insertMemory.run(
      row.id,
      fileName,
      row.content,
      row.tags,
      'model_inferred',
      0.5,
      layer === 'lite' ? 0.35 : 0.5,
      row.hash,
      row.embedding,
      row.created_at,
      row.updated_at
    );
  }
}

export function ensureSchema(database: DatabaseSync): void {
  run(database, `
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'model_inferred',
      confidence REAL NOT NULL DEFAULT 0.5,
      importance REAL NOT NULL DEFAULT 0.5,
      hash TEXT DEFAULT NULL,
      embedding TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  run(database, `
    CREATE TABLE IF NOT EXISTS memory_index (
      id TEXT PRIMARY KEY,
      memory_id TEXT DEFAULT NULL,
      file_name TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  run(database, `
    CREATE TABLE IF NOT EXISTS memory_edges (
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      weight REAL NOT NULL,
      reason TEXT DEFAULT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (from_id, to_id, relation)
    )
  `);
  if (!hasColumn(database, 'memory_edges', 'source')) {
    run(database, "ALTER TABLE memory_edges ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
  }

  run(database, 'CREATE INDEX IF NOT EXISTS memory_edges_from_idx ON memory_edges (from_id)');
  run(database, 'CREATE INDEX IF NOT EXISTS memory_edges_to_idx ON memory_edges (to_id)');
  run(database, 'CREATE INDEX IF NOT EXISTS memory_index_memory_id_idx ON memory_index (memory_id)');

  run(database, `
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      tags,
      content='memories',
      content_rowid='rowid'
    )
  `);
  run(database, `
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_index_fts USING fts5(
      content,
      tags,
      content='memory_index',
      content_rowid='rowid'
    )
  `);

  run(database, `
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
    END
  `);
  run(database, `
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags) VALUES ('delete', old.rowid, old.content, old.tags);
    END
  `);
  run(database, `
    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags) VALUES ('delete', old.rowid, old.content, old.tags);
      INSERT INTO memories_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
    END
  `);

  run(database, `
    CREATE TRIGGER IF NOT EXISTS memory_index_ai AFTER INSERT ON memory_index BEGIN
      INSERT INTO memory_index_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
    END
  `);
  run(database, `
    CREATE TRIGGER IF NOT EXISTS memory_index_ad AFTER DELETE ON memory_index BEGIN
      INSERT INTO memory_index_fts(memory_index_fts, rowid, content, tags) VALUES ('delete', old.rowid, old.content, old.tags);
    END
  `);
  run(database, `
    CREATE TRIGGER IF NOT EXISTS memory_index_au AFTER UPDATE ON memory_index BEGIN
      INSERT INTO memory_index_fts(memory_index_fts, rowid, content, tags) VALUES ('delete', old.rowid, old.content, old.tags);
      INSERT INTO memory_index_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
    END
  `);

  migrateLegacyEntries(database);
}
