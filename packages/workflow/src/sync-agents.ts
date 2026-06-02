import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readlinkSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseWorkflowAgentDefinition, type WorkflowAgentDefinition } from './agent-schema.js';
import { getCompatibilityAgentsDir, getGlobalAgentsDir, resolveSourceAgentsDir } from './paths.js';

const LOCK_FILE = '.workflow-agents.lock.json';
const MANAGED_BY = '@wiolett/workflow';
const LEGACY_MANAGERS = new Set([
  MANAGED_BY,
  '@wiolett/workflow-control',
  '@wiolett/workflow-mcp',
]);

export interface WorkflowAgentLockFile {
  managed_by: string;
  version: string;
  source_dir: string;
  synced_at: string;
  files: Record<string, {
    agent_name: string;
    sha256: string;
    link_target?: string;
    mode?: 'file' | 'symlink';
  }>;
}

export interface SyncWorkflowAgentsOptions {
  env?: NodeJS.ProcessEnv;
  packageVersion: string;
}

export interface SyncWorkflowAgentsResult {
  source_dir: string;
  target_dir: string;
  compatibility_dir: string;
  synced: string[];
  unchanged: string[];
  removed: string[];
  linked: string[];
  copied: string[];
  compatibility_unchanged: string[];
  compatibility_removed: string[];
  compatibility_errors: string[];
  count: number;
}

export function syncWorkflowAgents(options: SyncWorkflowAgentsOptions): SyncWorkflowAgentsResult {
  const env = options.env ?? process.env;
  const sourceDir = resolveSourceAgentsDir(env);
  const targetDir = getGlobalAgentsDir(env);
  const compatibilityDir = getCompatibilityAgentsDir(env);
  const sourceAgents = readSourceAgents(sourceDir);
  const previousLock = readLock(targetDir);

  mkdirSync(targetDir, { recursive: true });

  const synced: string[] = [];
  const unchanged: string[] = [];
  const removed: string[] = [];
  const nextFiles: WorkflowAgentLockFile['files'] = {};

  for (const agent of sourceAgents) {
    const targetPath = path.join(targetDir, agent.fileName);
    const existing = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null;

    if (existing === agent.content) {
      unchanged.push(agent.fileName);
    } else {
      atomicWrite(targetPath, agent.content);
      synced.push(agent.fileName);
    }

    nextFiles[agent.fileName] = {
      agent_name: agent.name,
      sha256: agent.sha256,
    };
  }

  if (previousLock && LEGACY_MANAGERS.has(previousLock.managed_by)) {
    const currentNames = new Set(sourceAgents.map((agent) => agent.fileName));
    for (const fileName of Object.keys(previousLock.files)) {
      if (currentNames.has(fileName)) {
        continue;
      }
      const targetPath = path.join(targetDir, fileName);
      if (!existsSync(targetPath)) {
        continue;
      }
      rmSync(targetPath);
      removed.push(fileName);
    }
  }

  writeLock(targetDir, {
    managed_by: MANAGED_BY,
    version: options.packageVersion,
    source_dir: sourceDir,
    synced_at: new Date().toISOString(),
    files: nextFiles,
  });

  const compatibility = syncCompatibilityAgents({
    sourceAgents,
    codexAgentsDir: targetDir,
    compatibilityDir,
    packageVersion: options.packageVersion,
    sourceDir,
  });

  return {
    source_dir: sourceDir,
    target_dir: targetDir,
    compatibility_dir: compatibilityDir,
    synced,
    unchanged,
    removed,
    linked: compatibility.linked,
    copied: compatibility.copied,
    compatibility_unchanged: compatibility.unchanged,
    compatibility_removed: compatibility.removed,
    compatibility_errors: compatibility.errors,
    count: sourceAgents.length,
  };
}

interface SyncCompatibilityAgentsOptions {
  sourceAgents: WorkflowAgentDefinition[];
  codexAgentsDir: string;
  compatibilityDir: string;
  packageVersion: string;
  sourceDir: string;
}

interface SyncCompatibilityAgentsResult {
  linked: string[];
  copied: string[];
  unchanged: string[];
  removed: string[];
  errors: string[];
}

