import { randomUUID } from 'node:crypto';
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getAgentsHome } from './scope.js';

const REGISTRY_VERSION = 1;
const LOCK_WAIT_MS = 25;
const LOCK_TIMEOUT_MS = 5_000;
const STALE_LOCK_MS = 60_000;

export interface ProjectMemoryReference {
  project_path: string;
  memory_root: string;
  first_seen_at: string;
  last_seen_at: string;
}

interface ProjectMemoryRegistry {
  version: typeof REGISTRY_VERSION;
  projects: ProjectMemoryReference[];
}

export function getProjectMemoryRegistryPath(): string {
  return path.join(getAgentsHome(), '.wiolett', 'agent-memory', 'projects.json');
}

export function listProjectMemoryReferences(): ProjectMemoryReference[] {
  return readRegistry().projects;
}

/**
 * Register a project only after a project-memory operation has persisted at
 * least one entry. The registry is local metadata, not semantic global memory.
 */
export async function registerProjectMemory(projectPath: string, memoryRoot: string, now = new Date()): Promise<ProjectMemoryReference> {
  return registerProjectMemoryWithTimeout(projectPath, memoryRoot, now, LOCK_TIMEOUT_MS);
}

/**
 * Registry discovery must never change the result of a durable memory write.
 * If another process currently owns the registry lock, a later write/startup
 * will retry instead of blocking or reporting the memory write as failed.
 */
export async function registerProjectMemoryBestEffort(projectPath: string, memoryRoot: string, now = new Date()): Promise<ProjectMemoryReference | null> {
  try {
    return await registerProjectMemoryWithTimeout(projectPath, memoryRoot, now, 0);
  } catch {
    return null;
  }
}

async function registerProjectMemoryWithTimeout(projectPath: string, memoryRoot: string, now: Date, lockTimeoutMs: number): Promise<ProjectMemoryReference> {
  const project_path = canonicalPath(projectPath);
  const memory_root = canonicalPath(memoryRoot);
  const timestamp = now.toISOString();

  return withRegistryLock(() => {
    const registry = readRegistry();
    const existing = registry.projects.find((project) => project.project_path === project_path);
    const reference: ProjectMemoryReference = existing
      ? { ...existing, memory_root, last_seen_at: timestamp }
      : { project_path, memory_root, first_seen_at: timestamp, last_seen_at: timestamp };
    const projects = [
      ...registry.projects.filter((project) => project.project_path !== project_path),
      reference,
    ].sort((left, right) => left.project_path.localeCompare(right.project_path));
    writeRegistry({ version: REGISTRY_VERSION, projects });
    return reference;
  }, lockTimeoutMs);
}

/**
 * Register an already-populated project on process startup without creating a
 * store or registering an empty setup directory.
 */
export async function registerExistingProjectMemory(projectPath: string, memoryRoot: string): Promise<ProjectMemoryReference | null> {
  if (!hasPersistedMemory(memoryRoot)) return null;
  return registerProjectMemory(projectPath, memoryRoot);
}

/** Register a discovered store without delaying a read-only MCP startup. */
export async function registerExistingProjectMemoryBestEffort(projectPath: string, memoryRoot: string): Promise<ProjectMemoryReference | null> {
  if (!hasPersistedMemory(memoryRoot)) return null;
  return registerProjectMemoryBestEffort(projectPath, memoryRoot);
}

function hasPersistedMemory(memoryRoot: string): boolean {
  return [
    { directory: 'memories', extension: '.md' },
    { directory: 'index', extension: '.md' },
    { directory: 'entries', extension: '.json' },
  ].some(({ directory, extension }) => {
    const target = path.join(memoryRoot, directory);
    if (!existsSync(target)) return false;
    try {
      return statSync(target).isDirectory() && readdirHasMemoryFiles(target, extension);
    } catch {
      return false;
    }
  });
}

function readdirHasMemoryFiles(directory: string, extension: string): boolean {
  // Avoid importing the memory file helpers: they create missing directories.
  return readdirSync(directory, { withFileTypes: true }).some((entry) => entry.isFile() && entry.name.endsWith(extension));
}

function readRegistry(): ProjectMemoryRegistry {
  const registryPath = getProjectMemoryRegistryPath();
  if (!existsSync(registryPath)) return { version: REGISTRY_VERSION, projects: [] };

  let value: unknown;
  try {
    value = JSON.parse(readFileSync(registryPath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid project-memory registry at ${registryPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid project-memory registry at ${registryPath}: expected an object.`);
  }
  const record = value as { version?: unknown; projects?: unknown };
  if (record.version !== REGISTRY_VERSION || !Array.isArray(record.projects)) {
    throw new Error(`Invalid project-memory registry at ${registryPath}: unsupported shape.`);
  }
  const projects = record.projects.map(parseReference);
  return { version: REGISTRY_VERSION, projects: projects.sort((left, right) => left.project_path.localeCompare(right.project_path)) };
}

function parseReference(value: unknown): ProjectMemoryReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid project-memory registry entry.');
  const record = value as Partial<ProjectMemoryReference>;
  if (
    typeof record.project_path !== 'string' || !path.isAbsolute(record.project_path)
    || typeof record.memory_root !== 'string' || !path.isAbsolute(record.memory_root)
    || typeof record.first_seen_at !== 'string' || Number.isNaN(Date.parse(record.first_seen_at))
    || typeof record.last_seen_at !== 'string' || Number.isNaN(Date.parse(record.last_seen_at))
  ) {
    throw new Error('Invalid project-memory registry entry.');
  }
  return {
    project_path: canonicalPath(record.project_path),
    memory_root: canonicalPath(record.memory_root),
    first_seen_at: record.first_seen_at,
    last_seen_at: record.last_seen_at,
  };
}

function canonicalPath(value: string): string {
  const resolved = path.resolve(value);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function writeRegistry(registry: ProjectMemoryRegistry): void {
  const registryPath = getProjectMemoryRegistryPath();
  const registryDir = path.dirname(registryPath);
  mkdirSync(registryDir, { recursive: true, mode: 0o700 });
  chmodSync(registryDir, 0o700);
  const temporaryPath = path.join(registryDir, `.${path.basename(registryPath)}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(temporaryPath, registryPath);
    chmodSync(registryPath, 0o600);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}

async function withRegistryLock<T>(action: () => T, lockTimeoutMs: number): Promise<T> {
  const registryPath = getProjectMemoryRegistryPath();
  const lockPath = `${registryPath}.lock`;
  mkdirSync(path.dirname(lockPath), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + lockTimeoutMs;

  while (true) {
    try {
      const descriptor = openSync(lockPath, 'wx', 0o600);
      try {
        writeFileSync(descriptor, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }));
      } finally {
        closeSync(descriptor);
      }
      try {
        return action();
      } finally {
        if (existsSync(lockPath)) unlinkSync(lockPath);
      }
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      if (isStaleLock(lockPath)) {
        try { unlinkSync(lockPath); } catch { /* Another process released it first. */ }
        continue;
      }
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for project-memory registry lock: ${lockPath}`);
      await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_MS));
    }
  }
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'EEXIST');
}

function isStaleLock(lockPath: string): boolean {
  try {
    return Date.now() - statSync(lockPath).mtimeMs > STALE_LOCK_MS;
  } catch {
    return false;
  }
}
