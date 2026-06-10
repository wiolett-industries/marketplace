import { getAllEdgeRows, getAllEntries, getEntryById, getLiteEntries } from '../db.js';
import { withoutEmbedding } from '../entry.js';
import { canParticipateInGraph, GRAPH_RELATIONS } from '../graph.js';
import type { GraphRelation } from '../graph.js';
import type { MemoryScope } from '../scope.js';
import { withLinks } from './graph.js';

const HUB_DEGREE_THRESHOLD = 8;
const SAMPLE_CAP = 50;

const WEIGHT_BUCKETS = ['0.0-0.2', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0'] as const;

function weightBucket(weight: number): string {
  if (weight < 0.2) return '0.0-0.2';
  if (weight < 0.4) return '0.2-0.4';
  if (weight < 0.6) return '0.4-0.6';
  if (weight < 0.8) return '0.6-0.8';
  return '0.8-1.0';
}

export function computeGraphHealth(scope: MemoryScope) {
  const entries = getAllEntries(scope);
  const edges = getAllEdgeRows(scope);

  const nodeIds = new Set(entries.map((entry) => entry.id));
  const fileNameById = new Map(entries.map((entry) => [entry.id, entry.file_name]));
  const isGraphCapable = (entry: { layer: string; ref: string | null }): boolean =>
    entry.layer === 'deep' || (entry.layer === 'lite' && entry.ref === null);
  const graphCapableIds = new Set(entries.filter(isGraphCapable).map((entry) => entry.id));

  let deep = 0;
  let liteStandalone = 0;
  let pointers = 0;
  const deadPointerIds: string[] = [];
  for (const entry of entries) {
    if (entry.layer === 'deep') {
      deep += 1;
    } else if (entry.ref === null) {
      liteStandalone += 1;
    } else {
      pointers += 1;
      if (!nodeIds.has(entry.ref)) deadPointerIds.push(entry.id);
    }
  }

  const degree = new Map<string, number>();
  const byRelation: Record<GraphRelation, number> = Object.fromEntries(
    GRAPH_RELATIONS.map((relation) => [relation, 0])
  ) as Record<GraphRelation, number>;
  const weightHistogram: Record<string, number> = Object.fromEntries(WEIGHT_BUCKETS.map((bucket) => [bucket, 0]));
  let autoEdges = 0;
  let manualEdges = 0;
  const danglingEdges: Array<{ from_id: string; to_id: string; relation: string }> = [];

  for (const edge of edges) {
    degree.set(edge.from_id, (degree.get(edge.from_id) ?? 0) + 1);
    degree.set(edge.to_id, (degree.get(edge.to_id) ?? 0) + 1);
    if (edge.relation in byRelation) byRelation[edge.relation] += 1;
    weightHistogram[weightBucket(edge.weight)] += 1;
    if (edge.source === 'auto') autoEdges += 1;
    else manualEdges += 1;
    if (!graphCapableIds.has(edge.from_id) || !graphCapableIds.has(edge.to_id)) {
      if (danglingEdges.length < SAMPLE_CAP) {
        danglingEdges.push({ from_id: edge.from_id, to_id: edge.to_id, relation: edge.relation });
      }
    }
  }

  const orphanIds: string[] = [];
  let orphanCount = 0;
  const hubs: Array<{ id: string; file_name: string; degree: number }> = [];
  for (const id of graphCapableIds) {
    const nodeDegree = degree.get(id) ?? 0;
    if (nodeDegree === 0) {
      orphanCount += 1;
      if (orphanIds.length < SAMPLE_CAP) orphanIds.push(id);
    }
    if (nodeDegree > HUB_DEGREE_THRESHOLD) {
      hubs.push({ id, file_name: fileNameById.get(id) ?? id, degree: nodeDegree });
    }
  }
  hubs.sort((left, right) => right.degree - left.degree);

  const relatedToShare = edges.length > 0 ? Number((byRelation.related_to / edges.length).toFixed(3)) : 0;

  return {
    scope,
    nodes: {
      total: entries.length,
      graph_capable: graphCapableIds.size,
      deep,
      lite_standalone: liteStandalone,
      pointers,
    },
    edges: {
      total: edges.length,
      auto: autoEdges,
      manual: manualEdges,
      by_relation: byRelation,
      related_to_share: relatedToShare,
    },
    orphans: { count: orphanCount, sample_ids: orphanIds },
    dangling_edges: { count: danglingEdges.length, samples: danglingEdges },
    hubs: { threshold: HUB_DEGREE_THRESHOLD, nodes: hubs.slice(0, SAMPLE_CAP) },
    weight_histogram: weightHistogram,
    dead_pointers: { count: deadPointerIds.length, ids: deadPointerIds.slice(0, SAMPLE_CAP) },
  };
}

export function handleInspect(args: {
  scope?: MemoryScope;
  view?: 'memory' | 'index' | 'graph' | 'health' | 'all';
  memory_id?: string;
  include_embedding?: boolean;
}) {
  const scope = args.scope ?? 'project';
  const view = args.view ?? 'memory';

  if (view === 'index') {
    return getLiteEntries(scope).map(withoutEmbedding);
  }

  if (view === 'graph') {
    return args.memory_id ? withLinks(assertMemory(args.memory_id, scope), scope).links : getAllEdgeRows(scope);
  }

  if (view === 'health') {
    return computeGraphHealth(scope);
  }

  if (view === 'all') {
    return {
      memories: getAllEntries(scope),
      index: getLiteEntries(scope).map(withoutEmbedding),
      graph: getAllEdgeRows(scope),
    };
  }

  if (!args.memory_id) {
    return getAllEntries(scope);
  }

  const entry = assertMemory(args.memory_id, scope);
  return args.include_embedding ? entry : canParticipateInGraph(entry) ? withLinks(entry, scope) : withoutEmbedding(entry);
}

function assertMemory(id: string, scope: MemoryScope) {
  const entry = getEntryById(id, scope);
  if (!entry) throw new Error(`Memory "${id}" does not exist.`);
  return entry;
}
