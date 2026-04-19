import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { replaceOutgoingEdges, resetDbCacheFiles, upsertEntry } from './db.js';
import { getEmbeddingsDir, getGraphDir, getLegacyEntriesDir, getMemoriesDir, listEntryFileNames, listGraphFileNames, readEntryFileByFileName, readGraphFile, writeEntryFile } from './files.js';
import type { GraphEdgeRecord } from './graph.js';
import { isGraphRelation, normalizeWeight } from './graph.js';
import { createLegacyFileName, remapLegacyIds } from './naming.js';
import { hashEntry } from './entry.js';
import type { MemoryScope } from './scope.js';

function remapLegacyPointerContent(content: string, ref: string): string {
  const match = content.match(/^\[→ [^\]]+\]\s*([\s\S]*)$/);
  const summary = match ? match[1].trimStart() : content.trim();
  return summary ? `[→ ${ref}] ${summary}` : `[→ ${ref}]`;
}

function pointerSummary(content: string): string {
  const match = content.match(/^\[→ [^\]]+\]\s*([\s\S]*)$/);
  return match ? match[1].trimStart() : content;
}

function migrateLegacyJsonFilesToSplitFiles(scope: MemoryScope): void {
  const legacyDir = getLegacyEntriesDir(scope);
  if (!existsSync(legacyDir)) {
    return;
  }

  const hasNewFiles = listEntryFileNames(scope).length > 0;
  if (hasNewFiles) {
    return;
  }

  const legacyFiles = readdirSync(legacyDir).filter((name) => name.endsWith('.json')).sort();
  if (legacyFiles.length === 0) {
    return;
  }

  process.stderr.write(`[agent-memory] migrating ${legacyFiles.length} legacy JSON entries to split files...\n`);

  const rawEntries = legacyFiles.map((fileName) => JSON.parse(readFileSync(`${legacyDir}/${fileName}`, 'utf8')) as {
      id: string;
      content: string;
      tags: string[];
      layer: 'lite' | 'deep';
      ref: string | null;
      embedding: number[];
      created_at: number;
      updated_at: number;
    });
  const idMap = remapLegacyIds(rawEntries.map((entry) => entry.id));

  for (const raw of rawEntries) {
    const id = idMap.get(raw.id) ?? raw.id;
    const ref = raw.ref ? (idMap.get(raw.ref) ?? raw.ref) : null;
    const content = raw.layer === 'lite' && ref
      ? remapLegacyPointerContent(raw.content, ref)
      : raw.content;
    const slugSourceContent = raw.layer === 'lite' && ref
      ? pointerSummary(content)
      : content;

    writeEntryFile({
      ...raw,
      id,
      ref,
      content,
      file_name: createLegacyFileName(id, slugSourceContent, raw.tags),
    }, scope);
  }

  process.stderr.write('[agent-memory] legacy JSON migration complete.\n');
}

export function rebuildFromFiles(scope: MemoryScope = 'project'): void {
  getMemoriesDir(scope);
  getEmbeddingsDir(scope);
  getGraphDir(scope);
  migrateLegacyJsonFilesToSplitFiles(scope);
  resetDbCacheFiles(scope);

  const fileNames = listEntryFileNames(scope);
  const deepIds = new Set<string>();

  for (const fileName of fileNames) {
    const entry = readEntryFileByFileName(fileName, scope);
    if (!entry) {
      continue;
    }

    if (entry.layer === 'deep') {
      deepIds.add(entry.id);
    }

    upsertEntry(entry, hashEntry(entry), scope);
  }

  const graphFileNames = new Set(listGraphFileNames(scope));
  for (const fileName of fileNames) {
    const entry = readEntryFileByFileName(fileName, scope);
    if (!entry || entry.layer !== 'deep') {
      continue;
    }

    if (!graphFileNames.has(entry.file_name)) {
      replaceOutgoingEdges(entry.id, [], scope);
    }
  }

  for (const graphFileName of graphFileNames) {
    const owner = readEntryFileByFileName(graphFileName, scope);
    if (!owner) {
      process.stderr.write(`[agent-memory] skipping graph file for missing memory "${graphFileName}".\n`);
      continue;
    }

    if (owner.layer !== 'deep') {
      process.stderr.write(`[agent-memory] skipping graph file for non-deep memory "${owner.id}".\n`);
      replaceOutgoingEdges(owner.id, [], scope);
      continue;
    }

    const validEdges: GraphEdgeRecord[] = [];
    for (const edge of readGraphFile(graphFileName, scope)) {
      if (edge.from_id !== owner.id) {
        process.stderr.write(`[agent-memory] skipping graph edge with mismatched source in "${graphFileName}".\n`);
        continue;
      }

      if (!isGraphRelation(edge.relation)) {
        process.stderr.write(`[agent-memory] skipping graph edge with invalid relation "${edge.relation}".\n`);
        continue;
      }

      if (!deepIds.has(edge.to_id)) {
        process.stderr.write(`[agent-memory] skipping dangling graph edge ${edge.from_id} -> ${edge.to_id}.\n`);
        continue;
      }

      try {
        validEdges.push({
          ...edge,
          weight: normalizeWeight(edge.weight),
        });
      } catch {
        process.stderr.write(`[agent-memory] skipping graph edge with invalid weight from "${edge.from_id}" to "${edge.to_id}".\n`);
      }
    }

    replaceOutgoingEdges(owner.id, validEdges, scope);
  }
}
