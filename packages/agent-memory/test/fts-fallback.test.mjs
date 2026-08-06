import { describe, expect, test } from '@jest/globals';
import { ensureSchema } from '../dist/storage/schema.js';

function ftsUnavailableDatabase() {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      statements.push(sql);
      if (/CREATE VIRTUAL TABLE/i.test(sql)) throw new Error('no such module: fts5');
      return {
        run() {},
        get() { return undefined; },
        all() { return []; },
      };
    },
  };
}

describe('SQLite FTS fallback', () => {
  test('keeps the base schema available when SQLite omits FTS5', () => {
    const database = ftsUnavailableDatabase();

    expect(() => ensureSchema(database)).not.toThrow();
    expect(database.statements.some((sql) => /CREATE TABLE IF NOT EXISTS memories/i.test(sql))).toBe(true);
    expect(database.statements.some((sql) => /CREATE TRIGGER IF NOT EXISTS memories_ai/i.test(sql))).toBe(false);
  });
});
