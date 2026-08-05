import { deleteEntryFromDb, getAllEntries, getDeepEntries, getEdgeSummaries, getEntryById, getFilteredEdgeRows, getLiteEntries, getNeighborSummaries, getOutgoingEdgeRecords, replaceOutgoingEdges } from '../db.js';
import { deleteEntryFile, deleteGraphFile, listGraphFileNames, readGraphFile, readEntryFileByFileName, writeGraphFile } from '../files.js';
import { refreshAutoLinks } from '../auto-link.js';
import { type EntryRecord, type EntryWithLinks, withoutEmbedding } from '../entry.js';
import { assertGraphNode, type GraphDirection, type GraphEdgeRecord, type GraphRelation, type GraphSubgraph, isGraphRelation, isSymmetricRelation, normalizeWeight, shouldPreferGraphEdge } from '../graph.js';
import type { MemoryScope } from '../scope.js';

function now(): number {
  return Date.now();
}

function persistOutgoingEdges(owner: Pick<EntryRecord, 'id' | 'file_name'>, edges: GraphEdgeRecord[], scope: MemoryScope): void {
  const byTuple = new Map<string, GraphEdgeRecord>();
  for (const edge of edges) {
    const normalizedEdge = {
      ...edge,
      weight: normalizeWeight(edge.weight),
      source: edge.source === 'auto' ? 'auto' as const : 'manual' as const,
    };
    const key = `${normalizedEdge.to_id}:${normalizedEdge.relation}`;
    const previous = byTuple.get(key);
    // A manually maintained relation is the canonical answer if a damaged
    // source file contains both variants of the same tuple.
    if (!previous || shouldPreferGraphEdge(previous, normalizedEdge)) {
      byTuple.set(key, normalizedEdge);
    }
  }

  const normalized = [...byTuple.values()]
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

export interface GraphPruneArgs {
  scope?: MemoryScope;
  dry_run?: boolean;
  drop_dangling?: boolean;
  min_weight?: number;
}

/**
 * Remove unhealthy AUTO edges (dangling and/or below a weight floor). Manual
 * edges are never touched. Mirrors the dangling validation in rebuildFromFiles.
 * `dry_run` (default true) reports what would be removed without writing.
 * Persists through both the per-owner graph JSON and the SQLite cache.
 */
export function handleGraphPrune(args: GraphPruneArgs) {
  const scope = args.scope ?? 'project';
  const dryRun = args.dry_run ?? true;
  const dropDangling = args.drop_dangling ?? true;
  const minWeight = typeof args.min_weight === 'number' && Number.isFinite(args.min_weight) ? args.min_weight : undefined;
  const SAMPLE_CAP = 50;

  const graphNodeIds = new Set(
    getAllEntries(scope)
      .filter((entry) => entry.layer === 'deep' || (entry.layer === 'lite' && entry.ref === null))
      .map((entry) => entry.id)
  );

  let danglingRemoved = 0;
  let belowWeightRemoved = 0;
  let affectedOwners = 0;
  const samples: Array<{ from_id: string; to_id: string; relation: GraphRelation; weight: number; reason: string }> = [];

  for (const ownerId of graphNodeIds) {
    const current = getOutgoingEdgeRecords(ownerId, scope);
    if (current.length === 0) continue;

    const kept: GraphEdgeRecord[] = [];
    let changed = false;
    for (const edge of current) {
      let reason: 'dangling' | 'below_min_weight' | null = null;
      if (edge.source === 'auto') {
        if (dropDangling && !graphNodeIds.has(edge.to_id)) reason = 'dangling';
        else if (minWeight !== undefined && edge.weight < minWeight) reason = 'below_min_weight';
      }
      if (reason) {
        changed = true;
        if (reason === 'dangling') danglingRemoved += 1;
        else belowWeightRemoved += 1;
        if (samples.length < SAMPLE_CAP) {
          samples.push({ from_id: edge.from_id, to_id: edge.to_id, relation: edge.relation, weight: edge.weight, reason });
        }
      } else {
        kept.push(edge);
      }
    }

    if (changed) {
      affectedOwners += 1;
      if (!dryRun) {
        const owner = getEntryById(ownerId, scope);
        if (owner) persistOutgoingEdges(owner, kept, scope);
      }
    }
  }

  return {
    scope,
    dry_run: dryRun,
    drop_dangling: dropDangling,
    min_weight: minWeight ?? null,
    removed: {
      dangling: danglingRemoved,
      below_min_weight: belowWeightRemoved,
      total: danglingRemoved + belowWeightRemoved,
    },
    affected_owners: affectedOwners,
    samples,
  };
}

export interface GraphMaintenanceArgs {
  scope?: MemoryScope;
  dry_run?: boolean;
}

interface GraphRepairSummary {
  orphan_graph_files: number;
  invalid_edges: {
    dangling_target: number;
    invalid_source: number;
    invalid_relation_or_weight: number;
    duplicate_tuple: number;
    total: number;
    manual: number;
    auto: number;
  };
}

type StoredEntry = Omit<EntryRecord, 'embedding'>;
type StoredGraphEntry = StoredEntry & ({ layer: 'deep' } | { layer: 'lite'; ref: null });

function isGraphEntry(entry: StoredEntry | null): entry is StoredGraphEntry {
  return Boolean(entry && (entry.layer === 'deep' || (entry.layer === 'lite' && entry.ref === null)));
}

/**
 * The SQLite cache deliberately skips broken graph records during rebuild, but
 * the source JSON would otherwise remain and trigger the same warning forever.
 * Reconcile those source files here, preserving every structurally valid manual
 * edge and leaving semantic judgments to the full Codex reconciliation.
 */
function repairCanonicalGraphFiles(scope: MemoryScope, dryRun: boolean): GraphRepairSummary {
  const entries = getAllEntries(scope);
  const entriesByFileName = new Map(entries.map((entry) => [entry.file_name, entry]));
  const nodeIds = new Set(entries.filter(isGraphEntry).map((entry) => entry.id));
  const summary: GraphRepairSummary = {
    orphan_graph_files: 0,
    invalid_edges: { dangling_target: 0, invalid_source: 0, invalid_relation_or_weight: 0, duplicate_tuple: 0, total: 0, manual: 0, auto: 0 },
  };

  for (const fileName of listGraphFileNames(scope)) {
    const owner = entriesByFileName.get(fileName) ?? null;
    if (!isGraphEntry(owner)) {
      summary.orphan_graph_files += 1;
      if (!dryRun) {
        deleteGraphFile(fileName, scope);
        if (owner) replaceOutgoingEdges(owner.id, [], scope);
      }
      continue;
    }

    const keptByTuple = new Map<string, GraphEdgeRecord>();
    for (const edge of readGraphFile(fileName, scope)) {
      let reason: 'dangling_target' | 'invalid_source' | 'invalid_relation_or_weight' | null = null;
      if (edge.from_id !== owner.id || edge.to_id === owner.id) {
        reason = 'invalid_source';
      } else if (!nodeIds.has(edge.to_id)) {
        reason = 'dangling_target';
      } else if (!isGraphRelation(edge.relation)) {
        reason = 'invalid_relation_or_weight';
      } else {
        try {
          normalizeWeight(edge.weight);
        } catch {
          reason = 'invalid_relation_or_weight';
        }
      }

      if (reason) {
        summary.invalid_edges[reason] += 1;
        summary.invalid_edges.total += 1;
        summary.invalid_edges[edge.source === 'auto' ? 'auto' : 'manual'] += 1;
      } else {
        const key = `${edge.to_id}:${edge.relation}`;
        const previous = keptByTuple.get(key);
        if (previous) {
          const keepCurrent = shouldPreferGraphEdge(previous, edge);
          const discarded = keepCurrent ? previous : edge;
          if (keepCurrent) keptByTuple.set(key, edge);
          summary.invalid_edges.duplicate_tuple += 1;
          summary.invalid_edges.total += 1;
          summary.invalid_edges[discarded.source === 'auto' ? 'auto' : 'manual'] += 1;
        } else {
          keptByTuple.set(key, edge);
        }
      }
    }

    const kept = [...keptByTuple.values()];
    if (kept.length !== readGraphFile(fileName, scope).length && !dryRun) {
      persistOutgoingEdges(owner, kept, scope);
    }
  }

  // Rebuild normally clears these rows too, but make the repair idempotent even
  // when a caller runs maintenance against an already-open cache.
  if (!dryRun) {
    const graphFiles = new Set(listGraphFileNames(scope));
    for (const entry of entries.filter(isGraphEntry)) {
      if (!graphFiles.has(entry.file_name)) replaceOutgoingEdges(entry.id, [], scope);
    }
  }

  return summary;
}


/**
 * Repair deterministic structural graph failures, including broken graph source
 * files, then rebuild every automatic edge from the current canonical records.
 * Structurally valid manual edges remain untouched; semantic consolidation is a
 * separate model-backed decision during the approved reconciliation.
 */
export async function handleGraphMaintenance(args: GraphMaintenanceArgs) {
  const scope = args.scope ?? 'project';
  const dryRun = args.dry_run ?? true;
  const entries = getAllEntries(scope);
  const nodeIds = new Set(entries.map((entry) => entry.id));
  const deadPointers = entries.filter((entry) => entry.layer === 'lite' && entry.ref !== null && !nodeIds.has(entry.ref));
  const graphNodes = entries.filter((entry) => entry.layer === 'deep' || (entry.layer === 'lite' && entry.ref === null));
  const plannedRepair = repairCanonicalGraphFiles(scope, true);

  if (dryRun) {
    return {
      scope,
      dry_run: true,
      dead_pointers: { would_delete: deadPointers.length, ids: deadPointers.slice(0, 50).map((entry) => entry.id) },
      deterministic_graph_repair: plannedRepair,
      auto_graph: { would_rebuild_for: graphNodes.length },
      valid_manual_edges_preserved: true,
    };
  }

  for (const pointer of deadPointers) {
    deleteEntryFile(pointer, scope);
    deleteEntryFromDb(pointer.id, scope);
  }

  const repairedGraph = repairCanonicalGraphFiles(scope, false);
  const survivingGraphNodes = [...getDeepEntries(scope), ...getLiteEntries(scope)]
    .filter((entry) => entry.layer === 'deep' || (entry.layer === 'lite' && entry.ref === null));
  let automaticLinks = 0;
  for (const entry of survivingGraphNodes) {
    const result = await refreshAutoLinks(entry, scope, { useModel: false });
    automaticLinks += result.linked;
  }

  return {
    scope,
    dry_run: false,
    dead_pointers: { deleted: deadPointers.length, ids: deadPointers.slice(0, 50).map((entry) => entry.id) },
    auto_graph: {
      rebuilt_for: survivingGraphNodes.length,
      automatic_links: automaticLinks,
    },
    deterministic_graph_repair: repairedGraph,
    valid_manual_edges_preserved: true,
  };
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

  const fromEntry = assertGraphNode(getEntryById(args.from_id, scope), args.from_id);
  const toEntry = assertGraphNode(getEntryById(args.to_id, scope), args.to_id);
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
    source: 'manual',
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
      source: 'manual',
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
  const fromEntry = assertGraphNode(getEntryById(args.from_id, scope), args.from_id);
  const toEntry = assertGraphNode(getEntryById(args.to_id, scope), args.to_id);

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
  const entry = assertGraphNode(getEntryById(args.id, scope), args.id);
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
  const root = assertGraphNode(getEntryById(args.id, scope), args.id);
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
