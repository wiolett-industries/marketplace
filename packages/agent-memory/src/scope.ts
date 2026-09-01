import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { getBootstrapAgentsHome, readMcpConfig, resolveConfiguredPath } from './config.js';

export type MemoryScope = 'project' | 'global';

const projectRootStorage = new AsyncLocalStorage<string>();

function resolveExplicitProjectRoot(projectPath: string): string {
  if (!path.isAbsolute(projectPath)) {
    throw new Error('workspace_root must be an absolute path');
  }
  return path.resolve(projectPath);
}

export function getAgentsHome(): string {
  const bootstrapHome = getBootstrapAgentsHome();
  const configured = readMcpConfig()?.mcp['agent-memory']?.runtime?.home;
  return configured ? resolveConfiguredPath(configured, bootstrapHome) : bootstrapHome;
}

export function getGlobalMemoryRoot(): string {
  const configured = process.env.PROJECT_MEMORY_GLOBAL_ROOT?.trim();
  if (configured) {
    return configured;
  }
  const storage = readMcpConfig()?.mcp['agent-memory']?.storage?.memory.global ?? '.wiolett/global-memory';
  return resolveConfiguredPath(storage, getAgentsHome());
}

function hasProjectMemoryLayout(projectPath: string): boolean {
  const memoryDir = getProjectMemoryRoot(projectPath);
  return (
    existsSync(path.join(memoryDir, 'memories')) ||
    existsSync(path.join(memoryDir, 'index')) ||
    existsSync(path.join(memoryDir, 'embeddings')) ||
    existsSync(path.join(memoryDir, 'graph')) ||
    existsSync(path.join(memoryDir, 'entries')) ||
    existsSync(path.join(memoryDir, 'memory.db'))
  );
}

function nearestProjectBase(startPath: string): string {
  const start = path.resolve(startPath);
  let gitRoot: string | null = null;
  let current = start;

  while (true) {
    if (isGitBoundary(current)) {
      gitRoot = current;
      break;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  // Without a repository boundary, ancestor memory is ambiguous: a shared
  // parent such as /tmp may belong to an unrelated project. Non-repository
  // callers can still target a parent explicitly through workspace_root or
  // PROJECT_MEMORY_PROJECT_ROOT.
  if (!gitRoot) return start;

  current = start;
  while (true) {
    if (hasProjectMemoryLayout(current)) return current;
    if (current === gitRoot) return gitRoot;
    current = path.dirname(current);
  }
}

function isGitBoundary(projectPath: string): boolean {
  const marker = path.join(projectPath, '.git');
  if (!existsSync(marker)) return false;
  try {
    const info = statSync(marker);
    return info.isFile() || (info.isDirectory() && existsSync(path.join(marker, 'HEAD')));
  } catch {
    return false;
  }
}

export function getProjectRoot(projectPath?: string): string {
  const explicit = projectPath?.trim();
  if (explicit) {
    return resolveExplicitProjectRoot(explicit);
  }

  const active = projectRootStorage.getStore();
  if (active) {
    return active;
  }

  const configured = process.env.PROJECT_MEMORY_PROJECT_ROOT?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  return nearestProjectBase(process.cwd());
}

export function withProjectRoot<T>(projectPath: string | undefined, fn: () => T): T {
  const explicit = projectPath?.trim();
  if (!explicit) {
    return fn();
  }

  return projectRootStorage.run(resolveExplicitProjectRoot(explicit), fn);
}

export async function withProjectRootAsync<T>(projectPath: string | undefined, fn: () => Promise<T>): Promise<T> {
  const explicit = projectPath?.trim();
  if (!explicit) {
    return fn();
  }

  return projectRootStorage.run(resolveExplicitProjectRoot(explicit), fn);
}

export function getMemoryRoot(scope: MemoryScope = 'project', projectPath?: string): string {
  return scope === 'global' ? getGlobalMemoryRoot() : getProjectMemoryRoot(getProjectRoot(projectPath));
}

function getProjectMemoryRoot(projectRoot: string): string {
  const configured = readMcpConfig()?.mcp['agent-memory']?.storage?.memory.project ?? '.memory';
  return resolveConfiguredPath(configured, projectRoot);
}

export function getScopeLabel(scope: MemoryScope): string {
  return scope === 'global' ? 'global' : 'project';
}
