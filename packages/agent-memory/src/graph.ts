import type { EntryRecord } from './entry.js';

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
  created_at: number;
  updated_at: number;
}

export interface GraphEdgeSummary {
  id: string;
  file_name: string;
  relation: GraphRelation;
  weight: number;
  reason: string | null;
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

export function assertDeepGraphNode(entry: EntryRecord | null, id: string): EntryRecord {
  if (!entry) {
    throw new Error(`Memory entry "${id}" does not exist.`);
  }

  if (entry.layer !== 'deep') {
    throw new Error(`Memory entry "${id}" is not a deep memory and cannot participate in the graph.`);
  }

  return entry;
}

