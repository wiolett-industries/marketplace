// Shared shapes mirroring the JSON API in src/view/api.ts. Kept hand-synced
// (the UI is bundled, not type-linked to the server source).

export type Scope = 'project' | 'global';

export type Relation =
  | 'depends_on'
  | 'supersedes'
  | 'part_of'
  | 'derived_from'
  | 'uses_service'
  | 'related_to'
  | 'same_workflow'
  | 'same_area';

export interface Meta {
  enabled: true;
  version: string;
  scope: Scope;
  memory_dir: string;
  project_path: string;
  scopes: { project: boolean; global: boolean };
  embeddings_available: boolean;
  counts: { nodes: number; edges: number };
}

export interface GraphNode {
  id: string;
  file_name: string;
  layer: 'deep' | 'lite';
  is_standalone: boolean;
  degree: number;
  superseded: boolean;
  tags: string[];
}

export interface GraphEdge {
  from_id: string;
  to_id: string;
  relation: Relation;
  weight: number;
  source: 'manual' | 'auto';
  reason: string | null;
  symmetric: boolean;
}

export interface GraphPayload {
  enabled: true;
  scope: Scope;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface EdgeSummary {
  id: string;
  file_name: string;
  relation: Relation;
  weight: number;
  reason: string | null;
  source: 'manual' | 'auto';
  direction: 'outgoing' | 'incoming';
}

export interface MemoryDetail {
  id: string;
  file_name: string;
  content: string;
  tags: string[];
  layer: 'deep' | 'lite';
  ref: string | null;
  source?: string;
  confidence?: number;
  importance?: number;
  created_at: number;
  updated_at: number;
  links?: { incoming: EdgeSummary[]; outgoing: EdgeSummary[] };
}

export interface MemoryListItem {
  id: string;
  file_name: string;
  content: string;
  tags: string[];
  layer: 'deep' | 'lite';
  ref: string | null;
  source: string;
  confidence: number;
  importance: number;
  created_at: number;
  updated_at: number;
  has_embedding: boolean;
}

export interface MemoryListPayload {
  enabled: true;
  scope: Scope;
  items: MemoryListItem[];
}

export interface Health {
  scope: Scope;
  nodes: { total: number; graph_capable: number; deep: number; lite_standalone: number; pointers: number };
  edges: { total: number; auto: number; manual: number; by_relation: Record<Relation, number>; related_to_share: number };
  orphans: { count: number; sample_ids: string[] };
  dangling_edges: { count: number; samples: Array<{ from_id: string; to_id: string; relation: string }> };
  hubs: { threshold: number; nodes: Array<{ id: string; file_name: string; degree: number }> };
  weight_histogram: Record<string, number>;
  dead_pointers: { count: number; ids: string[] };
}

export interface SearchResult {
  id: string;
  file_name: string;
  content: string;
  tags: string[];
  score: number;
  superseded: boolean;
  links?: { incoming: EdgeSummary[]; outgoing: EdgeSummary[] };
}

export interface QueryVia {
  seedId: string;
  relation: Relation;
  weight: number;
}

export interface QueryCandidate {
  id: string;
  file_name: string;
  score: number;
  preview: string;
  via: QueryVia | null;
}

export interface QueryResult {
  answer: string;
  sources: Array<{ id: string; relation?: Relation; weight?: number; role: string }>;
  candidates: QueryCandidate[];
}

export interface PathResult {
  from_id: string;
  to_id: string;
  found: boolean;
  strategy: 'shortest' | 'strongest';
  path: Array<{ id: string; file_name: string }>;
  edges: GraphEdge[];
  hops: number;
  total_weight: number;
  error?: string;
}

export interface ScatterPoint {
  id: string;
  file_name: string;
  x: number;
  y: number;
  layer: 'deep';
  source: string;
  tags: string[];
}

export interface ScatterPayload {
  points: ScatterPoint[];
  variance_explained: [number, number];
  n: number;
  ok: boolean;
}

export interface Disabled {
  enabled: false;
  scope: Scope;
  memory_dir: string;
}

export function isDisabled(value: unknown): value is Disabled {
  return Boolean(value && typeof value === 'object' && (value as { enabled?: unknown }).enabled === false);
}
