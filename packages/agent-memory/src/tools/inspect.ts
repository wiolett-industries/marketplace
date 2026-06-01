import { getAllEdgeRows, getAllEntries, getEntryById, getLiteEntries } from '../db.js';
import { withoutEmbedding } from '../entry.js';
import { canParticipateInGraph } from '../graph.js';
import type { MemoryScope } from '../scope.js';
import { withLinks } from './graph.js';

export function handleInspect(args: {
  scope?: MemoryScope;
  view?: 'memory' | 'index' | 'graph' | 'all';
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
