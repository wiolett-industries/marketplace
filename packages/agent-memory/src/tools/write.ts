import { getDeepEntries, getLiteEntries, getPointerByRef, upsertEntry } from '../db.js';
import { embed } from '../embeddings.js';
import { writeEntryFile } from '../files.js';
import { buildPointerContent, hashEntry, normalizeTags, type EntryRecord } from '../entry.js';
import { createEntryIdentity } from '../naming.js';
import type { MemoryScope } from '../scope.js';

interface WriteArgs {
  content: string;
  tags?: string[];
  summary?: string;
  layer?: 'lite' | 'deep';
  scope?: MemoryScope;
}

interface WriteResult {
  id: string;
  pointer_id?: string;
  action: 'created' | 'updated';
}

function persist(entry: EntryRecord, scope: MemoryScope): void {
  writeEntryFile(entry, scope);
  upsertEntry(entry, hashEntry(entry), scope);
}

export async function handleWrite(args: WriteArgs): Promise<WriteResult> {
  const content = args.content.trim();
  const layer = args.layer ?? 'deep';
  const scope = args.scope ?? 'project';
  const tags = normalizeTags(args.tags ?? []);
  const now = Date.now();

  if (layer === 'lite') {
    const existing = getLiteEntries(scope).find((entry) => entry.ref === null && entry.content === content);
    const identity = existing ?? await createEntryIdentity(content, tags);
    const entry: EntryRecord = {
      id: identity.id,
      file_name: identity.file_name,
      content,
      tags,
      layer: 'lite',
      ref: null,
      embedding: await embed(content),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    persist(entry, scope);
    return { id: entry.id, action: existing ? 'updated' : 'created' };
  }

  const existingDeep = getDeepEntries(scope).find((entry) => entry.content === content);
  const deepIdentity = existingDeep ?? await createEntryIdentity(args.summary?.trim() || content, tags);
  const deepEntry: EntryRecord = {
    id: deepIdentity.id,
    file_name: deepIdentity.file_name,
    content,
    tags,
    layer: 'deep',
    ref: null,
    embedding: await embed(content),
    created_at: existingDeep?.created_at ?? now,
    updated_at: now,
  };

  persist(deepEntry, scope);

  const existingPointer = getPointerByRef(deepEntry.id, scope);
  const pointerIdentity = existingPointer ?? await createEntryIdentity(args.summary?.trim() || content, tags);
  const pointerEntry: EntryRecord = {
    id: pointerIdentity.id,
    file_name: pointerIdentity.file_name,
    content: buildPointerContent(deepEntry.id, content, args.summary),
    tags,
    layer: 'lite',
    ref: deepEntry.id,
    embedding: [],
    created_at: existingPointer?.created_at ?? now,
    updated_at: now,
  };

  persist(pointerEntry, scope);

  return {
    id: deepEntry.id,
    pointer_id: pointerEntry.id,
    action: existingDeep ? 'updated' : 'created',
  };
}
