import { getEdgeSummaries, getEntryById, getFilteredEdgeRows, getNeighborSummaries, getOutgoingEdgeRecords, replaceOutgoingEdges } from '../db.js';
import { deleteGraphFile, listGraphFileNames, readGraphFile, readEntryFileByFileName, writeGraphFile } from '../files.js';
import { type EntryRecord, type EntryWithLinks, withoutEmbedding } from '../entry.js';
import { assertDeepGraphNode, type GraphDirection, type GraphEdgeRecord, type GraphRelation, type GraphSubgraph, isSymmetricRelation, normalizeWeight } from '../graph.js';
import type { MemoryScope } from '../scope.js';

function now(): number {
  return Date.now();
}

function persistOutgoingEdges(owner: EntryRecord, edges: GraphEdgeRecord[], scope: MemoryScope): void {
  const normalized = edges
    .map((edge) => ({
      ...edge,
      weight: normalizeWeight(edge.weight),
    }))
    .sort((left, right) =>
      left.to_id.localeCompare(right.to_id) ||
      left.relation.localeCompare(right.relation)
    );

  if (normalized.length === 0) {
    deleteGraphFile(owner.file_name, scope);
  } else {
    writeGraphFile(owner.file_name, normalized, scope);
  }

  replaceOutgoingEdges(owner.id, normalized, scope);
}

function upsertOutgoingEdge(owner: EntryRecord, edge: GraphEdgeRecord, scope: MemoryScope): void {
  const current = getOutgoingEdgeRecords(owner.id, scope).filter(
    (existing) => !(existing.to_id === edge.to_id && existing.relation === edge.relation)
  );

  current.push(edge);
  persistOutgoingEdges(owner, current, scope);
}

function removeOutgoingEdge(owner: EntryRecord, toId: string, relation: GraphRelation, scope: MemoryScope): boolean {
  const current = getOutgoingEdgeRecords(owner.id, scope);
  const next = current.filter((edge) => !(edge.to_id === toId && edge.relation === relation));
  const changed = next.length !== current.length;

  if (changed) {
    persistOutgoingEdges(owner, next, scope);
  }

  return changed;
}

export function withLinks(entry: EntryRecord, scope: MemoryScope = 'project'): EntryWithLinks {
  return {
    ...withoutEmbedding(entry),
    links: getEdgeSummaries(entry.id, scope),
  };
}

export function handleLink(args: {
  from_id: string;
  to_id: string;
  relation: GraphRelation;
  weight: number;
  reason?: string;
  scope?: MemoryScope;
}): { linked: true; mirrored: boolean } {
  const scope = args.scope ?? 'project';
  if (args.from_id === args.to_id) {
    throw new Error('Self-links are not allowed.');
  }

  const fromEntry = assertDeepGraphNode(getEntryById(args.from_id, scope), args.from_id);
  const toEntry = assertDeepGraphNode(getEntryById(args.to_id, scope), args.to_id);
  const weight = normalizeWeight(args.weight);
  const timestamp = now();
  const reason = args.reason?.trim() || null;

  const forwardExisting = getOutgoingEdgeRecords(fromEntry.id, scope).find(
    (edge) => edge.to_id === toEntry.id && edge.relation === args.relation
  );

  upsertOutgoingEdge(fromEntry, {
    from_id: fromEntry.id,
    to_id: toEntry.id,
    relation: args.relation,
    weight,
    reason,
    created_at: forwardExisting?.created_at ?? timestamp,
    updated_at: timestamp,
  }, scope);

  if (isSymmetricRelation(args.relation)) {
    const reverseExisting = getOutgoingEdgeRecords(toEntry.id, scope).find(
      (edge) => edge.to_id === fromEntry.id && edge.relation === args.relation
    );

    upsertOutgoingEdge(toEntry, {
      from_id: toEntry.id,
      to_id: fromEntry.id,
      relation: args.relation,
      weight,
      reason,
      created_at: reverseExisting?.created_at ?? timestamp,
      updated_at: timestamp,
    }, scope);
  }

  return {
    linked: true,
    mirrored: isSymmetricRelation(args.relation),
  };
}

