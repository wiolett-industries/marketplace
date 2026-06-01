import type { EntryLayer, EntryRecord, EntryRow } from './entry.js';
import type { MemoryScope } from './scope.js';
import { closeDb, getDb, getDbPath, resetDbCacheFiles } from './storage/connection.js';
import { deleteEdgesForEntry, deleteIncomingAutoEdges, getAllEdgeRows, getEdgeSummaries, getFilteredEdgeRows, getNeighborSummaries, getOutgoingEdgeRecords, replaceAutoOutgoingEdges, replaceOutgoingEdges } from './storage/edges.js';
import { deleteIndexById, deleteIndexForMemory, getIndexById, getIndexByMemoryId, getLiteEntries, upsertIndexEntry } from './storage/index-records.js';
import { deleteMemory, getAllMemoryIds, getDeepEntries, getMemoryById, getMemoryHash, searchMemoriesFTS, upsertMemory } from './storage/memories.js';

export { closeDb, getDb, getDbPath, resetDbCacheFiles };
export { deleteEdgesForEntry, deleteIncomingAutoEdges, getAllEdgeRows, getEdgeSummaries, getFilteredEdgeRows, getNeighborSummaries, getOutgoingEdgeRecords, replaceAutoOutgoingEdges, replaceOutgoingEdges };
export { getLiteEntries, getDeepEntries };

export function upsertEntry(entry: EntryRecord, hash: string, scope: MemoryScope = 'project'): void {
  if (entry.layer === 'lite') {
    upsertIndexEntry(entry, scope);
    return;
  }
  upsertMemory(entry, hash, scope);
}

export function getEntryById(id: string, scope: MemoryScope = 'project'): EntryRecord | null {
  return getMemoryById(id, scope) ?? getIndexById(id, scope);
}

export function getEntryHash(id: string, scope: MemoryScope = 'project'): string | null {
  return getMemoryHash(id, scope);
}

export function getPointerByRef(ref: string, scope: MemoryScope = 'project'): EntryRecord | null {
  return getIndexByMemoryId(ref, scope);
}

export function deleteEntryFromDb(id: string, scope: MemoryScope = 'project'): boolean {
  const entry = getEntryById(id, scope);
  if (!entry) return false;
  deleteEdgesForEntry(id, scope);
  if (entry.layer === 'lite') return deleteIndexById(id, scope);
  deleteIndexForMemory(id, scope);
  return deleteMemory(id, scope);
}

export function getAllDbIds(scope: MemoryScope = 'project'): string[] {
  return [...getAllMemoryIds(scope), ...getLiteEntries(scope).map((entry) => entry.id)];
}

export function getEntries(layer: EntryLayer, scope: MemoryScope = 'project'): EntryRecord[] {
  return layer === 'deep' ? getDeepEntries(scope) : getLiteEntries(scope);
}

export function getAllEntries(scope: MemoryScope = 'project'): Omit<EntryRecord, 'embedding'>[] {
  return [...getDeepEntries(scope), ...getLiteEntries(scope)]
    .sort((left, right) => right.updated_at - left.updated_at)
    .map((entry) => {
      const { embedding: _embedding, ...rest } = entry;
      return rest;
    });
}

export function getAllRows(scope: MemoryScope = 'project'): EntryRow[] {
  return [...getDeepEntries(scope), ...getLiteEntries(scope)].map((entry) => ({
    id: entry.id,
    file_name: entry.file_name,
    content: entry.content,
    tags: JSON.stringify(entry.tags),
    layer: entry.layer,
    ref: entry.ref,
    hash: getEntryHash(entry.id, scope),
    embedding: JSON.stringify(entry.embedding),
    source: entry.source,
    confidence: entry.confidence,
    importance: entry.importance,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  }));
}

export function searchFTS(query: string, layer: EntryLayer = 'deep', scope: MemoryScope = 'project'): Map<string, number> {
  if (layer !== 'deep') return new Map();
  return searchMemoriesFTS(query, scope);
}
