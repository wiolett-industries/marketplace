import { getEntryById, getPointerByRef, upsertEntry } from '../db.js';
import { embed } from '../embeddings.js';
import { buildPointerContent, hashEntry, normalizeTags, type EntryRecord } from '../entry.js';
import { writeEntryFile } from '../files.js';
import { evaluateMemoryWrite } from '../gate/write-gate.js';
import { refreshAutoLinks } from '../auto-link.js';
import type { MemoryScope } from '../scope.js';

export async function handleUpdate(args: {
  memory_id: string;
  content: string;
  tags?: string[];
  summary?: string;
  scope?: MemoryScope;
}) {
  const scope = args.scope ?? 'project';
  const existing = getEntryById(args.memory_id, scope);
  if (!existing || existing.layer !== 'deep') {
    throw new Error(`Memory "${args.memory_id}" does not exist or is not canonical.`);
  }

  const tags = normalizeTags(args.tags ?? existing.tags);
  const gate = await evaluateMemoryWrite({
    content: args.content.trim(),
    tags,
    scope,
    operation: 'update',
  });
  if (gate.decision === 'reject') {
    return { updated: false, gate };
  }

  const now = Date.now();
  const content = gate.decision === 'rewrite' && gate.normalized_content ? gate.normalized_content : args.content.trim();
  const next: EntryRecord = {
    ...existing,
    content,
    tags: gate.suggested_tags ?? tags,
    embedding: await embed(content),
    confidence: gate.confidence,
    importance: gate.importance,
    updated_at: now,
  };

  writeEntryFile(next, scope);
  upsertEntry(next, hashEntry(next), scope);

  const pointer = getPointerByRef(next.id, scope);
  if (pointer) {
    const nextPointer: EntryRecord = {
      ...pointer,
      content: buildPointerContent(next.id, content, args.summary),
      tags: next.tags,
      updated_at: now,
    };
    writeEntryFile(nextPointer, scope);
    upsertEntry(nextPointer, hashEntry(nextPointer), scope);
  }
  const autoLinks = await refreshAutoLinks(next, scope, { pruneIncoming: true });

  return {
    updated: true,
    id: next.id,
    auto_links: autoLinks.linked,
    gate,
  };
}
