import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readlinkSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCK_FILE = '.merge-request-review-agents.lock.json';
const MANAGED_BY = '@wiolett/merge-request-review';

export interface SyncMergeRequestReviewAgentsResult {
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

interface AgentFile {
  fileName: string;
  name: string;
  content: string;
  sha256: string;
}

interface LockFile {
  managed_by: string;
  version: string;
  source_dir: string;
  synced_at: string;
  files: Record<string, { agent_name: string; sha256: string; link_target?: string; mode?: 'file' | 'symlink' }>;
}

export function syncMergeRequestReviewAgents(options: { packageVersion: string; env?: NodeJS.ProcessEnv }): SyncMergeRequestReviewAgentsResult {
  const env = options.env ?? process.env;
  const sourceDir = resolveSourceAgentsDir(env);
  const targetDir = path.join(env.MERGE_REQUEST_REVIEW_CODEX_HOME || path.join(homeDir(env), '.codex'), 'agents');
  const compatibilityDir = path.join(env.MERGE_REQUEST_REVIEW_SHARED_AGENTS_HOME || path.join(homeDir(env), '.agents'), 'agents');
  const agents = readAgents(sourceDir);
  const previousLock = readLock(targetDir);
  const synced: string[] = [];
  const unchanged: string[] = [];
  const removed: string[] = [];
  const nextFiles: LockFile['files'] = {};

  mkdirSync(targetDir, { recursive: true });

  for (const agent of agents) {
    const targetPath = path.join(targetDir, agent.fileName);
    const existing = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null;
    if (existing === agent.content) {
      unchanged.push(agent.fileName);
    } else {
      atomicWrite(targetPath, agent.content);
      synced.push(agent.fileName);
    }
    nextFiles[agent.fileName] = { agent_name: agent.name, sha256: agent.sha256 };
  }

  if (previousLock?.managed_by === MANAGED_BY) {
    const current = new Set(agents.map((agent) => agent.fileName));
    for (const fileName of Object.keys(previousLock.files)) {
      if (current.has(fileName)) continue;
      const targetPath = path.join(targetDir, fileName);
      if (!existsSync(targetPath)) continue;
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

  const compatibility = syncCompatibility({ agents, targetDir, compatibilityDir, sourceDir, packageVersion: options.packageVersion });
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
    count: agents.length,
  };
}

function resolveSourceAgentsDir(env: NodeJS.ProcessEnv): string {
  if (env.MERGE_REQUEST_REVIEW_AGENTS_DIR) {
    return path.resolve(env.MERGE_REQUEST_REVIEW_AGENTS_DIR);
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'agents');
}

function readAgents(sourceDir: string): AgentFile[] {
  return readdirSync(sourceDir)
    .filter((fileName) => fileName.startsWith('merge_request_') && fileName.endsWith('.toml'))
    .sort()
    .map((fileName) => {
      const content = readFileSync(path.join(sourceDir, fileName), 'utf8');
      const name = extractField(content, 'name');
      if (name !== fileName.slice(0, -5)) {
        throw new Error(`${fileName}: filename stem must match agent name`);
      }
      extractField(content, 'description');
      if (!content.includes('developer_instructions')) {
        throw new Error(`${fileName}: missing developer_instructions`);
      }
      return { fileName, name, content, sha256: sha256(content) };
    });
}

function syncCompatibility(options: { agents: AgentFile[]; targetDir: string; compatibilityDir: string; sourceDir: string; packageVersion: string }) {
  const linked: string[] = [];
  const copied: string[] = [];
  const unchanged: string[] = [];
  const removed: string[] = [];
  const errors: string[] = [];
  mkdirSync(options.compatibilityDir, { recursive: true });
  const previousLock = readLock(options.compatibilityDir);
  const nextFiles: LockFile['files'] = {};

  for (const agent of options.agents) {
    const linkTarget = path.join(options.targetDir, agent.fileName);
    const compatibilityPath = path.join(options.compatibilityDir, agent.fileName);
    try {
      const status = syncCompatibilityFile(compatibilityPath, linkTarget, agent, previousLock?.files[agent.fileName]);
      if (status === 'linked') linked.push(agent.fileName);
      else if (status === 'copied') copied.push(agent.fileName);
      else unchanged.push(agent.fileName);
      nextFiles[agent.fileName] = { agent_name: agent.name, sha256: agent.sha256, link_target: linkTarget, mode: status === 'copied' ? 'file' : 'symlink' };
    } catch (error) {
      errors.push(`${agent.fileName}: ${formatError(error)}`);
    }
  }

  if (previousLock?.managed_by === MANAGED_BY) {
    const current = new Set(options.agents.map((agent) => agent.fileName));
    for (const fileName of Object.keys(previousLock.files)) {
      if (current.has(fileName)) continue;
      const compatibilityPath = path.join(options.compatibilityDir, fileName);
      if (!existsSync(compatibilityPath)) continue;
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

  return { linked, copied, unchanged, removed, errors };
}

function syncCompatibilityFile(filePath: string, linkTarget: string, agent: AgentFile, previous?: LockFile['files'][string]): 'linked' | 'copied' | 'unchanged' {
  const current = inspectCompatibilityFile(filePath);
  if (current.kind === 'symlink' && current.target === linkTarget) return 'unchanged';
  if (current.kind === 'file' && current.sha256 === agent.sha256 && previous?.mode === 'file') return 'unchanged';
  if (current.kind !== 'missing') rmSync(filePath);
  try {
    symlinkSync(linkTarget, filePath);
    return 'linked';
  } catch {
    atomicWrite(filePath, agent.content);
    return 'copied';
  }
}

function inspectCompatibilityFile(filePath: string): { kind: 'missing' } | { kind: 'symlink'; target: string } | { kind: 'file'; sha256: string } {
  if (!existsSync(filePath)) return { kind: 'missing' };
  const stat = lstatSync(filePath);
  if (stat.isSymbolicLink()) return { kind: 'symlink', target: readlinkSync(filePath) };
  return { kind: 'file', sha256: sha256(readFileSync(filePath, 'utf8')) };
}

function readLock(targetDir: string): LockFile | null {
  const lockPath = path.join(targetDir, LOCK_FILE);
  if (!existsSync(lockPath)) return null;
  const parsed = JSON.parse(readFileSync(lockPath, 'utf8')) as LockFile;
  return parsed.managed_by === MANAGED_BY ? parsed : null;
}

function writeLock(targetDir: string, lock: LockFile): void {
  atomicWrite(path.join(targetDir, LOCK_FILE), `${JSON.stringify(lock, null, 2)}\n`);
}

function atomicWrite(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, content, 'utf8');
  renameSync(tempPath, filePath);
}

function extractField(content: string, field: string): string {
  const match = content.match(new RegExp(`^${field}\\s*=\\s*"([^"]+)"`, 'm'));
  if (!match) throw new Error(`missing ${field}`);
  return match[1];
}

function homeDir(env: NodeJS.ProcessEnv): string {
  return env.HOME || process.cwd();
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
