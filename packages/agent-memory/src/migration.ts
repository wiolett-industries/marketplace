import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  createDefaultAiProvidersConfig,
  createDefaultMcpConfig,
  getConfigPaths,
  readAiProvidersConfig,
  readMcpConfig,
  resolveConfiguredPath,
  writeGeneratedYaml,
  type ConfigPaths,
} from './config.js';

export type BootstrapTrigger = 'init' | 'mcp-startup';

export interface BootstrapResult {
  configCreated: string[];
  legacyConfigMigrated: boolean;
  memoryMigration: 'not-needed' | 'completed' | 'already-completed';
  memorySource?: string;
  memoryDestination: string;
  memoryBackup?: string;
}

export interface BootstrapOptions {
  trigger: BootstrapTrigger;
  env?: NodeJS.ProcessEnv;
  log?: (message: string) => void;
}

export async function ensureConfigAndStorageMigrated(options: BootstrapOptions): Promise<BootstrapResult> {
  const env = options.env ?? process.env;
  const paths = getConfigPaths(env);
  const release = await acquireMigrationLock(path.join(paths.agentsHome, '.wiolett', '.migration.lock'));
  try {
    const needsProviderConfig = !existsSync(paths.aiProviders);
    const legacy = needsProviderConfig ? readLegacyAuth(paths.legacyAuth) : null;
    const configCreated: string[] = [];
    if (needsProviderConfig) {
      writeGeneratedYaml(paths.aiProviders, createDefaultAiProvidersConfig(legacy), 'providers');
      configCreated.push(paths.aiProviders);
    }
    if (!existsSync(paths.mcpConfig)) {
      writeGeneratedYaml(paths.mcpConfig, createDefaultMcpConfig(paths.agentsHome), 'mcp');
      configCreated.push(paths.mcpConfig);
    }

    // Fail before touching storage if either canonical file is malformed.
    readAiProvidersConfig(paths.aiProviders);
    const mcpConfig = readMcpConfig(paths.mcpConfig);
    if (!mcpConfig) throw new Error(`Missing MCP configuration after bootstrap: ${paths.mcpConfig}`);

    const runtimeHome = resolveConfiguredPath(
      mcpConfig.mcp['agent-memory']?.runtime?.home ?? paths.agentsHome,
      paths.agentsHome,
    );
    const destination = resolveConfiguredPath(
      mcpConfig.mcp['agent-memory']?.storage?.memory.global ?? '.wiolett/global-memory',
      runtimeHome,
    );
    const source = path.join(paths.agentsHome, 'agent-memory');
    const migration = migrateGlobalMemory(source, destination);
    const markerPath = path.join(paths.migrationRoot, 'agent-memory-v1.json');
    if (configCreated.length || migration.status === 'completed' || !existsSync(markerPath)) {
      writeMigrationMarker(paths, {
        trigger: options.trigger,
        source,
        destination,
        config_created: configCreated,
        legacy_config_migrated: Boolean(legacy && configCreated.includes(paths.aiProviders)),
        memory_status: migration.status,
        ...(migration.backup ? { memory_backup: migration.backup } : {}),
      });
    }

    if (configCreated.length) options.log?.(`[agent-memory] created ${configCreated.join(', ')}`);
    if (migration.status === 'completed') options.log?.(`[agent-memory] migrated global memory to ${destination}`);

    return {
      configCreated,
      legacyConfigMigrated: Boolean(legacy && configCreated.includes(paths.aiProviders)),
      memoryMigration: migration.status,
      memorySource: existsSync(source) || migration.backup ? source : undefined,
      memoryDestination: destination,
      ...(migration.backup ? { memoryBackup: migration.backup } : {}),
    };
  } finally {
    release();
  }
}

