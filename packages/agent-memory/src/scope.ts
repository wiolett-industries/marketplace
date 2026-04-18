import os from 'node:os';
import path from 'node:path';

export type MemoryScope = 'project' | 'global';

export function getAgentsHome(): string {
  const configured = process.env.PROJECT_MEMORY_AGENTS_HOME?.trim();
  if (configured) {
    return configured;
  }

  return path.join(os.homedir(), '.agents');
}

export function getGlobalMemoryRoot(): string {
  const configured = process.env.PROJECT_MEMORY_GLOBAL_ROOT?.trim();
  if (configured) {
    return configured;
  }

  return path.join(getAgentsHome(), 'agent-memory');
}

export function getMemoryRoot(scope: MemoryScope = 'project', projectPath: string = process.cwd()): string {
  return scope === 'global' ? getGlobalMemoryRoot() : path.join(projectPath, '.memory');
}

export function getScopeLabel(scope: MemoryScope): string {
  return scope === 'global' ? 'global' : 'project';
}
