import { getAllEntries, getEntryById } from '../db.js';
import { withLinks } from './graph.js';
import type { MemoryScope } from '../scope.js';

export function handleReadAll(scope: MemoryScope = 'project') {
  return getAllEntries(scope).map((entry) => {
    if (entry.layer !== 'deep') {
      return entry;
    }

    const fullEntry = getEntryById(entry.id, scope);
    return fullEntry ? withLinks(fullEntry, scope) : entry;
  });
}
