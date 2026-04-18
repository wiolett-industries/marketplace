export function normalizeScores(scores: Map<string, number>): Map<string, number> {
  if (scores.size === 0) {
    return new Map();
  }

  const values = Array.from(scores.values());
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const normalized = new Map<string, number>();

  for (const [id, score] of scores) {
    normalized.set(id, range === 0 ? 1 : (score - min) / range);
  }

  return normalized;
}
