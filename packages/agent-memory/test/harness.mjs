import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { closeDb } from '../dist/db.js';
import { setupProjectMemory } from '../dist/setup.js';
import { detectMemoryState, ensureMemoryReady, resetMemoryReady } from '../dist/runtime.js';
import { getGlobalMemoryRoot } from '../dist/scope.js';
import { handleWrite } from '../dist/tools/write.js';
import { handleReadLite } from '../dist/tools/read-lite.js';
import { handleReadAll } from '../dist/tools/read-all.js';
import { handleGet } from '../dist/tools/get.js';
import { handleSearch } from '../dist/tools/search.js';
import { handleDelete } from '../dist/tools/delete.js';
import { handleLink, handleNeighbors, handleSubgraph, handleUnlink } from '../dist/tools/graph.js';
import { rebuildFromFiles } from '../dist/rebuild.js';

if (!process.env.PROJECT_MEMORY_GLOBAL_ROOT) {
  process.env.PROJECT_MEMORY_GLOBAL_ROOT = mkdtempSync(path.join(os.tmpdir(), 'pm-global-root-'));
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
  try {
    return await fn();
  } finally {
    closeDb();
    resetMemoryReady('project', projectDir);
    resetMemoryReady('global');
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

async function runMemory() {
  const projectDir = createTempProject('pm-memory');
  return withProject(projectDir, async () => {
    let errorMessage = '';
    try {
      ensureMemoryReady();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    setupProjectMemory();
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
      content: 'Preferred stack: Next.js plus FastAPI',
      tags: ['stack'],
      layer: 'lite',
    });

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

    return {
      guard_error: errorMessage,
      ids: { deep: deep.id, service: service.id, lite: lite.id },
      memoryFiles: listRelative(projectDir, '.memory/memories'),
      embeddingFiles: listRelative(projectDir, '.memory/embeddings'),
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

async function runLegacyJson() {
  const projectDir = createTempProject('pm-legacy-json');
  return withProject(projectDir, async () => {
    mkdirSync(path.join(projectDir, '.memory', 'entries'), { recursive: true });
    writeFileSync(
      path.join(projectDir, '.memory', 'entries', 'abc123.json'),
      JSON.stringify(
        {
          id: 'abc123',
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

    ensureMemoryReady();
    return {
      memoryFiles: listRelative(projectDir, '.memory/memories'),
      embeddingFiles: listRelative(projectDir, '.memory/embeddings'),
      migrated: handleGet({ id: 'abc123' }),
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
    command: 'bash',
    args: [path.resolve('../..', 'plugins/agent-memory/scripts/start-mcp.sh')],
    cwd: projectDir,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      PROJECT_MEMORY_GLOBAL_ROOT: process.env.PROJECT_MEMORY_GLOBAL_ROOT ?? '',
    },
    stderr: 'pipe',
  });

  await client.connect(transport);
  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  const setup = await client.callTool({ name: 'memory_setup', arguments: {} });
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
  const lite = await client.callTool({ name: 'memory_read_lite', arguments: {} });
  const globalLite = await client.callTool({ name: 'global_memory_read_lite', arguments: {} });
  await transport.close();

  return {
    toolNames,
    setup,
    write,
    lite,
    globalWrite,
    globalLite,
  };
}

const mode = process.argv[2];

const runners = {
  setup: runSetup,
  memory: runMemory,
  global: runGlobal,
  'legacy-json': runLegacyJson,
  'legacy-db': runLegacyDb,
  mcp: runMcp,
};

assert(mode in runners, `Unknown mode: ${mode}`);

const result = await runners[mode]();
console.log(JSON.stringify(result, null, 2));
