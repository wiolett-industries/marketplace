import type { GraphDirection, GraphEdgeRecord, GraphRelation } from '../graph.js';
import type { MemoryScope } from '../scope.js';
import { getFilteredEdgeRows } from '../db.js';

export interface ActivationSeed {
  id: string;
  weight: number;
}

export interface ActivationVia {
  seedId: string;
  relation: GraphRelation;
  weight: number;
}

export interface ActivationResult {
  score: number;
  /** Strongest single contribution path; null for seed nodes. */
  via: ActivationVia | null;
}

export interface SpreadingActivationOptions {
  seeds: ActivationSeed[];
  hops?: number;
  decay?: number;
  minWeight?: number;
  maxNodes?: number;
  direction?: GraphDirection;
  relations?: GraphRelation[];
  relationWeights?: Partial<Record<GraphRelation, number>>;
  scope?: MemoryScope;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Bounded spreading-activation over the memory graph. Propagates activation from
 * seed nodes outward along weighted edges, accumulating across paths and decaying
 * per hop. Pure read: never mutates the graph. Mirrors the frontier-BFS used by
 * handleSubgraph, fetching one batched edge query per hop via getFilteredEdgeRows.
 *
 * Returns a map of node id -> { score, via }, where `via` records the edge/seed
 * that produced the node's single strongest contribution (null for seed nodes).
 */
export function spreadingActivation(options: SpreadingActivationOptions): Map<string, ActivationResult> {
  const hops = clamp(Math.trunc(options.hops ?? 2), 1, 4);
  const decay = clamp(options.decay ?? 0.5, 0.0001, 1);
  const minWeight = clamp(options.minWeight ?? 0.2, 0, 1);
  const maxNodes = clamp(Math.trunc(options.maxNodes ?? 64), 1, 512);
  const direction: GraphDirection = options.direction ?? 'both';
  const relations = options.relations;
  const relationWeight = (relation: GraphRelation): number => {
    const configured = options.relationWeights?.[relation];
    return typeof configured === 'number' && Number.isFinite(configured) ? configured : 1;
  };

  const activation = new Map<string, number>();
  const via = new Map<string, ActivationVia>();
  const bestContribution = new Map<string, number>();
  const seedOf = new Map<string, string>();
  const seedIds = new Set<string>();

  for (const seed of options.seeds) {
    if (!seed || typeof seed.id !== 'string') continue;
    const weight = clamp(seed.weight, 0, Number.MAX_SAFE_INTEGER);
    activation.set(seed.id, Math.max(activation.get(seed.id) ?? 0, weight));
    seedOf.set(seed.id, seed.id);
    seedIds.add(seed.id);
  }

  if (seedIds.size === 0) return new Map();

  const visited = new Set<string>(seedIds);
  let frontier = [...seedIds];

  for (let level = 0; level < hops && frontier.length > 0 && visited.size < maxNodes; level += 1) {
    const frontierSet = new Set(frontier);
    const edges = getFilteredEdgeRows({ ids: frontier, direction, relations, minWeight, scope: options.scope });

    // Dedupe (source -> target : relation) so symmetric relations stored as two
    // physical directed edges do not double-count when direction is 'both'.
    const processed = new Set<string>();
    const nextFrontier: string[] = [];

    const propagate = (sourceId: string, edge: GraphEdgeRecord, targetId: string): void => {
      if (sourceId === targetId) return;
      const key = `${sourceId}->${targetId}:${edge.relation}`;
      if (processed.has(key)) return;
      processed.add(key);

      const contribution = (activation.get(sourceId) ?? 0) * edge.weight * relationWeight(edge.relation) * decay;
      if (contribution <= 0) return;

      activation.set(targetId, (activation.get(targetId) ?? 0) + contribution);

      // Track the strongest single contribution for `via` (seeds keep via = null).
      if (!seedIds.has(targetId) && contribution > (bestContribution.get(targetId) ?? 0)) {
        bestContribution.set(targetId, contribution);
        const originSeed = seedOf.get(sourceId) ?? sourceId;
        via.set(targetId, { seedId: originSeed, relation: edge.relation, weight: edge.weight });
        seedOf.set(targetId, originSeed);
      } else if (!seedOf.has(targetId)) {
        seedOf.set(targetId, seedOf.get(sourceId) ?? sourceId);
      }

      if (!visited.has(targetId)) {
        if (visited.size >= maxNodes) return;
        visited.add(targetId);
        nextFrontier.push(targetId);
      }
    };

    for (const edge of edges) {
      const fromInFrontier = frontierSet.has(edge.from_id);
      const toInFrontier = frontierSet.has(edge.to_id);
      if (direction === 'outgoing') {
        if (fromInFrontier) propagate(edge.from_id, edge, edge.to_id);
      } else if (direction === 'incoming') {
        if (toInFrontier) propagate(edge.to_id, edge, edge.from_id);
      } else {
        if (fromInFrontier) propagate(edge.from_id, edge, edge.to_id);
        if (toInFrontier) propagate(edge.to_id, edge, edge.from_id);
      }
    }

    frontier = nextFrontier;
  }

  const result = new Map<string, ActivationResult>();
  for (const [id, score] of activation) {
    result.set(id, { score, via: via.get(id) ?? null });
  }
  return result;
}
