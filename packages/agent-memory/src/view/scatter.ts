import { getDeepEntries } from '../db.js';
import type { MemorySource } from '../entry.js';
import type { MemoryScope } from '../scope.js';
import { pca2d } from './pca.js';

export interface ScatterPoint {
  id: string;
  file_name: string;
  x: number;
  y: number;
  layer: 'deep';
  source: MemorySource;
  tags: string[];
}

export interface ScatterPayload {
  points: ScatterPoint[];
  /** Variance fraction captured by the X and Y axes. */
  variance_explained: [number, number];
  /** Number of embedded memories projected (0 => empty state). */
  n: number;
  ok: boolean;
}

/**
 * Build the 2D embedding scatter for a scope. Only deep memories carry
 * embeddings (the lite/index layer never does — see plan correction C1), so the
 * projection is over `getDeepEntries` with a non-empty embedding of consistent
 * dimension. Degrades to an empty payload when fewer than two are embeddable.
 */
export function buildScatter(scope: MemoryScope = 'project'): ScatterPayload {
  const embedded = getDeepEntries(scope).filter((entry) => entry.embedding.length > 0);

  // Keep only the dominant embedding dimension so a stray mismatched vector
  // (e.g. a model swap) cannot abort the whole projection.
  const dimCounts = new Map<number, number>();
  for (const entry of embedded) {
    dimCounts.set(entry.embedding.length, (dimCounts.get(entry.embedding.length) ?? 0) + 1);
  }
  let dominantDim = 0;
  let dominantCount = 0;
  for (const [dim, count] of dimCounts) {
    if (count > dominantCount) {
      dominantDim = dim;
      dominantCount = count;
    }
  }

  const usable = embedded.filter((entry) => entry.embedding.length === dominantDim);
  if (usable.length < 2) {
    return { points: [], variance_explained: [0, 0], n: usable.length, ok: false };
  }

  const projection = pca2d(usable.map((entry) => entry.embedding));
  const points: ScatterPoint[] = usable.map((entry, index) => ({
    id: entry.id,
    file_name: entry.file_name,
    x: projection.coords[index][0],
    y: projection.coords[index][1],
    layer: 'deep',
    source: entry.source ?? 'model_inferred',
    tags: entry.tags,
  }));

  return {
    points,
    variance_explained: projection.variance,
    n: usable.length,
    ok: projection.ok,
  };
}