function syncCompatibilityAgents(options: SyncCompatibilityAgentsOptions): SyncCompatibilityAgentsResult {
  const linked: string[] = [];
  const copied: string[] = [];
  const unchanged: string[] = [];
  const removed: string[] = [];
  const errors: string[] = [];

  try {
    mkdirSync(options.compatibilityDir, { recursive: true });
  } catch (error) {
    return {
      linked,
      copied,
      unchanged,
      removed,
      errors: [`${options.compatibilityDir}: ${formatError(error)}`],
    };
  }

  const previousLock = readLock(options.compatibilityDir);
  const nextFiles: WorkflowAgentLockFile['files'] = {};

  for (const agent of options.sourceAgents) {
    const linkTarget = path.join(options.codexAgentsDir, agent.fileName);
    const compatibilityPath = path.join(options.compatibilityDir, agent.fileName);

    try {
      const status = syncCompatibilityFile({
        agent,
        linkTarget,
        compatibilityPath,
        previous: previousLock?.files[agent.fileName],
      });

      if (status === 'linked') linked.push(agent.fileName);
      else if (status === 'copied') copied.push(agent.fileName);
      else unchanged.push(agent.fileName);

      nextFiles[agent.fileName] = {
        agent_name: agent.name,
        sha256: agent.sha256,
        link_target: linkTarget,
        mode: status === 'copied' ? 'file' : 'symlink',
      };
    } catch (error) {
      errors.push(`${agent.fileName}: ${formatError(error)}`);
    }
  }

  if (previousLock && LEGACY_MANAGERS.has(previousLock.managed_by)) {
    const currentNames = new Set(options.sourceAgents.map((agent) => agent.fileName));
    for (const fileName of Object.keys(previousLock.files)) {
      if (currentNames.has(fileName)) {
        continue;
      }
      const compatibilityPath = path.join(options.compatibilityDir, fileName);
      if (!existsSync(compatibilityPath)) {
        continue;
      }
      try {
        rmSync(compatibilityPath);
        removed.push(fileName);
      } catch (error) {
        errors.push(`${fileName}: ${formatError(error)}`);
      }
    }
  }

  try {
    writeLock(options.compatibilityDir, {
      managed_by: MANAGED_BY,
      version: options.packageVersion,
      source_dir: options.sourceDir,
      synced_at: new Date().toISOString(),
      files: nextFiles,
    });
  } catch (error) {
    errors.push(`${LOCK_FILE}: ${formatError(error)}`);
  }

  return {
    linked,
    copied,
    unchanged,
    removed,
    errors,
  };
}

function syncCompatibilityFile(options: {
  agent: WorkflowAgentDefinition;
  linkTarget: string;
  compatibilityPath: string;
  previous?: WorkflowAgentLockFile['files'][string];
}): 'linked' | 'copied' | 'unchanged' {
  const current = inspectCompatibilityFile(options.compatibilityPath);

  if (current.kind === 'symlink' && current.target === options.linkTarget) {
    return 'unchanged';
  }

  if (current.kind === 'file' && current.sha256 === options.agent.sha256 && options.previous?.mode === 'file') {
    return 'unchanged';
  }

  if (current.kind !== 'missing') {
    rmSync(options.compatibilityPath);
  }

  try {
    mkdirSync(path.dirname(options.compatibilityPath), { recursive: true });
    symlinkSync(options.linkTarget, options.compatibilityPath);
    return 'linked';
  } catch {
    atomicWrite(options.compatibilityPath, options.agent.content);
    return 'copied';
  }
}

function inspectCompatibilityFile(filePath: string):
  | { kind: 'missing' }
  | { kind: 'symlink'; target: string }
  | { kind: 'file'; sha256: string } {
  if (!existsSync(filePath)) {
    return { kind: 'missing' };
  }
  const stat = lstatSync(filePath);
  if (stat.isSymbolicLink()) {
    return {
      kind: 'symlink',
      target: readlinkSync(filePath),
    };
  }
  return {
    kind: 'file',
    sha256: sha256(readFileSync(filePath, 'utf8')),
  };
}

function readSourceAgents(sourceDir: string): WorkflowAgentDefinition[] {
  const fileNames = readdirSync(sourceDir)
    .filter((fileName) => fileName.startsWith('workflow_') && fileName.endsWith('.toml'))
    .sort();

  if (fileNames.length === 0) {
    throw new Error(`No workflow agent TOML files found in ${sourceDir}`);
  }

  const seen = new Set<string>();
  return fileNames.map((fileName) => {
    const content = readFileSync(path.join(sourceDir, fileName), 'utf8');
    const definition = parseWorkflowAgentDefinition(fileName, content, sha256(content));
    if (seen.has(definition.name)) {
      throw new Error(`${fileName}: duplicate workflow agent name ${definition.name}`);
    }
    seen.add(definition.name);
    return definition;
  });
}

function readLock(targetDir: string): WorkflowAgentLockFile | null {
  const lockPath = path.join(targetDir, LOCK_FILE);
  if (!existsSync(lockPath)) {
    return null;
  }
  const parsed = JSON.parse(readFileSync(lockPath, 'utf8')) as WorkflowAgentLockFile;
  if (!LEGACY_MANAGERS.has(parsed.managed_by)) {
    return null;
  }
  return parsed;
}

function writeLock(targetDir: string, lock: WorkflowAgentLockFile): void {
  atomicWrite(path.join(targetDir, LOCK_FILE), `${JSON.stringify(lock, null, 2)}\n`);
}

function atomicWrite(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, content, 'utf8');
  renameSync(tempPath, filePath);
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
