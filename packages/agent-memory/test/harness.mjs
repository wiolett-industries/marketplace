import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { closeDb } from '../dist/db.js';
import { resetModelProvider } from '../dist/model-provider.js';
import { setupProjectMemory } from '../dist/setup.js';
import { detectMemoryState, ensureMemoryReady, resetMemoryReady } from '../dist/runtime.js';
import { getGlobalMemoryRoot } from '../dist/scope.js';
import { getProjectMemoryRegistryPath, listProjectMemoryReferences, registerExistingProjectMemory } from '../dist/project-registry.js';
import { handleWrite } from '../dist/tools/write.js';
import { handleUpdate } from '../dist/tools/update.js';
import { handleReadLite } from '../dist/tools/read-lite.js';
import { handleReadAll } from '../dist/tools/read-all.js';
import { handleGet } from '../dist/tools/get.js';
import { handleSearch } from '../dist/tools/search.js';
import { handleDelete } from '../dist/tools/delete.js';
import { handleGraphMaintenance, handleGraphPrune, handleLink, handleNeighbors, handleSubgraph, handleUnlink } from '../dist/tools/graph.js';
import { deleteEntryFromDb, getOutgoingEdgeRecords, replaceOutgoingEdges, upsertEntry } from '../dist/db.js';
import { deleteEntryFile, writeEntryFile, writeGraphFile } from '../dist/files.js';
import { hashEntry } from '../dist/entry.js';
import { handleInspect } from '../dist/tools/inspect.js';
import { handleRecall } from '../dist/tools/recall.js';
import { handleQuery } from '../dist/tools/query.js';
import { handleRecap } from '../dist/tools/recap.js';
import { rebuildFromFiles } from '../dist/rebuild.js';
import { spreadingActivation } from '../dist/retrieval/activation.js';
import { handlePath } from '../dist/tools/path.js';
import { buildSupersedeOutcome } from '../dist/auto-link.js';
import { formatInteractiveViewOutro } from '../dist/cli/root-command.js';
import { formatQuietViewStarted } from '../dist/view/cli.js';
import { startViewServer } from '../dist/view/server.js';

if (!process.env.PROJECT_MEMORY_AGENTS_HOME) {
  process.env.PROJECT_MEMORY_AGENTS_HOME = mkdtempSync(path.join(os.tmpdir(), 'pm-agents-home-'));
}

