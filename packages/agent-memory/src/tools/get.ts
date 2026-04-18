import { getEntryById } from '../db.js';
import { withoutEmbedding } from '../entry.js';
import { withLinks } from './graph.js';
import type { MemoryScope } from '../scope.js';

export function handleGet(args: { id: string; scope?: MemoryScope }) {
  const scope = args.scope ?? 'project';
  const entry = getEntryById(args.id, scope);
  if (!entry) {
    return null;
  }

  return entry.layer === 'deep' ? withLinks(entry, scope) : withoutEmbedding(entry);
}
