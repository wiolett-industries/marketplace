import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { readReviewArtifactRoot } from './config.js';

export function resolveWorkspaceRoot(input?: string): string {
  const start = path.resolve(input || process.cwd());
  return findGitRoot(start) || start;
}

export function reviewRoot(workspaceRoot: string): string {
  return readReviewArtifactRoot(workspaceRoot);
}

export function statePath(workspaceRoot: string): string {
  return path.join(reviewRoot(workspaceRoot), 'state.json');
}

export function listReviewDirs(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .sort()
    .reverse();
}

function findGitRoot(start: string): string | null {
  let current = start;
  while (true) {
    if (existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