if (!process.env.PROJECT_MEMORY_GLOBAL_ROOT) {
  process.env.PROJECT_MEMORY_GLOBAL_ROOT = path.join(process.env.PROJECT_MEMORY_AGENTS_HOME, 'agent-memory');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createTempProject(prefix) {
  const projectDir = mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  mkdirSync(projectDir, { recursive: true });
  return projectDir;
}

async function withProject(projectDir, fn) {
  const previousCwd = process.cwd();
  process.chdir(projectDir);
  resetMemoryReady('project', projectDir);
  resetMemoryReady('global');
  resetModelProvider();
  try {
    return await fn();
  } finally {
    closeDb();
    resetMemoryReady('project', projectDir);
    resetMemoryReady('global');
    resetModelProvider();
    process.chdir(previousCwd);
  }
}

function readGitignore(projectDir) {
  return readFileSync(path.join(projectDir, '.gitignore'), 'utf8');
}

function listRelative(projectDir, relativeDir) {
  return readdirSync(path.join(projectDir, relativeDir)).sort();
}

async function runSetup() {
  const projectDir = createTempProject('pm-setup');
  return withProject(projectDir, async () => {
    const first = setupProjectMemory();
    const second = setupProjectMemory();
    return {
      setup: first,
      idempotent: {
        same_db_path: first.db_path === second.db_path,
        gitignore_entries: readGitignore(projectDir).match(/\.memory\/memory\.db\*/g)?.length ?? 0,
      },
    };
  });
}

async function runSetupLocalEmbeddings() {
  const projectDir = createTempProject('pm-setup-local-embeddings');
  return withProject(projectDir, async () => {
    const previousConfigPath = process.env.WIOLETT_AUTH_CONFIG_PATH;
    const configPath = path.join(projectDir, 'auth-config.json');
    writeFileSync(configPath, JSON.stringify({
      openAIKey: 'sk-test',
      embeddingModel: 'text-embedding-3-small',
    }), 'utf8');

    try {
      process.env.WIOLETT_AUTH_CONFIG_PATH = configPath;
      return setupProjectMemory();
    } finally {
      if (previousConfigPath === undefined) delete process.env.WIOLETT_AUTH_CONFIG_PATH;
      else process.env.WIOLETT_AUTH_CONFIG_PATH = previousConfigPath;
    }
  });
}

async function runMemory() {
  const projectDir = createTempProject('pm-memory');
  return withProject(projectDir, async () => {
    ensureMemoryReady();

    const deep = await handleWrite({
      content: 'MinIO upload workflow for testnet assets',
      tags: ['minio', 'uploads', 'testnet'],
      summary: 'MinIO upload workflow',
    });
    const service = await handleWrite({
      content: 'Static bucket configuration used by deployment jobs',
      tags: ['bucket', 'config', 'testnet'],
      summary: 'Static bucket config',
    });
    const lite = await handleWrite({
      content: 'Preferred stack for testnet assets: Next.js plus FastAPI',
      tags: ['stack', 'testnet'],
      layer: 'lite',
    });
    const liteAutoEntry = handleGet({ id: lite.id });
    const serviceAutoEntry = handleGet({ id: service.id });

    handleLink({
      from_id: deep.id,
      to_id: service.id,
      relation: 'uses_service',
      weight: 0.82,
      reason: 'Workflow depends on bucket config',
    });
    const symmetric = handleLink({
      from_id: deep.id,
      to_id: service.id,
      relation: 'related_to',
      weight: 0.6,
      reason: 'Both affect testnet asset delivery',
    });

    const deepEntry = handleGet({ id: deep.id });
    const serviceEntry = handleGet({ id: service.id });
    const neighbors = handleNeighbors({ id: deep.id });
    const subgraph = handleSubgraph({ id: deep.id, depth: 1 });
    const search = await handleSearch({ query: 'bucket config testnet' });
    const readAll = handleReadAll();
    const unlinkResult = handleUnlink({
      from_id: deep.id,
      to_id: service.id,
      relation: 'related_to',
    });
    const deleted = handleDelete({ id: service.id });
    const deepAfterDelete = handleGet({ id: deep.id });
    const rawGraphAfterDelete = handleInspect({ view: 'graph' });

    return {
      ids: { deep: deep.id, service: service.id, lite: lite.id },
      autoLinks: {
        deep: deep.auto_links,
        service: service.auto_links,
        lite: lite.auto_links,
      },
      serviceAutoEntry,
      liteAutoEntry,
      memoryAutoCreated: existsSync(path.join(projectDir, '.memory')),
      memoryFiles: listRelative(projectDir, '.memory/memories'),
      indexFiles: listRelative(projectDir, '.memory/index'),
      embeddingFiles: listRelative(projectDir, '.memory/embeddings'),
      embeddingFileContents: readFileSync(path.join(projectDir, '.memory', 'embeddings', `${deepEntry.file_name}.embeddings`), 'utf8'),
      liteEntries: handleReadLite(),
      deepEntry,
      serviceEntry,
      neighbors,
      subgraph,
      search,
      readAll,
      symmetric,
      unlinkResult,
      deleted,
      deepAfterDelete,
      rawGraphAfterDelete,
      graphFilesAfterDelete: listRelative(projectDir, '.memory/graph'),
    };
  });
}

async function runGlobal() {
  const projectDir = createTempProject('pm-global');
  return withProject(projectDir, async () => {
    const initialProjectState = detectMemoryState();
    const initialGlobalState = detectMemoryState('global');

    ensureMemoryReady('global');

    const globalDeep = await handleWrite({
      content: 'User prefers concise answers and dislikes nested bullets.',
      tags: ['preferences', 'style'],
      summary: 'User response style preferences',
      scope: 'global',
    });
    const globalLite = await handleWrite({
      content: 'Always prefer Context7 for SDK and framework docs.',
      tags: ['docs', 'workflow'],
      layer: 'lite',
      scope: 'global',
    });

    const globalReadLite = handleReadLite('global');
    const globalSearch = await handleSearch({
      query: 'concise response style',
      scope: 'global',
    });
    const globalReadAll = handleReadAll('global');
    const globalEntry = handleGet({ id: globalDeep.id, scope: 'global' });
    const finalGlobalState = detectMemoryState('global');

    return {
      initialProjectState,
      initialGlobalState,
      finalGlobalState,
      ids: { deep: globalDeep.id, lite: globalLite.id },
      globalRoot: getGlobalMemoryRoot(),
      globalMemoryFiles: listRelative(getGlobalMemoryRoot(), 'memories'),
      globalIndexFiles: listRelative(getGlobalMemoryRoot(), 'index'),
      globalEmbeddingFiles: listRelative(getGlobalMemoryRoot(), 'embeddings'),
      projectMemoryExists: initialProjectState.enabled,
      projectMemoryDirCreated: existsSync(path.join(projectDir, '.memory')),
      globalReadLite,
      globalReadAll,
      globalSearch,
      globalEntry,
    };
  });
}

async function runUpdateInspect() {
  const projectDir = createTempProject('pm-update-inspect');
  return withProject(projectDir, async () => {
    ensureMemoryReady();

    const primary = await handleWrite({
      content: 'Original deployment memory that references the staging bucket',
      tags: ['deploy', 'staging'],
      summary: 'Original deployment memory',
    });
    const related = await handleWrite({
      content: 'Staging bucket is provisioned by the infrastructure pipeline',
      tags: ['bucket', 'staging'],
      summary: 'Staging bucket pipeline',
    });
    handleLink({
      from_id: primary.id,
      to_id: related.id,
      relation: 'uses_service',
      weight: 0.9,
      reason: 'Deployment memory depends on bucket provisioning',
    });

    const before = handleGet({ id: primary.id });
    const relatedBeforeUpdate = handleGet({ id: related.id });
    const pointerBefore = handleReadLite().find((entry) => entry.ref === primary.id);
    const update = await handleUpdate({
      memory_id: primary.id,
      content: 'Updated deployment memory that references the production bucket',
      tags: ['deploy', 'production'],
      summary: 'Updated deployment memory',
    });
    const after = handleGet({ id: primary.id });
    const relatedAfterUpdate = handleGet({ id: related.id });
    const pointerAfter = handleReadLite().find((entry) => entry.ref === primary.id);
    const graph = handleInspect({ view: 'graph', memory_id: primary.id });
    const all = handleInspect({ view: 'all' });
    const recall = await handleRecall({ memory_id: primary.id, include_sources: true });

    return {
      ids: { primary: primary.id, related: related.id },
      before,
      relatedBeforeUpdate,
      pointerBefore,
      update,
      after,
      relatedAfterUpdate,
      pointerAfter,
      graph,
      all,
      recall,
      memoryFiles: listRelative(projectDir, '.memory/memories'),
      indexFiles: listRelative(projectDir, '.memory/index'),
      embeddingFiles: listRelative(projectDir, '.memory/embeddings'),
    };
  });
}

async function runLegacyJson() {
  const projectDir = createTempProject('pm-legacy-json');
  return withProject(projectDir, async () => {
    mkdirSync(path.join(projectDir, '.memory', 'entries'), { recursive: true });
    const legacyDeepId = '-QrPW_icQNLYbf9YPiUWH';
    const legacyLiteId = 'PointerRef_QrPW_icQNLY';
    writeFileSync(
      path.join(projectDir, '.memory', 'entries', 'deep.json'),
      JSON.stringify(
        {
          id: legacyDeepId,
          content: 'Legacy MinIO workflow stored in JSON format',
          tags: ['legacy', 'minio'],
          layer: 'deep',
          ref: null,
          embedding: [0.1, 0.2, 0.3],
          created_at: 1700000000000,
          updated_at: 1700000001000,
        },
        null,
        2
      )
    );
    writeFileSync(
      path.join(projectDir, '.memory', 'entries', 'lite.json'),
      JSON.stringify(
        {
          id: legacyLiteId,
          content: `[→ ${legacyDeepId}] Legacy MinIO workflow`,
          tags: ['legacy', 'minio'],
          layer: 'lite',
          ref: legacyDeepId,
          embedding: [],
          created_at: 1700000000000,
          updated_at: 1700000001000,
        },
        null,
        2
      )
    );

    ensureMemoryReady();
    const migratedDeepId = 'qrpwicqn';
    const migratedLiteId = 'pointerr';
    return {
      memoryFiles: listRelative(projectDir, '.memory/memories'),
      indexFiles: listRelative(projectDir, '.memory/index'),
      embeddingFiles: listRelative(projectDir, '.memory/embeddings'),
      migrated: handleGet({ id: migratedDeepId }),
      migratedPointer: handleGet({ id: migratedLiteId }),
    };
  });
}

async function runLegacyDb() {
  const projectDir = createTempProject('pm-legacy-db');
  return withProject(projectDir, async () => {
    mkdirSync(path.join(projectDir, '.memory'), { recursive: true });
    const dbPath = path.join(projectDir, '.memory', 'memory.db');
    const db = new DatabaseSync(dbPath);
    db.prepare(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        layer TEXT NOT NULL DEFAULT 'deep',
        ref TEXT DEFAULT NULL,
        hash TEXT DEFAULT NULL,
        embedding TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `).run();
    db.prepare(`
      INSERT INTO entries (id, content, tags, layer, ref, hash, embedding, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'db1234',
      'DB-only legacy deployment note',
      JSON.stringify(['legacy', 'deploy']),
      'deep',
      null,
      null,
      JSON.stringify([0.05, 0.06]),
      1700000000000,
      1700000002000
    );
    db.close();

    rebuildFromFiles();
    ensureMemoryReady();

    return {
      memoryFiles: listRelative(projectDir, '.memory/memories'),
      embeddingFiles: listRelative(projectDir, '.memory/embeddings'),
      migrated: handleGet({ id: 'db1234' }),
      state: detectMemoryState(),
    };
  });
}

async function runMcp() {
  const projectDir = createTempProject('pm-mcp');
  const client = new Client({
    name: 'agent-memory-jest-client',
    version: '0.1.0',
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('dist/index.js')],
    cwd: projectDir,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      PROJECT_MEMORY_AGENTS_HOME: process.env.PROJECT_MEMORY_AGENTS_HOME ?? '',
      PROJECT_MEMORY_GLOBAL_ROOT: process.env.PROJECT_MEMORY_GLOBAL_ROOT ?? '',
      WIOLETT_AUTH_CONFIG_PATH: process.env.WIOLETT_AUTH_CONFIG_PATH ?? '',
      OPENAI_API_KEY: '',
    },
    stderr: 'pipe',
  });

  await client.connect(transport);
  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  const setup = await client.callTool({ name: 'memory_setup', arguments: {} });
  const projectRegistryBeforeWrite = await client.callTool({ name: 'memory_project_registry', arguments: {} });
  const write = await client.callTool({
    name: 'memory_write',
    arguments: {
      content: 'Smoke test memory from MCP launcher',
      tags: ['smoke', 'mcp'],
      summary: 'Smoke memory',
    },
  });
  const globalWrite = await client.callTool({
    name: 'global_memory_write',
    arguments: {
      content: 'User prefers terse summaries in MCP smoke tests',
      tags: ['preferences', 'smoke'],
      summary: 'Smoke global preference',
    },
  });
  const globalReconciliationBefore = await client.callTool({ name: 'memory_reconciliation_status', arguments: { scope: 'global' } });
  const globalReconciliationRecord = await client.callTool({
    name: 'memory_reconciliation_record',
    arguments: { scope: 'global', summary: 'Global smoke reconciliation.', changes: [], unresolved: [] },
  });
  const globalReconciliationAfter = await client.callTool({ name: 'memory_reconciliation_status', arguments: { scope: 'global' } });
  const lite = await client.callTool({ name: 'memory_read_lite', arguments: {} });
  const globalLite = await client.callTool({ name: 'global_memory_read_lite', arguments: {} });
  const get = await client.callTool({ name: 'memory_get', arguments: { id: JSON.parse(write.content[0].text).id } });
  const search = await client.callTool({ name: 'memory_search', arguments: { query: 'Smoke test memory' } });
  const canonicalWrite = await client.callTool({
    name: 'memory_save',
    arguments: {
      content: 'Canonical smoke memory from MCP launcher',
      tags: ['smoke', 'canonical'],
      summary: 'Canonical smoke memory',
    },
  });
  const canonicalList = await client.callTool({ name: 'memory_list', arguments: {} });
  const projectRegistry = await client.callTool({ name: 'memory_project_registry', arguments: {} });
  const canonicalIndexList = await client.callTool({ name: 'memory_list', arguments: { index_only: true } });
  const reconciliationBefore = await client.callTool({ name: 'memory_reconciliation_status', arguments: {} });
  const reconciliationRecord = await client.callTool({
    name: 'memory_reconciliation_record',
    arguments: { summary: 'Project smoke reconciliation.', changes: [], unresolved: [] },
  });
  const reconciliationAfter = await client.callTool({ name: 'memory_reconciliation_status', arguments: {} });
  const query = await client.callTool({
    name: 'memory_query',
    arguments: { query: 'Canonical smoke memory', limit: 3 },
  });
  const recap = await client.callTool({ name: 'memory_recap', arguments: { limit: 3 } });
  const inspect = await client.callTool({ name: 'memory_inspect', arguments: { view: 'all' } });
  await transport.close();

  return {
    startupConfig: {
      providers: existsSync(path.join(process.env.PROJECT_MEMORY_AGENTS_HOME, '.wiolett', 'config', 'ai-providers.yml')),
      mcp: existsSync(path.join(process.env.PROJECT_MEMORY_AGENTS_HOME, '.wiolett', 'config', 'mcp-config.yml')),
    },
    toolNames,
    toolSchemas: tools.tools,
    setup,
    projectRegistryBeforeWrite,
    projectRegistry,
    write,
    get,
    search,
    lite,
    globalWrite,
    globalLite,
    globalReconciliationBefore,
    globalReconciliationRecord,
    globalReconciliationAfter,
    canonicalWrite,
    canonicalList,
    canonicalIndexList,
    reconciliationBefore,
    reconciliationRecord,
    reconciliationAfter,
    query,
    recap,
    inspect,
  };
}