function readLegacyAuth(configPath: string): Record<string, unknown> | null {
  if (!existsSync(configPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch (error) {
    throw new Error(`Invalid legacy Agent Memory configuration in ${configPath}: ${errorMessage(error)}`);
  }
}

function migrateGlobalMemory(source: string, destination: string): { status: BootstrapResult['memoryMigration']; backup?: string } {
  if (path.resolve(source) === path.resolve(destination)) return { status: 'already-completed' };
  if (!existsSync(source)) return { status: existsSync(destination) ? 'already-completed' : 'not-needed' };

  const sourceStat = lstatSync(source);
  let dataSource = source;
  let sourceWasSymlink = false;
  if (sourceStat.isSymbolicLink()) {
    const target = path.resolve(path.dirname(source), readlinkSync(source));
    if (safeRealpath(target) === safeRealpath(destination)) return { status: 'already-completed' };
    if (!existsSync(target) || !lstatSync(target).isDirectory()) {
      throw new Error(`Legacy global memory path is a broken or invalid symlink: ${source} -> ${target}`);
    }
    dataSource = target;
    sourceWasSymlink = true;
  }
  if (!sourceWasSymlink && !sourceStat.isDirectory()) throw new Error(`Legacy global memory path is not a directory: ${source}`);

  mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  if (existsSync(destination)) {
    if (!lstatSync(destination).isDirectory()) throw new Error(`Configured global memory path is not a directory: ${destination}`);
    if (readdirSync(destination).length === 0) {
      rmSync(destination, { recursive: false });
    } else if (!sameTree(dataSource, destination)) {
      throw new Error(
        `Cannot automatically migrate global memory because both source and destination contain different data: ${dataSource} and ${destination}`,
      );
    }
  }

  if (!existsSync(destination)) {
    const staging = path.join(path.dirname(destination), `.${path.basename(destination)}.migrating-${randomUUID()}`);
    try {
      cpSync(dataSource, staging, { recursive: true, preserveTimestamps: true, errorOnExist: true });
      if (!sameTree(dataSource, staging)) throw new Error('Global memory verification failed after copying to staging.');
      renameSync(staging, destination);
    } catch (error) {
      if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
      throw error;
    }
  }

  const backup = uniqueBackupPath(dataSource);
  renameSync(dataSource, backup);
  if (sourceWasSymlink) unlinkSync(source);
  try {
    symlinkSync(destination, source, 'dir');
  } catch (error) {
    renameSync(backup, dataSource);
    if (sourceWasSymlink) symlinkSync(dataSource, source, 'dir');
    throw new Error(`Migrated global memory but could not create the legacy compatibility symlink: ${errorMessage(error)}`);
  }
  return { status: 'completed', backup };
}

function sameTree(left: string, right: string): boolean {
  const leftFiles = snapshotTree(left);
  const rightFiles = snapshotTree(right);
  if (leftFiles.size !== rightFiles.size) return false;
  for (const [name, digest] of leftFiles) {
    if (rightFiles.get(name) !== digest) return false;
  }
  return true;
}

function snapshotTree(root: string): Map<string, string> {
  const snapshot = new Map<string, string>();
  const visit = (current: string): void => {
    for (const name of readdirSync(current).sort()) {
      const absolute = path.join(current, name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const info = lstatSync(absolute);
      if (info.isDirectory()) {
        snapshot.set(`${relative}/`, 'directory');
        visit(absolute);
      } else if (info.isSymbolicLink()) {
        snapshot.set(relative, `symlink:${readlinkSync(absolute)}`);
      } else if (info.isFile()) {
        snapshot.set(relative, createHash('sha256').update(readFileSync(absolute)).digest('hex'));
      } else {
        snapshot.set(relative, `${info.mode}:${info.size}`);
      }
    }
  };
  visit(root);
  return snapshot;
}

function uniqueBackupPath(source: string): string {
  const compactTimestamp = new Date().toISOString().replace(/[:.]/gu, '-');
  let candidate = `${source}.pre-migration-${compactTimestamp}`;
  let suffix = 1;
  while (existsSync(candidate)) candidate = `${source}.pre-migration-${compactTimestamp}-${suffix++}`;
  return candidate;
}

function writeMigrationMarker(paths: ConfigPaths, value: Record<string, unknown>): void {
  mkdirSync(paths.migrationRoot, { recursive: true, mode: 0o700 });
  const markerPath = path.join(paths.migrationRoot, 'agent-memory-v1.json');
  writeFileSync(markerPath, `${JSON.stringify({ status: 'completed', completed_at: new Date().toISOString(), ...value }, null, 2)}\n`, { mode: 0o600 });
  chmodSync(markerPath, 0o600);
}

async function acquireMigrationLock(lockPath: string): Promise<() => void> {
  mkdirSync(path.dirname(lockPath), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + 30_000;
  const token = randomUUID();
  while (true) {
    try {
      const descriptor = openSync(lockPath, 'wx', 0o600);
      writeFileSync(descriptor, JSON.stringify({ pid: process.pid, token, created_at: new Date().toISOString() }));
      closeSync(descriptor);
      return () => {
        try {
          const current = JSON.parse(readFileSync(lockPath, 'utf8')) as { token?: unknown };
          if (current.token === token) unlinkSync(lockPath);
        } catch { /* Another recovery path may already have removed it. */ }
      };
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      if (isStaleLock(lockPath)) {
        try { unlinkSync(lockPath); } catch { /* Retry and let the winner own the lock. */ }
        continue;
      }
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for Agent Memory migration lock: ${lockPath}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

function isStaleLock(lockPath: string): boolean {
  try {
    const value = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid?: unknown };
    if (typeof value.pid !== 'number' || !Number.isInteger(value.pid)) return statSync(lockPath).mtimeMs < Date.now() - 300_000;
    try {
      process.kill(value.pid, 0);
      return false;
    } catch {
      return true;
    }
  } catch {
    return false;
  }
}

function safeRealpath(value: string): string {
  try { return realpathSync(value); } catch { return path.resolve(value); }
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
