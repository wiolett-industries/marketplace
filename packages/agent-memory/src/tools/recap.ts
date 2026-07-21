import { compileSynthesis } from '../compile/synthesis.js';
import { getDeepEntries, getEntryById, getIncomingSupersededIds, getLiteEntries } from '../db.js';
import type { EntryRecord } from '../entry.js';
import type { MemoryScope } from '../scope.js';
import { handleSearch } from './search.js';

export async function handleRecap(args: {
  scope?: MemoryScope;
  topic?: string;
  limit?: number;
  detail?: 'brief' | 'normal' | 'full';
}) {
  const scope = args.scope ?? 'project';
  const limit = args.limit ?? 12;
  const topic = args.topic?.trim();
  const ranked = topic
    ? (await handleSearch({ query: topic, limit, scope }))
      .map((result) => {
        const entry = getEntryById(result.id, scope);
        return entry ? { entry, score: result.score } : null;
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    : rankCurrentMemories(scope).slice(0, limit);

  const candidates = ranked.map(({ entry, score }) => ({
    id: entry.id,
    file_name: entry.file_name,
    score,
    preview: entry.content.slice(0, 220),
  }));
  const compiled = await compileSynthesis({
    mode: 'recap',
    query: topic,
    detail: args.detail,
    candidates: ranked.map(({ entry, score }) => ({ entry, score, via: null })),
  });

  return {
    answer: compiled.answer,
    sources: compiled.sources,
    candidates,
  };
}

function rankCurrentMemories(scope: MemoryScope): Array<{ entry: EntryRecord; score: number }> {
  const entries = [
    ...getDeepEntries(scope),
    ...getLiteEntries(scope).filter((entry) => entry.ref === null),
  ];
  const superseded = getIncomingSupersededIds(entries.map((entry) => entry.id), scope);
  const current = entries.filter((entry) => !superseded.has(entry.id));
  const newest = Math.max(...current.map((entry) => entry.updated_at), 1);
  const oldest = Math.min(...current.map((entry) => entry.updated_at), newest);
  const span = Math.max(newest - oldest, 1);

  return current
    .map((entry) => ({
      entry,
      score: Number((((entry.importance ?? 0.5) * 0.7) + (((entry.updated_at - oldest) / span) * 0.3)).toFixed(6)),
    }))
    .sort((left, right) => right.score - left.score || right.entry.updated_at - left.entry.updated_at);
}