async function runProjectRegistry() {
  const projectDir = createTempProject('pm-project-registry');
  const emptyProjectDir = createTempProject('pm-project-registry-empty');
  const restoredProjectDir = createTempProject('pm-project-registry-restored');

  return withProject(projectDir, async () => {
    ensureMemoryReady();
    const beforeFirstWrite = listProjectMemoryReferences();
    const written = await handleWrite({ content: 'Registry records this project after its first memory.', tags: ['registry'], summary: 'registry write' });
    const afterFirstWrite = listProjectMemoryReferences();
    const registryPath = getProjectMemoryRegistryPath();
    // A busy discovery index is not allowed to turn an already-persisted
    // memory into a failed write result.
    writeFileSync(`${registryPath}.lock`, JSON.stringify({ pid: 'test', created_at: new Date().toISOString() }), 'utf8');
    const lockedWrite = await handleWrite({ content: 'Registry lock must not fail this memory write.', tags: ['registry'], summary: 'locked registry write' });
    const afterLockedWrite = listProjectMemoryReferences();
    unlinkSync(`${registryPath}.lock`);

    const empty = await registerExistingProjectMemory(emptyProjectDir, path.join(emptyProjectDir, '.memory'));
    const restoredMemoryRoot = path.join(restoredProjectDir, '.memory');
    mkdirSync(path.join(restoredMemoryRoot, 'memories'), { recursive: true });
    writeFileSync(path.join(restoredMemoryRoot, 'memories', 'existing.md'), '# existing memory\n', 'utf8');
    const restored = await registerExistingProjectMemory(restoredProjectDir, restoredMemoryRoot);

    return { projectDir, restoredProjectDir, written, lockedWrite, beforeFirstWrite, afterFirstWrite, afterLockedWrite, registryPath, empty, restored, all: listProjectMemoryReferences() };
  });
}

