import { compileSynthesis } from '../compile/synthesis.js';
import { getEntryById } from '../db.js';
import type { MemoryScope } from '../scope.js';
import { handleSearch } from './search.js';
import { spreadingActivation } from '../retrieval/activation.js';
import type { ActivationVia } from '../retrieval/activation.js';

const EXPAND_SEED_COUNT = 3;
const NEIGHBORS_PER_SEED = 5;
const EXPAND_MIN_WEIGHT = 0.2;

interface QueryCandidate {
  id: string;
  file_name: string;
  score: number;
  preview: string;
  via: ActivationVia | null;
}

export async function handleQuery(args: {
  query: string;
  scope?: MemoryScope;
  limit?: number;
  detail?: 'brief' | 'normal' | 'full';
  expand?: boolean;
  expand_hops?: number;
}) {
  const scope = args.scope ?? 'project';
  const limit = args.limit ?? 8;
  const results = await handleSearch({ query: args.query, limit, scope });
  if (!results.length) {
    return { answer: '', sources: [], candidates: [] };
  }

  const candidates: QueryCandidate[] = results.map((entry) => ({
    id: entry.id,
    file_name: entry.file_name,
    score: entry.score,
    preview: getEntryById(entry.id, scope)?.content.slice(0, 220) ?? '',
    via: null,
  }));

  // Graph-expand the top search hits so memories connected by edges (but not
  // matched by the query text) can also participate in the synthesized answer.
  if (args.expand ?? true) {
    const resultIds = new Set(results.map((entry) => entry.id));
    const seeds = results.slice(0, EXPAND_SEED_COUNT).map((entry) => ({ id: entry.id, weight: entry.score }));
    const hops = Math.min(Math.max(Math.trunc(args.expand_hops ?? 1), 1), 2);
    const activated = spreadingActivation({
      seeds,
      hops,
      minWeight: EXPAND_MIN_WEIGHT,
      maxNodes: seeds.length * NEIGHBORS_PER_SEED + seeds.length,
      scope,
    });

    const expansion: QueryCandidate[] = [...activated.entries()]
      .filter(([id]) => !resultIds.has(id))
      .sort((left, right) => right[1].score - left[1].score)
      .map(([id, result]) => {
        const entry = getEntryById(id, scope);
        if (!entry) return null;
        return {
          id,
          file_name: entry.file_name,
          score: Number(result.score.toFixed(6)),
          preview: entry.content.slice(0, 220),
          via: result.via,
        };
      })
      .filter((candidate): candidate is QueryCandidate => candidate !== null);

    // Cap graph-expanded extras at `limit` so total candidates stay bounded
    // (search hits + at most `limit` expanded), never exceeding 2x limit.
    candidates.push(...expansion.slice(0, limit));
  }

  const compiled = await compileSynthesis({
    mode: 'query',
    query: args.query,
    detail: args.detail,
    candidates: candidates
      .map((candidate) => {
        const entry = getEntryById(candidate.id, scope);
        return entry ? { entry, score: candidate.score, via: candidate.via } : null;
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null),
  });

  return {
    answer: compiled.answer,
    sources: compiled.sources,
    candidates,
  };
}
