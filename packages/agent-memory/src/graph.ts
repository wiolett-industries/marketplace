import type { EntryRecord } from './entry.js';

export type GraphMemoryNode = EntryRecord & (
  | { layer: 'deep' }
  | { layer: 'lite'; ref: null }
);

export const DIRECTIONAL_RELATIONS = [
  'depends_on',
  'supersedes',
  'part_of',
  'derived_from',
  'uses_service',
] as const;

export const SYMMETRIC_RELATIONS = [
  'related_to',
  'same_workflow',
  'same_area',
] as const;

export const GRAPH_RELATIONS = [
  ...DIRECTIONAL_RELATIONS,
  ...SYMMETRIC_RELATIONS,
] as const;

export type GraphRelation = typeof GRAPH_RELATIONS[number];
export type GraphDirection = 'outgoing' | 'incoming' | 'both';

export interface GraphEdgeRecord {
  from_id: string;
  to_id: string;
  relation: GraphRelation;
  weight: number;
  reason: string | null;
  source: 'manual' | 'auto';
  created_at: number;
  updated_at: number;
}

export interface GraphEdgeSummary {
  id: string;
  file_name: string;
  relation: GraphRelation;
  weight: number;
  reason: string | null;
  source: 'manual' | 'auto';
  direction: 'outgoing' | 'incoming';
}

export interface GraphLinks {
  outgoing: GraphEdgeSummary[];
  incoming: GraphEdgeSummary[];
}

export interface GraphNodeSummary {
  id: string;
  file_name: string;
}

export interface GraphSubgraph {
  root_id: string;
  depth: number;
  direction: GraphDirection;
  nodes: GraphNodeSummary[];
  edges: GraphEdgeRecord[];
}

export function isGraphRelation(value: string): value is GraphRelation {
  return (GRAPH_RELATIONS as readonly string[]).includes(value);
}

export function isSymmetricRelation(relation: GraphRelation): boolean {
  return (SYMMETRIC_RELATIONS as readonly string[]).includes(relation);
}

export function normalizeWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
    throw new Error('Graph edge weight must be a finite number between 0 and 1.');
  }

  return Number(weight.toFixed(4));
}

/**
 * Choose the canonical representation for an impossible duplicate edge tuple.
 * Manual edges always override inferred ones; two manual revisions preserve the
 * most recently recorded decision, with stable metadata tie-breakers.
 */
export function shouldPreferGraphEdge(current: GraphEdgeRecord, candidate: GraphEdgeRecord): boolean {
  if (current.source !== candidate.source) return current.source === 'auto' && candidate.source === 'manual';
  if (current.source === 'manual' && candidate.source === 'manual') {
    if (candidate.updated_at !== current.updated_at) return candidate.updated_at > current.updated_at;
    if (candidate.created_at !== current.created_at) return candidate.created_at > current.created_at;
    const candidateMetadata = `${candidate.weight}\u0000${candidate.reason ?? ''}`;
    const currentMetadata = `${current.weight}\u0000${current.reason ?? ''}`;
    return candidateMetadata.localeCompare(currentMetadata) > 0;
  }
  return false;
}

export function canParticipateInGraph(entry: EntryRecord | null): entry is GraphMemoryNode {
  return Boolean(entry && (entry.layer === 'deep' || (entry.layer === 'lite' && entry.ref === null)));
}

export function assertGraphNode(entry: EntryRecord | null, id: string): GraphMemoryNode {
  if (!entry) {
    throw new Error(`Memory entry "${id}" does not exist.`);
  }

  if (!canParticipateInGraph(entry)) {
    throw new Error(`Memory entry "${id}" is an index pointer and cannot participate in the graph.`);
  }

  return entry;
}