async function runCliHelpRegistry() {
  const projectDir = createTempProject('pm-cli-help-registry');
  await withProject(projectDir, async () => {
    ensureMemoryReady();
    await handleWrite({ content: 'Existing memory must not be registered by CLI help.', tags: ['registry'], summary: 'help registry' });
    unlinkSync(getProjectMemoryRegistryPath());
  });

  execFileSync(process.execPath, [path.resolve('dist/index.js'), '--help'], {
    cwd: projectDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      WIOLETT_AUTH_CONFIG_PATH: process.env.WIOLETT_AUTH_CONFIG_PATH ?? '',
      PROJECT_MEMORY_AGENTS_HOME: process.env.PROJECT_MEMORY_AGENTS_HOME ?? '',
      PROJECT_MEMORY_GLOBAL_ROOT: process.env.PROJECT_MEMORY_GLOBAL_ROOT ?? '',
    },
  });

  return { references: listProjectMemoryReferences() };
}

async function runMcpStartupRegistry() {
  const projectDir = createTempProject('pm-mcp-startup-registry');
  await withProject(projectDir, async () => {
    ensureMemoryReady();
    await handleWrite({ content: 'Existing project memory is discovered during MCP startup.', tags: ['registry'], summary: 'startup registry' });
  });

  writeFileSync(`${getProjectMemoryRegistryPath()}.lock`, JSON.stringify({ pid: 'test', created_at: new Date().toISOString() }), 'utf8');
  const startedAt = Date.now();
  const { client, transport } = await connectMcp(projectDir);
  try {
    const registry = await client.callTool({ name: 'memory_project_registry', arguments: {} });
    return { projectDir, registry, startupDurationMs: Date.now() - startedAt };
  } finally {
    await transport.close();
    unlinkSync(`${getProjectMemoryRegistryPath()}.lock`);
  }
}

async function connectMcp(cwd, env = {}) {
  const client = new Client({
    name: 'agent-memory-jest-client',
    version: '0.1.0',
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('dist/index.js')],
    cwd,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      PROJECT_MEMORY_AGENTS_HOME: process.env.PROJECT_MEMORY_AGENTS_HOME ?? '',
      PROJECT_MEMORY_GLOBAL_ROOT: process.env.PROJECT_MEMORY_GLOBAL_ROOT ?? '',
      WIOLETT_AUTH_CONFIG_PATH: process.env.WIOLETT_AUTH_CONFIG_PATH ?? '',
      OPENAI_API_KEY: '',
      ...env,
    },
    stderr: 'pipe',
  });

  await client.connect(transport);
  return { client, transport };
}

async function runMcpWorkspaceRoot() {
  const projectDir = createTempProject('pm-mcp-workspace-root');
  const childDir = path.join(projectDir, 'packages', 'child');
  mkdirSync(childDir, { recursive: true });

  const ids = await withProject(projectDir, async () => {
    ensureMemoryReady('project');
    const deep = await handleWrite({
      content: 'Workspace root memory survives MCP launch cwd drift',
      tags: ['workspace-root', 'mcp'],
      summary: 'Workspace root memory',
    });
    return { deep: deep.id, pointer: deep.pointer_id };
  });

  const parentProjectDir = createTempProject('pm-mcp-parent-memory');
  const nestedRepoDir = path.join(parentProjectDir, 'nested-repo');
  const nestedRepoChildDir = path.join(nestedRepoDir, 'src');
  mkdirSync(path.join(nestedRepoDir, '.git'), { recursive: true });
  mkdirSync(nestedRepoChildDir, { recursive: true });
  await withProject(parentProjectDir, async () => {
    ensureMemoryReady('project');
    await handleWrite({
      content: 'Parent project memory must not leak into nested repos',
      tags: ['workspace-root', 'nested'],
      summary: 'Parent memory',
    });
  });

  const unrelatedDir = createTempProject('pm-mcp-unrelated-cwd');
  const unrelated = await connectMcp(unrelatedDir);
  try {
    const wrongCwdList = await unrelated.client.callTool({ name: 'memory_list', arguments: {} });
    const rootedList = await unrelated.client.callTool({ name: 'memory_list', arguments: { workspace_root: projectDir } });
    const rootedIndexList = await unrelated.client.callTool({ name: 'memory_list', arguments: { workspace_root: projectDir, index_only: true } });
    const rootedInspect = await unrelated.client.callTool({ name: 'memory_inspect', arguments: { workspace_root: projectDir, view: 'all' } });
    const rootedQuery = await unrelated.client.callTool({
      name: 'memory_query',
      arguments: { workspace_root: projectDir, query: 'Workspace root memory' },
    });
    const rootedRecap = await unrelated.client.callTool({
      name: 'memory_recap',
      arguments: { workspace_root: projectDir, topic: 'Workspace root memory' },
    });
    let relativeRootResult = null;
    let relativeRootError = null;
    try {
      relativeRootResult = await unrelated.client.callTool({ name: 'memory_list', arguments: { workspace_root: '.' } });
    } catch (error) {
      relativeRootError = error instanceof Error ? error.message : String(error);
    }

    const child = await connectMcp(childDir);
    try {
      const ancestorList = await child.client.callTool({ name: 'memory_list', arguments: {} });
      const nested = await connectMcp(nestedRepoChildDir);
      try {
        const nestedRepoList = await nested.client.callTool({ name: 'memory_list', arguments: {} });
        return {
          ids,
          wrongCwdList,
          rootedList,
          rootedIndexList,
          rootedInspect,
          rootedQuery,
          rootedRecap,
          relativeRootResult,
          relativeRootError,
          ancestorList,
          nestedRepoList,
        };
      } finally {
        await nested.transport.close();
      }
    } finally {
      await child.transport.close();
    }
  } finally {
    await unrelated.transport.close();
  }
}

