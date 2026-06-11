import type {
  GraphPayload,
  Health,
  Meta,
  MemoryDetail,
  MemoryListPayload,
  PathResult,
  QueryResult,
  ScatterPayload,
  Scope,
  SearchResult,
} from '../types';

async function getJson<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetch(url.toString());
  if (!response.ok && response.status !== 404) {
    throw new Error(`${path} → ${response.status}`);
  }
  return (await response.json()) as T;
}

export const api = {
  meta: (scope: Scope) => getJson<Meta>('/api/meta', { scope }),
  scopes: () => getJson<{ project: boolean; global: boolean }>('/api/scopes'),
  graph: (scope: Scope) => getJson<GraphPayload>('/api/graph', { scope }),
  list: (scope: Scope) => getJson<MemoryListPayload>('/api/list', { scope }),
  memory: (id: string, scope: Scope) => getJson<MemoryDetail>(`/api/memory/${encodeURIComponent(id)}`, { scope }),
  health: (scope: Scope) => getJson<Health>('/api/health', { scope }),
  scatter: (scope: Scope) => getJson<ScatterPayload>('/api/scatter', { scope }),
  search: (q: string, scope: Scope, limit = 12) => getJson<SearchResult[]>('/api/search', { q, scope, limit }),
  query: (q: string, scope: Scope, expand = true, hops = 1) =>
    getJson<QueryResult>('/api/query', { q, scope, expand: String(expand), hops }),
  path: (from: string, to: string, scope: Scope, strategy: string, direction: string) =>
    getJson<PathResult>('/api/path', { from, to, scope, strategy, direction }),
};
