import { createHash } from 'node:crypto';
import type { GraphLinks } from './graph.js';

export type EntryLayer = 'lite' | 'deep';

export interface EntryRecord {
  id: string;
  file_name: string;
  content: string;
  tags: string[];
  layer: EntryLayer;
  ref: string | null;
  embedding: number[];
  created_at: number;
  updated_at: number;
}

export type EntryWithoutEmbedding = Omit<EntryRecord, 'embedding'>;
export type EntryWithLinks = EntryWithoutEmbedding & { links: GraphLinks };

export interface EntryRow {
  id: string;
  file_name: string | null;
  content: string;
  tags: string;
  layer: string;
  ref: string | null;
  hash: string | null;
  embedding: string;
  created_at: number;
  updated_at: number;
}

export function normalizeTags(tags: string[] = []): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  ).sort();
}

export function buildPointerContent(id: string, content: string, summary?: string): string {
  const pointerText = summary?.trim() || (content.length > 160 ? `${content.slice(0, 157)}...` : content);
  return `[→ ${id}] ${pointerText}`;
}

export function hashEntry(entry: Pick<EntryRecord, 'file_name' | 'content' | 'tags' | 'layer' | 'ref' | 'embedding'>): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        file_name: entry.file_name,
        content: entry.content,
        tags: entry.tags,
        layer: entry.layer,
        ref: entry.ref,
        embedding: entry.embedding,
      }),
      'utf8'
    )
    .digest('hex');
}

export function parseEntryRow(row: EntryRow): EntryRecord {
  return {
    id: row.id,
    file_name: row.file_name ?? row.id,
    content: row.content,
    tags: JSON.parse(row.tags) as string[],
    layer: row.layer as EntryLayer,
    ref: row.ref ?? null,
    embedding: JSON.parse(row.embedding) as number[],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function withoutEmbedding<T extends { embedding: number[] }>(entry: T): Omit<T, 'embedding'> {
  const { embedding: _embedding, ...rest } = entry;
  return rest;
}