async function runMcpReadUninitialized() {
  const projectDir = createTempProject('pm-mcp-read-uninitialized');
  const globalRoot = path.join(projectDir, 'global-memory');
  const client = new Client({
    name: 'agent-memory-jest-client',
    version: '0.1.0',
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('dist/index.js')],
    cwd: projectDir,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      PROJECT_MEMORY_AGENTS_HOME: process.env.PROJECT_MEMORY_AGENTS_HOME ?? '',
      PROJECT_MEMORY_GLOBAL_ROOT: globalRoot,
      WIOLETT_AUTH_CONFIG_PATH: process.env.WIOLETT_AUTH_CONFIG_PATH ?? '',
      OPENAI_API_KEY: '',
    },
    stderr: 'pipe',
  });

  await client.connect(transport);
  const lite = await client.callTool({ name: 'memory_read_lite', arguments: {} });
  const list = await client.callTool({ name: 'memory_list', arguments: {} });
  const query = await client.callTool({ name: 'memory_query', arguments: { query: 'anything' } });
  const recap = await client.callTool({ name: 'memory_recap', arguments: {} });
  const reconciliationStatus = await client.callTool({ name: 'memory_reconciliation_status', arguments: {} });
  const get = await client.callTool({ name: 'memory_get', arguments: { id: 'missing' } });
  const inspect = await client.callTool({ name: 'memory_inspect', arguments: { view: 'all' } });
  await transport.close();

  return {
    projectMemoryDirCreated: existsSync(path.join(projectDir, '.memory')),
    globalMemoryDirCreated: existsSync(globalRoot),
    lite,
    list,
    query,
    recap,
    reconciliationStatus,
    get,
    inspect,
  };
}

function activationToObject(map) {
  return Object.fromEntries([...map.entries()].map(([id, value]) => [id, value]));
}

async function runActivation() {
  const projectDir = createTempProject('pm-activation');
  return withProject(projectDir, async () => {
    ensureMemoryReady();

    // Disjoint content/tags so no auto-links form (no API key -> semantic 0,
    // zero tag/token overlap -> below the 0.10 project threshold). Only the
    // manual edges below exist, making activation deterministic.
    const a = await handleWrite({ content: 'alpha apple', tags: ['alpha'], summary: 'alpha' });
    const b = await handleWrite({ content: 'bravo banana', tags: ['bravo'], summary: 'bravo' });
    const c = await handleWrite({ content: 'charlie cherry', tags: ['charlie'], summary: 'charlie' });
    const d = await handleWrite({ content: 'delta date', tags: ['delta'], summary: 'delta' });

    handleLink({ from_id: a.id, to_id: b.id, relation: 'related_to', weight: 0.9 });
    handleLink({ from_id: b.id, to_id: c.id, relation: 'depends_on', weight: 0.8 });
    handleLink({ from_id: c.id, to_id: d.id, relation: 'related_to', weight: 0.5 });

    const seeds = [{ id: a.id, weight: 1 }];
    const both = spreadingActivation({ seeds, hops: 2, decay: 0.5, minWeight: 0.2, direction: 'both', scope: 'project' });
    const hop1 = spreadingActivation({ seeds, hops: 1, decay: 0.5, minWeight: 0.2, direction: 'both', scope: 'project' });
    const capped = spreadingActivation({ seeds, hops: 2, decay: 0.5, minWeight: 0.2, maxNodes: 1, direction: 'both', scope: 'project' });
    const noSeeds = spreadingActivation({ seeds: [], hops: 2, scope: 'project' });
    const minWeightFilter = spreadingActivation({ seeds, hops: 2, decay: 0.5, minWeight: 0.85, direction: 'both', scope: 'project' });

    return {
      ids: { a: a.id, b: b.id, c: c.id, d: d.id },
      both: activationToObject(both),
      hop1: activationToObject(hop1),
      capped: activationToObject(capped),
      noSeeds: activationToObject(noSeeds),
      minWeightFilter: activationToObject(minWeightFilter),
    };
  });
}

async function runPath() {
  const projectDir = createTempProject('pm-path');
  return withProject(projectDir, async () => {
    ensureMemoryReady();

    const a = await handleWrite({ content: 'alpha apple', tags: ['alpha'], summary: 'alpha' });
    const b = await handleWrite({ content: 'bravo banana', tags: ['bravo'], summary: 'bravo' });
    const d = await handleWrite({ content: 'delta date', tags: ['delta'], summary: 'delta' });
    const e = await handleWrite({ content: 'echo elderberry', tags: ['echo'], summary: 'echo' });

    // Direct weak edge A->D (0.3, 1 hop) vs strong 2-hop A->B->D (0.9*0.9=0.81).
    handleLink({ from_id: a.id, to_id: d.id, relation: 'related_to', weight: 0.3 });
    handleLink({ from_id: a.id, to_id: b.id, relation: 'related_to', weight: 0.9 });
    handleLink({ from_id: b.id, to_id: d.id, relation: 'related_to', weight: 0.9 });

    let pointerError = false;
    try {
      handlePath({ from_id: a.pointer_id, to_id: d.id, scope: 'project' });
    } catch {
      pointerError = true;
    }

    return {
      ids: { a: a.id, b: b.id, d: d.id, e: e.id, pointer: a.pointer_id },
      shortest: handlePath({ from_id: a.id, to_id: d.id, strategy: 'shortest', scope: 'project' }),
      strongest: handlePath({ from_id: a.id, to_id: d.id, strategy: 'strongest', scope: 'project' }),
      noPath: handlePath({ from_id: a.id, to_id: e.id, scope: 'project' }),
      selfPath: handlePath({ from_id: a.id, to_id: a.id, scope: 'project' }),
      pointerError,
    };
  });
}

