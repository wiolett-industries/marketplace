import { getAllEdgeRows, getAllEntries, getDeepEntries, getIncomingSupersededIds, getLiteEntries } from '../db.js';
import type { MemorySource } from '../entry.js';
import { isSymmetricRelation } from '../graph.js';
import type { GraphRelation } from '../graph.js';
import { getMemoryRoot } from '../scope.js';
import type { MemoryScope } from '../scope.js';
import { detectMemoryState, ensureMemoryReadable } from '../runtime.js';
import { handleInspect } from '../tools/inspect.js';
import { handleSearch } from '../tools/search.js';
import { handleQuery } from '../tools/query.js';
import { handlePath } from '../tools/path.js';
import type { PathStrategy } from '../tools/path.js';
import type { GraphDirection } from '../graph.js';
import { buildScatter } from './scatter.js';

export interface Disabled {
  enabled: false;
  scope: MemoryScope;
  memory_dir: string;
}

export type ApiResult<T> = T | Disabled;

function disabled(scope: MemoryScope): Disabled {
  return { enabled: false, scope, memory_dir: getMemoryRoot(scope) };
}

function readable(scope: MemoryScope): boolean {
  return ensureMemoryReadable(scope);
}

export interface MetaPayload {
  enabled: true;
  version: string;
  scope: MemoryScope;
  memory_dir: string;
  project_path: string;
  scopes: { project: boolean; global: boolean };
  embeddings_available: boolean;
  counts: { nodes: number; edges: number };
}

export function getMeta(version: string, scope: MemoryScope): MetaPayload {
  const projectState = detectMemoryState('project');
  const globalState = detectMemoryState('global');
  const enabled = readable(scope);
  const entries = enabled ? getAllEntries(scope) : [];
  const edges = enabled ? getAllEdgeRows(scope) : [];
  const embeddingsAvailable = enabled && entries.length > 0 && hasEmbeddings(scope);

  return {
    enabled: true,
    version,
    scope,
    memory_dir: getMemoryRoot(scope),
    project_path: process.cwd(),
    scopes: { project: projectState.enabled, global: globalState.enabled },
    embeddings_available: embeddingsAvailable,
    counts: { nodes: entries.length, edges: edges.length },
  };
}

function hasEmbeddings(scope: MemoryScope): boolean {
  // Cheap probe: at least two deep entries carry an embedding. Avoids running the
  // full PCA (buildScatter) on every /api/meta, which is polled on each SSE change.
  let count = 0;
  for (const entry of getDeepEntries(scope)) {
    if (entry.embedding.length > 0) {
      count += 1;
      if (count >= 2) return true;
    }
  }
  return false;
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
  relation: GraphRelation;
  weight: number;
  source: 'manual' | 'auto';
  reason: string | null;
  symmetric: boolean;
}

export interface GraphPayload {
  enabled: true;
  scope: MemoryScope;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function getGraphPayload(scope: MemoryScope): ApiResult<GraphPayload> {
  if (!readable(scope)) return disabled(scope);

  const entries = getAllEntries(scope);
  const rawEdges = getAllEdgeRows(scope);
  const supersededIds = getIncomingSupersededIds(entries.map((entry) => entry.id), scope);

  // Collapse the two physical directed rows of a symmetric relation into one
  // logical undirected edge so the canvas does not draw a doubled line.
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const edge of rawEdges) {
    const symmetric = isSymmetricRelation(edge.relation);
    if (symmetric) {
      const pair = [edge.from_id, edge.to_id].sort().join('|');
      const key = `${pair}:${edge.relation}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    edges.push({
      from_id: edge.from_id,
      to_id: edge.to_id,
      relation: edge.relation,
      weight: edge.weight,
      source: edge.source,
      reason: edge.reason,
      symmetric,
    });
  }

  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.from_id, (degree.get(edge.from_id) ?? 0) + 1);
    degree.set(edge.to_id, (degree.get(edge.to_id) ?? 0) + 1);
  }

  const nodes: GraphNode[] = entries.map((entry) => ({
    id: entry.id,
    file_name: entry.file_name,
    layer: entry.layer,
    is_standalone: entry.layer === 'lite' && entry.ref === null,
    degree: degree.get(entry.id) ?? 0,
    superseded: supersededIds.has(entry.id),
    tags: entry.tags,
  }));

  return { enabled: true, scope, nodes, edges };
}

export function getMemoryDetail(id: string, scope: MemoryScope): ApiResult<unknown> | null {
  if (!readable(scope)) return disabled(scope);
  try {
    return handleInspect({ scope, memory_id: id });
  } catch {
    return null;
  }
}

export function getHealth(scope: MemoryScope): ApiResult<unknown> {
  if (!readable(scope)) return disabled(scope);
  return handleInspect({ scope, view: 'health' });
}

export async function runSearch(query: string, limit: number, scope: MemoryScope): Promise<ApiResult<unknown>> {
  if (!readable(scope)) return disabled(scope);
  return handleSearch({ query, limit, scope });
}

export async function runQuery(args: {
  query: string;
  scope: MemoryScope;
  limit?: number;
  detail?: 'brief' | 'normal' | 'full';
  expand?: boolean;
  expand_hops?: number;
}): Promise<ApiResult<unknown>> {
  if (!readable(args.scope)) return disabled(args.scope);
  return handleQuery(args);
}

export function runPath(args: {
  from_id: string;
  to_id: string;
  scope: MemoryScope;
  direction?: GraphDirection;
  strategy?: PathStrategy;
  min_weight?: number;
}): ApiResult<unknown> {
  if (!readable(args.scope)) return disabled(args.scope);
  try {
    return handlePath(args);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'path failed', found: false } as unknown as ApiResult<unknown>;
  }
}

export function getScatter(scope: MemoryScope): ApiResult<ReturnType<typeof buildScatter>> {
  if (!readable(scope)) return disabled(scope);
  return buildScatter(scope);
}

export interface MemoryListItem {
  id: string;
  file_name: string;
  content: string;
  tags: string[];
  layer: 'deep' | 'lite';
  ref: string | null;
  source: MemorySource;
  confidence: number;
  importance: number;
  created_at: number;
  updated_at: number;
  has_embedding: boolean;
}

export function getMemoryList(scope: MemoryScope): ApiResult<{ enabled: true; scope: MemoryScope; items: MemoryListItem[] }> {
  if (!readable(scope)) return disabled(scope);

  const items: MemoryListItem[] = [
    ...getDeepEntries(scope).map((entry) => toListItem(entry, entry.embedding.length > 0)),
    ...getLiteEntries(scope).map((entry) => toListItem(entry, false)),
  ].sort((left, right) => right.updated_at - left.updated_at);

  return { enabled: true, scope, items };
}

function toListItem(
  entry: {
    id: string;
    file_name: string;
    content: string;
    tags: string[];
    layer: 'deep' | 'lite';
    ref: string | null;
    source?: MemorySource;
    confidence?: number;
    importance?: number;
    created_at: number;
    updated_at: number;
  },
  hasEmbedding: boolean,
): MemoryListItem {
  return {
    id: entry.id,
    file_name: entry.file_name,
    content: entry.content,
    tags: entry.tags,
    layer: entry.layer,
    ref: entry.ref,
    source: entry.source ?? 'model_inferred',
    confidence: entry.confidence ?? 0.5,
    importance: entry.importance ?? 0.5,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    has_embedding: hasEmbedding,
  };
}

export function getScopes(): { project: boolean; global: boolean } {
  return { project: detectMemoryState('project').enabled, global: detectMemoryState('global').enabled };
}
