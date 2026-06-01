import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export function resolveWorkspaceRoot(workspaceRoot?: string): string {
  const start = path.resolve(workspaceRoot || process.cwd());
  const gitRoot = findUp(start, '.git');
  return gitRoot || start;
}

export function workflowRoot(workspaceRoot?: string): string {
  return path.join(resolveWorkspaceRoot(workspaceRoot), '.workflow');
}

export function rootStatePath(workspaceRoot?: string): string {
  return path.join(workflowRoot(workspaceRoot), 'state.json');
}

export function listRunDirs(parent: string): string[] {
  if (!existsSync(parent)) {
    return [];
  }
  return readdirSync(parent)
    .map((name) => path.join(parent, name))
    .filter((entry) => statSync(entry).isDirectory())
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

function findUp(start: string, marker: string): string | null {
  let current = start;
  while (true) {
    if (existsSync(path.join(current, marker))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