async function runHealth() {
  const projectDir = createTempProject('pm-health');
  return withProject(projectDir, async () => {
    ensureMemoryReady();

    const a = await handleWrite({ content: 'alpha apple', tags: ['alpha'], summary: 'alpha' });
    const b = await handleWrite({ content: 'bravo banana', tags: ['bravo'], summary: 'bravo' });
    await handleWrite({ content: 'charlie cherry', tags: ['charlie'], summary: 'charlie' }); // orphan deep
    await handleWrite({ content: 'lima lemon', tags: ['lima'], layer: 'lite' }); // orphan standalone lite

    handleLink({ from_id: a.id, to_id: b.id, relation: 'related_to', weight: 0.9 });

    return { health: handleInspect({ view: 'health' }) };
  });
}

async function runPrune() {
  const projectDir = createTempProject('pm-prune');
  return withProject(projectDir, async () => {
    ensureMemoryReady();

    const a = await handleWrite({ content: 'alpha apple', tags: ['alpha'], summary: 'alpha' });
    const b = await handleWrite({ content: 'bravo banana', tags: ['bravo'], summary: 'bravo' });
    const aEntry = handleGet({ id: a.id });
    const ts = 1700000000000;

    // Inject a controlled outgoing set on A: 2 manual (one low-weight) + 2 auto
    // (one below threshold, one dangling). Disjoint content means no auto-links
    // form on their own, so this is the entire outgoing set.
    const edges = [
      { from_id: a.id, to_id: b.id, relation: 'related_to', weight: 0.9, reason: null, source: 'manual', created_at: ts, updated_at: ts },
      { from_id: a.id, to_id: b.id, relation: 'uses_service', weight: 0.05, reason: null, source: 'manual', created_at: ts, updated_at: ts },
      { from_id: a.id, to_id: b.id, relation: 'depends_on', weight: 0.1, reason: null, source: 'auto', created_at: ts, updated_at: ts },
      { from_id: a.id, to_id: 'zznonexist', relation: 'same_area', weight: 0.5, reason: null, source: 'auto', created_at: ts, updated_at: ts },
    ];
    writeGraphFile(aEntry.file_name, edges, 'project');
    replaceOutgoingEdges(a.id, edges, 'project');

    const before = getOutgoingEdgeRecords(a.id, 'project').length;
    const dry = handleGraphPrune({ min_weight: 0.2, dry_run: true, scope: 'project' });
    const afterDry = getOutgoingEdgeRecords(a.id, 'project').length;
    const real = handleGraphPrune({ min_weight: 0.2, dry_run: false, scope: 'project' });
    const afterReal = getOutgoingEdgeRecords(a.id, 'project');

    return {
      ids: { a: a.id, b: b.id },
      before,
      dry,
      afterDry,
      real,
      afterRealCount: afterReal.length,
      afterRealSources: afterReal.map((edge) => edge.source).sort(),
      afterRealRelations: afterReal.map((edge) => edge.relation).sort(),
    };
  });
}

async function runMaintenance() {
  const projectDir = createTempProject('pm-maintenance');
  return withProject(projectDir, async () => {
    ensureMemoryReady();

    const stale = await handleWrite({ content: 'obsolete pointer target', tags: ['obsolete'], summary: 'obsolete' });
    const source = await handleWrite({ content: 'alpha release workflow', tags: ['alpha', 'release'], summary: 'alpha' });
    const target = await handleWrite({ content: 'alpha release configuration', tags: ['alpha', 'config'], summary: 'config' });
    const sourceEntry = handleGet({ id: source.id });
    const timestamp = 1700000000000;
    const danglingAuto = {
      from_id: source.id,
      to_id: 'missing-node',
      relation: 'related_to',
      weight: 0.5,
      reason: null,
      source: 'auto',
      created_at: timestamp,
      updated_at: timestamp,
    };
    const danglingManual = { ...danglingAuto, to_id: 'missing-manual-node', source: 'manual' };
    writeGraphFile(sourceEntry.file_name, [danglingAuto, danglingManual], 'project');
    replaceOutgoingEdges(source.id, [danglingAuto, danglingManual], 'project');
    writeGraphFile('orphan-graph-file', [danglingAuto], 'project');

    // Simulate an interrupted deletion: the pointer remains but its canonical
    // target is absent from both the database and canonical file tree.
    const staleEntry = handleGet({ id: stale.id });
    const stalePointer = handleGet({ id: stale.pointer_id });
    deleteEntryFile(staleEntry, 'project');
    deleteEntryFromDb(stale.id, 'project');
    const deadPointer = { ...stalePointer, id: 'dead-pointer', file_name: 'dead-pointer', ref: 'missing-node' };
    writeEntryFile(deadPointer, 'project');
    upsertEntry(deadPointer, hashEntry(deadPointer), 'project');
    // The deterministic inference also proposes this tuple. Maintenance must
    // keep this explicit relationship and simply omit the conflicting auto edge.
    handleLink({ from_id: source.id, to_id: target.id, relation: 'same_area', weight: 0.93, reason: 'Human-confirmed release relationship' });
    const sourceEdges = getOutgoingEdgeRecords(source.id, 'project');
    const manualSameArea = sourceEdges.find((edge) => edge.to_id === target.id && edge.relation === 'same_area');
    const newestManualTimestamp = manualSameArea.updated_at + 20;
    // Simulate a merge-created duplicate manual tuple. The deterministic repair
    // must retain the newest user revision instead of source-file order.
    writeGraphFile(sourceEntry.file_name, [
      ...sourceEdges,
      { ...manualSameArea, weight: 0.41, reason: 'Older manual revision', created_at: newestManualTimestamp - 10, updated_at: newestManualTimestamp - 10 },
      { ...manualSameArea, weight: 0.97, reason: 'Newest manual revision', created_at: newestManualTimestamp, updated_at: newestManualTimestamp },
    ], 'project');
    // The cache rebuild performed on a fresh MCP process must accept the same
    // malformed canonical source before maintenance has a chance to rewrite it.
    closeDb();
    resetMemoryReady();
    ensureMemoryReady();
    const coldStartManual = getOutgoingEdgeRecords(source.id, 'project').find((edge) => edge.to_id === target.id && edge.relation === 'same_area');

    const before = handleInspect({ view: 'health' });
    const dry = await handleGraphMaintenance({ scope: 'project', dry_run: true });
    const afterDry = handleInspect({ view: 'health' });
    const repaired = await handleGraphMaintenance({ scope: 'project', dry_run: false });
    const after = handleInspect({ view: 'health' });
    const graphAfterFirstMaintenance = Object.fromEntries(
      listRelative(projectDir, '.memory/graph').map((file) => [file, readFileSync(path.join(projectDir, '.memory/graph', file), 'utf8')])
    );
    const repeated = await handleGraphMaintenance({ scope: 'project', dry_run: false });
    const graphAfterSecondMaintenance = Object.fromEntries(
      listRelative(projectDir, '.memory/graph').map((file) => [file, readFileSync(path.join(projectDir, '.memory/graph', file), 'utf8')])
    );
    const preservedManual = getOutgoingEdgeRecords(source.id, 'project').find((edge) => edge.to_id === target.id && edge.relation === 'same_area');

    return { ids: { stale: stale.id, pointer: stale.pointer_id, source: source.id, target: target.id }, before, dry, afterDry, repaired, repeated, after, coldStartManual, preservedManual, graphAfterFirstMaintenance, graphAfterSecondMaintenance };
  });
}

