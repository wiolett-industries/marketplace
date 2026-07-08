import { getAllEntries, getLiteEntries } from '../db.js';
import { withoutEmbedding } from '../entry.js';
import type { MemoryScope } from '../scope.js';

export function handleList(args: {
  scope?: MemoryScope;
  query?: string;
  tags?: string[];
  limit?: number;
  index_only?: boolean;
}) {
  const scope = args.scope ?? 'project';
  const query = args.query?.trim().toLowerCase();
  const tags = new Set((args.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  const limit = Math.max(1, Math.min(args.limit ?? 50, 200));

  const entries = args.index_only ? getLiteEntries(scope).map(withoutEmbedding) : getAllEntries(scope);

  return entries
    .filter((entry) => !query || entry.content.toLowerCase().includes(query) || entry.tags.some((tag) => tag.includes(query)))
    .filter((entry) => tags.size === 0 || entry.tags.some((tag) => tags.has(tag)))
    .slice(0, limit);
}