export function handleUnlink(args: {
  from_id: string;
  to_id: string;
  relation: GraphRelation;
  scope?: MemoryScope;
}): { removed: boolean; mirrored_removed: boolean } {
  const scope = args.scope ?? 'project';
  const fromEntry = assertDeepGraphNode(getEntryById(args.from_id, scope), args.from_id);
  const toEntry = assertDeepGraphNode(getEntryById(args.to_id, scope), args.to_id);

  const removed = removeOutgoingEdge(fromEntry, toEntry.id, args.relation, scope);
  let mirroredRemoved = false;

  if (isSymmetricRelation(args.relation)) {
    mirroredRemoved = removeOutgoingEdge(toEntry, fromEntry.id, args.relation, scope);
  }

  return {
    removed,
    mirrored_removed: mirroredRemoved,
  };
}

export function handleNeighbors(args: {
  id: string;
  direction?: GraphDirection;
  relations?: GraphRelation[];
  min_weight?: number;
  limit?: number;
  scope?: MemoryScope;
}) {
  const scope = args.scope ?? 'project';
  const entry = assertDeepGraphNode(getEntryById(args.id, scope), args.id);
  return {
    memory: {
      id: entry.id,
      file_name: entry.file_name,
    },
    neighbors: getNeighborSummaries({
      id: entry.id,
      direction: args.direction ?? 'both',
      relations: args.relations,
      minWeight: args.min_weight ?? 0,
      limit: args.limit ?? 20,
      scope,
    }),
  };
}

function collectAdjacentIds(
  nodeIds: string[],
  edges: GraphEdgeRecord[],
  direction: GraphDirection
): string[] {
  const frontier = new Set<string>();

  for (const edge of edges) {
    if (direction === 'outgoing') {
      if (nodeIds.includes(edge.from_id)) {
        frontier.add(edge.to_id);
      }
      continue;
    }

    if (direction === 'incoming') {
      if (nodeIds.includes(edge.to_id)) {
        frontier.add(edge.from_id);
      }
      continue;
    }

    if (nodeIds.includes(edge.from_id)) {
      frontier.add(edge.to_id);
    }
    if (nodeIds.includes(edge.to_id)) {
      frontier.add(edge.from_id);
    }
  }

  return Array.from(frontier);
}

export function handleSubgraph(args: {
  id: string;
  depth?: number;
  direction?: GraphDirection;
  relations?: GraphRelation[];
  min_weight?: number;
  max_nodes?: number;
  scope?: MemoryScope;
}): GraphSubgraph {
  const scope = args.scope ?? 'project';
  const root = assertDeepGraphNode(getEntryById(args.id, scope), args.id);
  const depth = Math.max(1, Math.min(args.depth ?? 1, 4));
  const direction = args.direction ?? 'both';
  const maxNodes = Math.max(1, Math.min(args.max_nodes ?? 50, 200));
  const visited = new Set<string>([root.id]);
  const collectedEdges = new Map<string, GraphEdgeRecord>();
  let frontier = [root.id];

  for (let level = 0; level < depth && frontier.length > 0 && visited.size < maxNodes; level += 1) {
    const edges = getFilteredEdgeRows({
      ids: frontier,
      direction,
      relations: args.relations,
      minWeight: args.min_weight ?? 0,
      scope,
    });

    for (const edge of edges) {
      collectedEdges.set(`${edge.from_id}:${edge.to_id}:${edge.relation}`, edge);
    }

    const nextIds = collectAdjacentIds(frontier, edges, direction);
    frontier = [];

    for (const id of nextIds) {
      if (visited.size >= maxNodes) {
        break;
      }

      if (!visited.has(id)) {
        visited.add(id);
        frontier.push(id);
      }
    }
  }

  const nodes = Array.from(visited)
    .map((id) => {
      const entry = getEntryById(id, scope);
      return entry ? { id: entry.id, file_name: entry.file_name } : null;
    })
    .filter((node): node is { id: string; file_name: string } => node !== null)
    .sort((left, right) => left.file_name.localeCompare(right.file_name));

  return {
    root_id: root.id,
    depth,
    direction,
    nodes,
    edges: Array.from(collectedEdges.values())
      .filter((edge) => visited.has(edge.from_id) && visited.has(edge.to_id))
      .sort((left, right) => right.weight - left.weight || left.from_id.localeCompare(right.from_id)),
  };
}

export function pruneGraphFilesForDeletedEntry(entry: EntryRecord, scope: MemoryScope = 'project'): void {
  deleteGraphFile(entry.file_name, scope);

  for (const fileName of listGraphFileNames(scope)) {
    const owner = readEntryFileByFileName(fileName, scope);
    if (!owner || owner.layer !== 'deep') {
      continue;
    }

    const next = readGraphFile(fileName, scope).filter((edge) => edge.to_id !== entry.id);
    persistOutgoingEdges(owner, next, scope);
  }
}
