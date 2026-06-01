import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { readJsonFile, writeJsonFile } from './fs-utils.js';
import { rootStatePath, workflowRoot } from './workspace.js';

export interface WorkflowRootState {
  active_plan: string | null;
  active_audit: string | null;
  updated_at: string;
}

export function readRootState(workspaceRoot?: string): WorkflowRootState {
  return readJsonFile(rootStatePath(workspaceRoot), {
    active_plan: null,
    active_audit: null,
    updated_at: new Date(0).toISOString(),
  });
}

export function updateRootState(workspaceRoot: string | undefined, patch: Partial<WorkflowRootState>): WorkflowRootState {
  mkdirSync(workflowRoot(workspaceRoot), { recursive: true });
  const next = {
    ...readRootState(workspaceRoot),
    ...patch,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(rootStatePath(workspaceRoot), next);
  return next;
}

export function relativeToWorkspace(workspaceRoot: string, absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath);
}
