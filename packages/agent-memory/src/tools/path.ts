import type { GraphDirection, GraphEdgeRecord, GraphRelation } from '../graph.js';
import type { MemoryScope } from '../scope.js';
import { assertGraphNode } from '../graph.js';
import { getEntryById, getFilteredEdgeRows } from '../db.js';

export type PathStrategy = 'shortest' | 'strongest';

export interface PathArgs {
  from_id: string;
  to_id: string;
  scope?: MemoryScope;
  direction?: GraphDirection;
  relations?: GraphRelation[];
  min_weight?: number;
  max_depth?: number;
  strategy?: PathStrategy;
}

export interface PathNode {
  id: string;
  file_name: string;
}

export interface PathResult {
  from_id: string;
  to_id: string;
  found: boolean;
  strategy: PathStrategy;
  path: PathNode[];
  edges: GraphEdgeRecord[];
  hops: number;
  total_weight: number;
}

interface Expansion {
  source: string;
  target: string;
  edge: GraphEdgeRecord;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Adjacency expansion for a frontier, honoring direction and deduping symmetric edges. */
function expand(
  frontier: string[],
  direction: GraphDirection,
  relations: GraphRelation[] | undefined,
  minWeight: number,
  scope: MemoryScope | undefined
): Expansion[] {
  const frontierSet = new Set(frontier);
  const edges = getFilteredEdgeRows({ ids: frontier, direction, relations, minWeight, scope });
  const seen = new Set<string>();
  const out: Expansion[] = [];

  const add = (source: string, edge: GraphEdgeRecord, target: string): void => {
    if (source === target) return;
    const key = `${source}->${target}:${edge.relation}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ source, target, edge });
  };

  for (const edge of edges) {
    const fromInFrontier = frontierSet.has(edge.from_id);
    const toInFrontier = frontierSet.has(edge.to_id);
    if (direction === 'outgoing') {
      if (fromInFrontier) add(edge.from_id, edge, edge.to_id);
    } else if (direction === 'incoming') {
      if (toInFrontier) add(edge.to_id, edge, edge.from_id);
    } else {
      if (fromInFrontier) add(edge.from_id, edge, edge.to_id);
      if (toInFrontier) add(edge.to_id, edge, edge.from_id);
    }
  }
  return out;
}

function toNode(id: string, scope: MemoryScope | undefined): PathNode {
  const entry = getEntryById(id, scope);
  return { id, file_name: entry?.file_name ?? id };
}

function reconstruct(
  fromId: string,
  toId: string,
  parent: Map<string, { prev: string; edge: GraphEdgeRecord }>,
  scope: MemoryScope | undefined,
  strategy: PathStrategy
): PathResult {
  const nodeIds: string[] = [toId];
  const edges: GraphEdgeRecord[] = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const step = parent.get(cursor);
    if (!step) break;
    edges.push(step.edge);
    nodeIds.push(step.prev);
    cursor = step.prev;
  }
  nodeIds.reverse();
  edges.reverse();
  const totalWeight = edges.reduce((product, edge) => product * edge.weight, 1);
  return {
    from_id: fromId,
    to_id: toId,
    found: true,
    strategy,
    path: nodeIds.map((id) => toNode(id, scope)),
    edges,
    hops: edges.length,
    total_weight: Number(totalWeight.toFixed(6)),
  };
}

function notFound(fromId: string, toId: string, strategy: PathStrategy): PathResult {
  return { from_id: fromId, to_id: toId, found: false, strategy, path: [], edges: [], hops: 0, total_weight: 0 };
}

const MAX_VISITED = 1000;

function shortestPath(args: Required<Pick<PathArgs, 'from_id' | 'to_id'>> & {
  direction: GraphDirection;
  relations?: GraphRelation[];
  minWeight: number;
  maxDepth: number;
  scope?: MemoryScope;
}): PathResult {
  const { from_id: fromId, to_id: toId, direction, relations, minWeight, maxDepth, scope } = args;
  const visited = new Set<string>([fromId]);
  const parent = new Map<string, { prev: string; edge: GraphEdgeRecord }>();
  let frontier = [fromId];

  for (let depth = 0; depth < maxDepth && frontier.length > 0 && visited.size < MAX_VISITED; depth += 1) {
    const next: string[] = [];
    for (const { source, target, edge } of expand(frontier, direction, relations, minWeight, scope)) {
      if (visited.has(target)) continue;
      visited.add(target);
      parent.set(target, { prev: source, edge });
      if (target === toId) return reconstruct(fromId, toId, parent, scope, 'shortest');
      if (visited.size >= MAX_VISITED) break;
      next.push(target);
    }
    frontier = next;
  }
  return notFound(fromId, toId, 'shortest');
}

function strongestPath(args: Required<Pick<PathArgs, 'from_id' | 'to_id'>> & {
  direction: GraphDirection;
  relations?: GraphRelation[];
  minWeight: number;
  maxDepth: number;
  scope?: MemoryScope;
}): PathResult {
  const { from_id: fromId, to_id: toId, direction, relations, minWeight, maxDepth, scope } = args;
  // Dijkstra maximizing the product of edge weights (all weights in (0,1]).
  const best = new Map<string, number>([[fromId, 1]]);
  const depthOf = new Map<string, number>([[fromId, 0]]);
  const parent = new Map<string, { prev: string; edge: GraphEdgeRecord }>();
  const finalized = new Set<string>();
  const open = new Map<string, number>([[fromId, 1]]);

  while (open.size > 0 && finalized.size < MAX_VISITED) {
    // Pop the open node with the highest path product.
    let nodeId = '';
    let nodeScore = -1;
    for (const [id, score] of open) {
      if (score > nodeScore) {
        nodeScore = score;
        nodeId = id;
      }
    }
    open.delete(nodeId);
    if (finalized.has(nodeId)) continue;
    finalized.add(nodeId);
    if (nodeId === toId) return reconstruct(fromId, toId, parent, scope, 'strongest');

    const depth = depthOf.get(nodeId) ?? 0;
    if (depth >= maxDepth) continue;

    for (const { target, edge } of expand([nodeId], direction, relations, minWeight, scope)) {
      if (finalized.has(target)) continue;
      const candidate = nodeScore * edge.weight;
      if (candidate > (best.get(target) ?? 0)) {
        best.set(target, candidate);
        depthOf.set(target, depth + 1);
        parent.set(target, { prev: nodeId, edge });
        open.set(target, candidate);
      }
    }
  }
  return notFound(fromId, toId, 'strongest');
}

/**
 * Find a path between two memories. `shortest` = fewest hops (BFS); `strongest`
 * = highest product of edge weights (Dijkstra). Read-only.
 */
export function handlePath(args: PathArgs): PathResult {
  const scope = args.scope ?? 'project';
  const strategy: PathStrategy = args.strategy ?? 'shortest';
  const direction: GraphDirection = args.direction ?? 'both';
  const minWeight = clamp(args.min_weight ?? 0, 0, 1);
  const maxDepth = clamp(Math.trunc(args.max_depth ?? 6), 1, 6);

  assertGraphNode(getEntryById(args.from_id, scope), args.from_id);
  assertGraphNode(getEntryById(args.to_id, scope), args.to_id);

  if (args.from_id === args.to_id) {
    return {
      from_id: args.from_id,
      to_id: args.to_id,
      found: true,
      strategy,
      path: [toNode(args.from_id, scope)],
      edges: [],
      hops: 0,
      total_weight: 1,
    };
  }

  const common = { from_id: args.from_id, to_id: args.to_id, direction, relations: args.relations, minWeight, maxDepth, scope };
  return strategy === 'strongest' ? strongestPath(common) : shortestPath(common);
}