async function runQueryExpand() {
  const projectDir = createTempProject('pm-query-expand');
  return withProject(projectDir, async () => {
    ensureMemoryReady();

    // A matches the query text; B does not (and has no embedding without a key),
    // so search alone never returns B. A manual edge connects them.
    const a = await handleWrite({ content: 'deployment rollback runbook', tags: ['deploy'], summary: 'rollback runbook' });
    const b = await handleWrite({ content: 'obscure vault token rotation', tags: ['vault'], summary: 'vault rotation' });
    handleLink({ from_id: a.id, to_id: b.id, relation: 'related_to', weight: 0.9 });

    const noExpand = await handleQuery({ query: 'deployment rollback', scope: 'project', expand: false });
    const expand = await handleQuery({ query: 'deployment rollback', scope: 'project' });

    return {
      ids: { a: a.id, b: b.id },
      noExpandCandidateIds: noExpand.candidates.map((candidate) => candidate.id),
      expandCandidateIds: expand.candidates.map((candidate) => candidate.id),
      expandCandidates: expand.candidates,
      expandAnswer: expand.answer,
    };
  });
}

async function runSynthesis() {
  const projectDir = createTempProject('pm-synthesis');
  return withProject(projectDir, async () => {
    ensureMemoryReady();
    const first = await handleWrite({
      content: 'Production deploys require the release build before upload.',
      tags: ['deploy', 'release'],
      summary: 'Release build requirement',
    });
    const second = await handleWrite({
      content: 'Deployment verification includes a health check after upload.',
      tags: ['deploy', 'verification'],
      summary: 'Deploy health check',
    });
    const recap = await handleRecap({ scope: 'project', detail: 'normal' });

    const previousFetch = globalThis.fetch;
    const previousKey = process.env.OPENAI_API_KEY;
    let responseRequest;
    process.env.OPENAI_API_KEY = 'sk-test-synthesis';
    resetModelProvider();
    globalThis.fetch = async (url, init) => {
      if (String(url).endsWith('/embeddings')) {
        return new Response(JSON.stringify({ data: [{ embedding: [] }] }), { status: 200 });
      }
      responseRequest = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ output_text: 'Run the release build, upload, then perform the health check.' }), { status: 200 });
    };

    try {
      const query = await handleQuery({ query: 'deploy health release', scope: 'project', expand: false });
      return {
        ids: { first: first.id, second: second.id },
        query,
        recap,
        responseRequest,
      };
    } finally {
      globalThis.fetch = previousFetch;
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
      resetModelProvider();
    }
  });
}

async function runSupersede() {
  const ts = 1700000000000;
  const pure = buildSupersedeOutcome(
    'SRC',
    [
      { id: 'old1', verdict: 'supersedes', confidence: 0.9, reason: 'replaced' },
      { id: 'dup1', verdict: 'duplicate', confidence: 0.8 },
      { id: 'ind1', verdict: 'independent', confidence: 0.95 },
      { id: 'low1', verdict: 'supersedes', confidence: 0.5 }, // below confidence floor
      { id: 'SRC', verdict: 'supersedes', confidence: 0.99 }, // self reference
    ],
    ts
  );

  const projectDir = createTempProject('pm-supersede');
  const writes = await withProject(projectDir, async () => {
    ensureMemoryReady();
    // Two near-identical memories. With no model/key, supersede detection is a
    // no-op: the write result must carry no supersedes/duplicate_of.
    const first = await handleWrite({ content: 'The deploy region is us-east-1', tags: ['deploy', 'region'], summary: 'deploy region' });
    const second = await handleWrite({ content: 'The deploy region is now eu-west-1, not us-east-1', tags: ['deploy', 'region'], summary: 'deploy region updated' });
    return { first, second };
  });

  return { pure, ...writes };
}

async function runDerank() {
  const projectDir = createTempProject('pm-derank');
  return withProject(projectDir, async () => {
    ensureMemoryReady();

    // A and B match the query equally; C supersedes B (manual supersedes edge),
    // so B carries an incoming supersedes edge and must be downranked.
    const a = await handleWrite({ content: 'deploy region config alpha', tags: ['deploy'], summary: 'a' });
    const b = await handleWrite({ content: 'deploy region config bravo', tags: ['deploy'], summary: 'b' });
    const c = await handleWrite({ content: 'vault token rotation secret', tags: ['vault'], summary: 'c' });
    handleLink({ from_id: c.id, to_id: b.id, relation: 'supersedes', weight: 0.9 });

    const search = await handleSearch({ query: 'deploy region config', scope: 'project' });

    // Recall: primary P links to a fresh memory D and the superseded B at equal
    // weight; the superseded one must sort after the fresh one in related order.
    const p = await handleWrite({ content: 'primary anchor note xyz', tags: ['anchor'], summary: 'p' });
    const d = await handleWrite({ content: 'fresh distinct note qwe', tags: ['fresh'], summary: 'd' });
    handleLink({ from_id: p.id, to_id: b.id, relation: 'related_to', weight: 0.5 });
    handleLink({ from_id: p.id, to_id: d.id, relation: 'related_to', weight: 0.5 });
    const recall = await handleRecall({ memory_id: p.id, scope: 'project' });

    return {
      ids: { a: a.id, b: b.id, c: c.id, d: d.id, p: p.id },
      search: search.map((entry) => ({ id: entry.id, score: entry.score, superseded: entry.superseded })),
      recallRelatedIds: recall.sources.filter((source) => source.role === 'related').map((source) => source.id),
    };
  });
}

