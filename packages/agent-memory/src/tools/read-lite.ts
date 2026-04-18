import { getLiteEntries } from '../db.js';
import { withoutEmbedding } from '../entry.js';
import type { MemoryScope } from '../scope.js';

export function handleReadLite(scope: MemoryScope = 'project') {
  return getLiteEntries(scope).map((entry) => withoutEmbedding(entry));
}
