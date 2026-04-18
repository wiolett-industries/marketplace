import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { EntryRecord } from './entry.js';
import type { GraphEdgeRecord } from './graph.js';
import type { MemoryScope } from './scope.js';
import { getMemoryRoot } from './scope.js';

export function getMemoryDir(scope: MemoryScope = 'project'): string {
  const memoryDir = getMemoryRoot(scope);
  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
  }
  return memoryDir;
}

export function getMemoriesDir(scope: MemoryScope = 'project'): string {
  const memoriesDir = path.join(getMemoryDir(scope), 'memories');
  if (!existsSync(memoriesDir)) {
    mkdirSync(memoriesDir, { recursive: true });
  }
  return memoriesDir;
}

export function getEmbeddingsDir(scope: MemoryScope = 'project'): string {
  const embeddingsDir = path.join(getMemoryDir(scope), 'embeddings');
  if (!existsSync(embeddingsDir)) {
    mkdirSync(embeddingsDir, { recursive: true });
  }
  return embeddingsDir;
}

export function getGraphDir(scope: MemoryScope = 'project'): string {
  const graphDir = path.join(getMemoryDir(scope), 'graph');
  if (!existsSync(graphDir)) {
    mkdirSync(graphDir, { recursive: true });
  }
  return graphDir;
}

export function getLegacyEntriesDir(scope: MemoryScope = 'project'): string {
  return path.join(getMemoryDir(scope), 'entries');
}

function memoryFilePath(fileName: string, scope: MemoryScope): string {
  return path.join(getMemoriesDir(scope), `${fileName}.md`);
}

function embeddingFilePath(fileName: string, scope: MemoryScope): string {
  return path.join(getEmbeddingsDir(scope), `${fileName}.embeddings`);
}

function graphFilePath(fileName: string, scope: MemoryScope): string {
  return path.join(getGraphDir(scope), `${fileName}.edges.json`);
}

function atomicWrite(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, content, 'utf8');
  renameSync(tempPath, filePath);
}

function serializeMemory(entry: EntryRecord): string {
  const metadata = {
    id: entry.id,
    file_name: entry.file_name,
    tags: entry.tags,
    layer: entry.layer,
    ref: entry.ref,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };

  return `---\n${JSON.stringify(metadata, null, 2)}\n---\n${entry.content}\n`;
}

function parseMemory(markdown: string): Omit<EntryRecord, 'embedding'> | null {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return null;
  }

  const metadata = JSON.parse(match[1]) as Omit<EntryRecord, 'content' | 'embedding'>;
  return {
    ...metadata,
    content: match[2].replace(/\n$/, ''),
  };
}

export function writeEntryFile(entry: EntryRecord, scope: MemoryScope = 'project'): void {
  atomicWrite(memoryFilePath(entry.file_name, scope), serializeMemory(entry));
  atomicWrite(
    embeddingFilePath(entry.file_name, scope),
    JSON.stringify(
      {
        id: entry.id,
        file_name: entry.file_name,
        embedding: entry.embedding,
      },
      null,
      2
    )
  );
}

export function writeGraphFile(fileName: string, edges: GraphEdgeRecord[], scope: MemoryScope = 'project'): void {
  atomicWrite(
    graphFilePath(fileName, scope),
    JSON.stringify(
      {
        file_name: fileName,
        edges,
      },
      null,
      2
    )
  );
}

export function readEntryFileByFileName(fileName: string, scope: MemoryScope = 'project'): EntryRecord | null {
  const mdPath = memoryFilePath(fileName, scope);
  if (!existsSync(mdPath)) {
    return null;
  }

  const memory = parseMemory(readFileSync(mdPath, 'utf8'));
  if (!memory) {
    return null;
  }

  const embPath = embeddingFilePath(fileName, scope);
  const embeddingPayload = existsSync(embPath)
    ? JSON.parse(readFileSync(embPath, 'utf8')) as { embedding?: number[] }
    : { embedding: [] };

  return {
    ...memory,
    embedding: embeddingPayload.embedding ?? [],
  };
}

export function readEntryFile(id: string, scope: MemoryScope = 'project'): EntryRecord | null {
  const fileName = findFileNameById(id, scope);
  return fileName ? readEntryFileByFileName(fileName, scope) : null;
}

export function deleteEntryFile(entry: Pick<EntryRecord, 'id' | 'file_name'>, scope: MemoryScope = 'project'): void {
  const files = [
    memoryFilePath(entry.file_name, scope),
    embeddingFilePath(entry.file_name, scope),
  ];

  for (const filePath of files) {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }
}

export function deleteGraphFile(fileName: string, scope: MemoryScope = 'project'): void {
  const filePath = graphFilePath(fileName, scope);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

export function listEntryFileNames(scope: MemoryScope = 'project'): string[] {
  return readdirSync(getMemoriesDir(scope))
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.slice(0, -3))
    .sort();
}

export function listGraphFileNames(scope: MemoryScope = 'project'): string[] {
  return readdirSync(getGraphDir(scope))
    .filter((name) => name.endsWith('.edges.json'))
    .map((name) => name.slice(0, -11))
    .sort();
}

export function listEntryIds(scope: MemoryScope = 'project'): string[] {
  return listEntryFileNames(scope).map((fileName) => fileName.split('_')[0]);
}

export function findFileNameById(id: string, scope: MemoryScope = 'project'): string | null {
  return listEntryFileNames(scope).find((fileName) => fileName === id || fileName.startsWith(`${id}_`)) ?? null;
}

export function readGraphFile(fileName: string, scope: MemoryScope = 'project'): GraphEdgeRecord[] {
  const filePath = graphFilePath(fileName, scope);
  if (!existsSync(filePath)) {
    return [];
  }

  const payload = JSON.parse(readFileSync(filePath, 'utf8')) as {
    edges?: GraphEdgeRecord[];
  };

  return payload.edges ?? [];
}
