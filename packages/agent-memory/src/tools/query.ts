import { compileRecall } from '../compile/recall.js';
import { getEntryById } from '../db.js';
import type { MemoryScope } from '../scope.js';
import { handleSearch } from './search.js';

export async function handleQuery(args: {
  query: string;
  scope?: MemoryScope;
  limit?: number;
  detail?: 'brief' | 'normal' | 'full';
}) {
  const scope = args.scope ?? 'project';
  const results = await handleSearch({ query: args.query, limit: args.limit ?? 8, scope });
  if (!results.length) {
    return {
      answer: '',
      sources: [],
      candidates: [],
    };
  }

  const primary = results[0];
  const compiled = await compileRecall({
    id: primary.id,
    scope,
    detail: args.detail ?? 'normal',
    include_sources: true,
  });

  return {
    answer: compiled?.answer ?? primary.content,
    sources: compiled?.sources ?? [{ id: primary.id, role: 'primary' }],
    candidates: results.map((entry) => ({
      id: entry.id,
      file_name: entry.file_name,
      score: entry.score,
      preview: getEntryById(entry.id, scope)?.content.slice(0, 220) ?? '',
    })),
  };
}
