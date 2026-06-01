import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function getCodexHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.WORKFLOW_MCP_CODEX_HOME || env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

export function getGlobalAgentsDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(getCodexHome(env), 'agents');
}

export function getSharedAgentsHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.WORKFLOW_MCP_SHARED_AGENTS_HOME || env.AGENTS_HOME || path.join(os.homedir(), '.agents');
}

export function getCompatibilityAgentsDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(getSharedAgentsHome(env), 'agents');
}

export function resolveSourceAgentsDir(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.WORKFLOW_MCP_AGENTS_DIR;
  if (explicit) {
    return explicit;
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const packageAgentsFromDist = path.resolve(moduleDir, '..', 'agents');
  if (existsSync(packageAgentsFromDist)) {
    return packageAgentsFromDist;
  }

  const packageAgentsFromSrc = path.resolve(moduleDir, '..', '..', 'agents');
  if (existsSync(packageAgentsFromSrc)) {
    return packageAgentsFromSrc;
  }

  return packageAgentsFromDist;
}
