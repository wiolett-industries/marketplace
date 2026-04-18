import { getDeepEntries, searchFTS } from '../db.js';
import { embed } from '../embeddings.js';
import { withLinks } from './graph.js';
import { cosineSimilarity } from '../utils/cosine.js';
import { normalizeScores } from '../utils/normalize.js';
import type { MemoryScope } from '../scope.js';

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildLexicalScores(
  entries: ReturnType<typeof getDeepEntries>,
  query: string
): Map<string, number> {
  const normalizedQuery = query.trim().toLowerCase();
  const tokens = tokenize(normalizedQuery);
  const scores = new Map<string, number>();

  for (const entry of entries) {
    const content = entry.content.toLowerCase();
    const tags = entry.tags.join(' ');
    let score = 0;

    if (normalizedQuery && content.includes(normalizedQuery)) {
      score += 3;
    }

    if (normalizedQuery && tags.includes(normalizedQuery)) {
      score += 2;
    }

    if (tokens.length > 0) {
      const tokenHits = tokens.filter((token) => content.includes(token) || tags.includes(token)).length;
      score += tokenHits / tokens.length;
    }

    if (score > 0) {
      scores.set(entry.id, score);
    }
  }

  return scores;
}

export async function handleSearch(args: { query: string; limit?: number; scope?: MemoryScope }) {
  const query = args.query.trim();
  const limit = args.limit ?? 10;
  const scope = args.scope ?? 'project';
  const entries = getDeepEntries(scope);

  if (!query || entries.length === 0) {
    return [];
  }

  const semanticRaw = new Map<string, number>();
  const queryEmbedding = await embed(query);

  if (queryEmbedding.length > 0) {
    for (const entry of entries) {
      if (entry.embedding.length === queryEmbedding.length) {
        semanticRaw.set(entry.id, cosineSimilarity(queryEmbedding, entry.embedding));
      }
    }
  }

  let keywordRaw = new Map<string, number>();
  try {
    keywordRaw = searchFTS(query, 'deep', scope);
  } catch {
    keywordRaw = new Map();
  }

  const lexicalRaw = buildLexicalScores(entries, query);
  for (const [id, score] of lexicalRaw) {
    const existing = keywordRaw.get(id) ?? 0;
    keywordRaw.set(id, Math.max(existing, score));
  }

  const semantic = normalizeScores(semanticRaw);
  const keyword = normalizeScores(keywordRaw);
  const ids = new Set<string>([...semantic.keys(), ...keyword.keys()]);

  if (ids.size === 0) {
    return [];
  }

  const useSemantic = semantic.size > 0;
  const useKeyword = keyword.size > 0;
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));

  return Array.from(ids)
    .map((id) => {
      const semanticScore = semantic.get(id) ?? 0;
      const keywordScore = keyword.get(id) ?? 0;
      const score = useSemantic && useKeyword
        ? (semanticScore * 0.7) + (keywordScore * 0.3)
        : useSemantic
          ? semanticScore
          : keywordScore;

      const entry = entryById.get(id);
      if (!entry || score <= 0) {
        return null;
      }

      return {
        ...withLinks(entry, scope),
        score,
      };
    })
    .filter((result): result is NonNullable<typeof result> => result !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
