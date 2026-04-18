import { deleteEntryFromDb, getEntryById, getPointerByRef } from '../db.js';
import { deleteEntryFile } from '../files.js';
import { pruneGraphFilesForDeletedEntry } from './graph.js';
import type { MemoryScope } from '../scope.js';

export function handleDelete(args: { id: string; scope?: MemoryScope }): { deleted: boolean } {
  const scope = args.scope ?? 'project';
  const entry = getEntryById(args.id, scope);
  if (!entry) {
    return { deleted: false };
  }

  if (entry.layer === 'deep') {
    const pointer = getPointerByRef(args.id, scope);
    if (pointer) {
      deleteEntryFile(pointer, scope);
    }
  }

  if (entry.layer === 'deep') {
    pruneGraphFilesForDeletedEntry(entry, scope);
  }

  deleteEntryFile(entry, scope);
  return { deleted: deleteEntryFromDb(args.id, scope) };
}