async function runViewServer() {
  const projectDir = createTempProject('pm-view');
  return withProject(projectDir, async () => {
    ensureMemoryReady('project');

    const write = async (content, tags, summary) => {
      const result = await handleWrite({ content, tags, summary });
      return handleGet({ id: result.id });
    };

    const a = await write('Deployment pipeline uploads built assets to MinIO buckets', ['deploy', 'minio'], 'Deploy pipeline');
    const b = await write('Static bucket configuration consumed by deployment jobs', ['bucket', 'config'], 'Bucket config');
    const c = await write('Next.js plus FastAPI is the preferred testnet stack', ['stack', 'nextjs'], 'Preferred stack');
    const d = await write('Old deploy pipeline using rsync to a VPS (deprecated)', ['deploy', 'legacy'], 'Legacy deploy');
    const e = await write('Embedding model is OpenAI text-embedding-3-small', ['embeddings'], 'Embedding model');

    handleLink({ from_id: a.id, to_id: b.id, relation: 'uses_service', weight: 0.82, reason: 'pipeline reads bucket config' });
    handleLink({ from_id: a.id, to_id: b.id, relation: 'related_to', weight: 0.6, reason: 'both about asset delivery' });
    handleLink({ from_id: b.id, to_id: c.id, relation: 'part_of', weight: 0.55, reason: 'config part of stack' });
    handleLink({ from_id: a.id, to_id: d.id, relation: 'supersedes', weight: 0.9, reason: 'new pipeline replaces rsync' });
    handleLink({ from_id: c.id, to_id: e.id, relation: 'depends_on', weight: 0.4, reason: 'stack depends on model' });

    // Inject deterministic clustered embeddings so the scatter projects (no model).
    const embDir = path.join(projectDir, '.memory', 'embeddings');
    [a, b, c, d, e].forEach((entry, index) => {
      const base = index < 2 ? 0 : 1;
      const vector = Array.from({ length: 6 }, (_unused, k) => Number((base + Math.sin((index + 1) * (k + 1)) * 0.3).toFixed(4)));
      writeFileSync(path.join(embDir, `${entry.file_name}.embeddings`), JSON.stringify(vector));
    });

    // Re-ingest from disk so the injected embeddings reach the cache. (resetMemoryReady
    // keys on projectDir while the cached flag keys on the realpath cwd, so rebuild
    // explicitly rather than relying on the lazy reset path.)
    rebuildFromFiles('project');

    const handle = await startViewServer({ scope: 'project', port: 0, version: '9.9.9' });
    const base = handle.url;
    const json = async (route) => (await fetch(base + route)).json();
    try {
      const meta = await json('/api/meta');
      const graph = await json('/api/graph');
      const health = await json('/api/health');
      const scatter = await json('/api/scatter');
      const list = await json('/api/list');
      const search = await json('/api/search?q=bucket%20config');
      const query = await json('/api/query?q=bucket%20config&expand=true');
      const detail = await json(`/api/memory/${a.id}`);
      const missing = await fetch(`${base}/api/memory/does-not-exist`);
      const pathResult = await json(`/api/path?from=${a.id}&to=${c.id}&strategy=shortest`);
      const indexHtml = await (await fetch(`${base}/`)).text();
      const traversal = await fetch(`${base}/..%2f..%2fetc%2fpasswd`, { redirect: 'manual' });

      return {
        port: handle.port,
        metaEnabled: meta.enabled === true,
        metaVersion: meta.version,
        embeddingsAvailable: meta.embeddings_available,
        graphNodes: graph.nodes.length,
        graphEdges: graph.edges.length,
        supersededCount: graph.nodes.filter((node) => node.superseded).length,
        symmetricEdgeCount: graph.edges.filter((edge) => edge.symmetric).length,
        hasStandalone: graph.nodes.some((node) => node.is_standalone),
        healthEdges: health.edges.total,
        scatterN: scatter.n,
        scatterPoints: scatter.points.length,
        listCount: list.items.length,
        searchCount: search.length,
        queryHasCandidates: Array.isArray(query.candidates),
        queryCandidateCount: Array.isArray(query.candidates) ? query.candidates.length : -1,
        detailId: detail.id,
        detailHasLinks: Boolean(detail.links),
        missingStatus: missing.status,
        pathFound: pathResult.found,
        pathHops: pathResult.hops,
        servesIndex: indexHtml.includes('id="root"'),
        traversalStatus: traversal.status,
      };
    } finally {
      await handle.close();
    }
  });
}

async function runViewCli() {
  return {
    output: formatQuietViewStarted('http://127.0.0.1:7077'),
    outro: formatInteractiveViewOutro('http://127.0.0.1:7077'),
  };
}

const mode = process.argv[2];

const runners = {
  'view-cli': runViewCli,
  'view-server': runViewServer,
  activation: runActivation,
  path: runPath,
  health: runHealth,
  prune: runPrune,
  maintenance: runMaintenance,
  'query-expand': runQueryExpand,
  synthesis: runSynthesis,
  supersede: runSupersede,
  derank: runDerank,
  setup: runSetup,
  'setup-local-embeddings': runSetupLocalEmbeddings,
  memory: runMemory,
  global: runGlobal,
  'update-inspect': runUpdateInspect,
  'legacy-json': runLegacyJson,
  'legacy-db': runLegacyDb,
  mcp: runMcp,
  'mcp-workspace-root': runMcpWorkspaceRoot,
  'mcp-read-uninitialized': runMcpReadUninitialized,
  'project-registry': runProjectRegistry,
  'cli-help-registry': runCliHelpRegistry,
  'mcp-startup-registry': runMcpStartupRegistry,
};

assert(mode in runners, `Unknown mode: ${mode}`);

const result = await runners[mode]();
console.log(JSON.stringify(result, null, 2));
