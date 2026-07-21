import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { ensureMemoryReadable, ensureMemoryReady } from '../runtime.js';
import { setupProjectMemory } from '../setup.js';
import { handleDelete } from './delete.js';
import { handleGraphView } from './graph-view.js';
import { handleInspect } from './inspect.js';
import { handleLink, handleUnlink } from './graph.js';
import { handleList } from './list.js';
import { handleQuery } from './query.js';
import { handleRecap } from './recap.js';
import { handleRecall } from './recall.js';
import { handleGet } from './get.js';
import { handleReadLite } from './read-lite.js';
import { handleSave } from './save.js';
import { handleSearch } from './search.js';
import { handleUpdate } from './update.js';
import { asTextResult, detailSchema, directionEnum, relationEnum, scopeSchema, workspaceRootSchema } from './registry-helpers.js';
import { registerGraphTools } from './register-graph.js';
import type { MemoryScope } from '../scope.js';
import { withProjectRoot, withProjectRootAsync } from '../scope.js';

function emptyQueryResult() {
  return {
    answer: '',
    sources: [],
    candidates: [],
  };
}

function emptyInspectResult(view?: 'memory' | 'index' | 'graph' | 'health' | 'all') {
  if (view === 'all') return { memories: [], index: [], graph: [] };
  if (view === 'health') return {};
  return [];
}

function missingMemoryError(id: string): Error {
  return new Error(`Memory "${id}" does not exist.`);
}

export function registerMemoryTools(server: McpServer): void {
  registerCanonicalTools(server);
  registerGraphTools(server);
  registerCompatibilityTools(server, 'project', '');
  registerCompatibilityTools(server, 'global', 'global_');
}

function registerCanonicalTools(server: McpServer): void {
  server.registerTool(
    'memory_setup',
    {
      title: 'Setup Memory',
      description: 'Initialize or repair project-local memory storage for the current repo.',
      inputSchema: z.object({ workspace_root: workspaceRootSchema }),
    },
    async ({ workspace_root }) => withProjectRoot(workspace_root, () => asTextResult(setupProjectMemory()))
  );

  server.registerTool(
    'memory_save',
    {
      title: 'Save Memory',
      description: 'Proactively save a new durable project or global lesson after completed non-trivial work when reusable preferences, workflows, gotchas, root causes, fix patterns, or verification sequences emerged. Do not save raw progress or transcripts.',
      inputSchema: z.object({
        scope: scopeSchema.describe('Defaults to project.'),
        workspace_root: workspaceRootSchema,
        content: z.string().min(1),
        tags: z.array(z.string()).optional(),
        summary: z.string().optional(),
      }),
    },
    async ({ scope, workspace_root, content, tags, summary }) => withProjectRootAsync(workspace_root, async () => {
      const resolvedScope = scope ?? 'project';
      ensureMemoryReady(resolvedScope);
      return asTextResult(await handleSave({ scope: resolvedScope, content, tags, summary }));
    })
  );

  server.registerTool(
    'memory_update',
    {
      title: 'Update Memory',
      description: 'Proactively update an existing canonical memory after completed non-trivial work when the durable lesson changed or was refined; its ID and manual graph links are preserved.',
      inputSchema: z.object({
        scope: scopeSchema.describe('Defaults to project.'),
        workspace_root: workspaceRootSchema,
        memory_id: z.string().min(1),
        content: z.string().min(1),
        tags: z.array(z.string()).optional(),
        summary: z.string().optional(),
      }),
    },
    async ({ scope, workspace_root, memory_id, content, tags, summary }) => withProjectRootAsync(workspace_root, async () => {
      const resolvedScope = scope ?? 'project';
      ensureMemoryReady(resolvedScope);
      return asTextResult(await handleUpdate({ scope: resolvedScope, memory_id, content, tags, summary }));
    })
  );

  server.registerTool(
    'memory_recall',
    {
      title: 'Recall Memory',
      description: 'Return compiled context for one memory and its valuable relations.',
      inputSchema: z.object({
        scope: scopeSchema.describe('Defaults to project.'),
        workspace_root: workspaceRootSchema,
        memory_id: z.string().min(1),
        detail: detailSchema,
        max_depth: z.number().int().min(1).max(4).optional(),
        include_sources: z.boolean().optional(),
      }),
    },
    async ({ scope, workspace_root, memory_id, detail, max_depth, include_sources }) => withProjectRootAsync(workspace_root, async () => {
      const resolvedScope = scope ?? 'project';
      if (!ensureMemoryReadable(resolvedScope)) {
        return asTextResult(null);
      }
      return asTextResult(await handleRecall({ scope: resolvedScope, memory_id, detail, max_depth, include_sources }));
    })
  );

  server.registerTool(
    'memory_query',
    {
      title: 'Query Memory',
      description: 'Answer a focused question by searching and synthesizing multiple relevant memories with source references. Use proactively when prior repository or user context could affect non-trivial work.',
      inputSchema: z.object({
        scope: scopeSchema.describe('Defaults to project.'),
        workspace_root: workspaceRootSchema,
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).optional(),
        detail: detailSchema,
        expand: z.boolean().optional().describe('Graph-expand candidates with linked memories. Defaults to true.'),
        expand_hops: z.number().int().min(1).max(2).optional(),
      }),
    },
    async ({ scope, workspace_root, query, limit, detail, expand, expand_hops }) => withProjectRootAsync(workspace_root, async () => {
      const resolvedScope = scope ?? 'project';
      if (!ensureMemoryReadable(resolvedScope)) {
        return asTextResult(emptyQueryResult());
      }
      return asTextResult(await handleQuery({ scope: resolvedScope, query, limit, detail, expand, expand_hops }));
    })
  );

  server.registerTool(
    'memory_recap',
    {
      title: 'Recap Memory',
      description: 'Synthesize a broad, multi-memory recap for non-trivial work, compaction recovery, or context handoff. Use topic to focus the recap; omit it to recover the most important current memories.',
      inputSchema: z.object({
        scope: scopeSchema.describe('Defaults to project.'),
        workspace_root: workspaceRootSchema,
        topic: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(50).optional(),
        detail: detailSchema,
      }),
    },
    async ({ scope, workspace_root, topic, limit, detail }) => withProjectRootAsync(workspace_root, async () => {
      const resolvedScope = scope ?? 'project';
      if (!ensureMemoryReadable(resolvedScope)) {
        return asTextResult(emptyQueryResult());
      }
      return asTextResult(await handleRecap({ scope: resolvedScope, topic, limit, detail }));
    })
  );

  server.registerTool(
    'memory_list',
    {
      title: 'List Memories',
      description: 'List memory records. By default this includes deep memories and lite index records; set index_only to true for lightweight index browsing.',
      inputSchema: z.object({
        scope: scopeSchema.describe('Defaults to project.'),
        workspace_root: workspaceRootSchema,
        query: z.string().optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        index_only: z.boolean().optional().describe('Return only lightweight index/pointer records. Defaults to false.'),
      }),
    },
    async ({ scope, workspace_root, query, tags, limit, index_only }) => withProjectRootAsync(workspace_root, async () => {
      const resolvedScope = scope ?? 'project';
      if (!ensureMemoryReadable(resolvedScope)) {
        return asTextResult([]);
      }
      return asTextResult(handleList({ scope: resolvedScope, query, tags, limit, index_only }));
    })
  );

  server.registerTool(
    'memory_inspect',
    {
      title: 'Inspect Memory',
      description: 'Raw maintenance/debug view of memory, index, and graph records, or graph health metrics.',
      inputSchema: z.object({
        scope: scopeSchema.describe('Defaults to project.'),
        workspace_root: workspaceRootSchema,
        view: z.enum(['memory', 'index', 'graph', 'health', 'all']).optional(),
        memory_id: z.string().optional(),
        include_embedding: z.boolean().optional(),
      }),
    },
    async ({ scope, workspace_root, view, memory_id, include_embedding }) => withProjectRootAsync(workspace_root, async () => {
      const resolvedScope = scope ?? 'project';
      if (!ensureMemoryReadable(resolvedScope)) {
        return asTextResult(emptyInspectResult(view));
      }
      return asTextResult(handleInspect({ scope: resolvedScope, view, memory_id, include_embedding }));
    })
  );

  server.registerTool(
    'memory_delete',
    {
      title: 'Delete Memory',
      description: 'Delete one memory or index record by ID.',
      inputSchema: z.object({
        scope: scopeSchema,
        workspace_root: workspaceRootSchema,
        memory_id: z.string().min(1).optional(),
        id: z.string().min(1).optional(),
      }),
    },
    async ({ scope, workspace_root, memory_id, id }) => withProjectRootAsync(workspace_root, async () => {
      const resolvedScope = scope ?? 'project';
      const resolvedId = memory_id ?? id;
      if (!resolvedId) {
        throw new Error('memory_id is required');
      }
      ensureMemoryReady(resolvedScope);
      return asTextResult(handleDelete({ id: resolvedId, scope: resolvedScope }));
    })
  );

  server.registerTool(
    'memory_link',
    {
      title: 'Link Memories',
      description: 'Create a weighted manual graph edge between two graph-capable memories.',
      inputSchema: z.object({
        scope: scopeSchema,
        workspace_root: workspaceRootSchema,
        from_id: z.string().min(1),
        to_id: z.string().min(1),
        relation: relationEnum,
        weight: z.number().min(0).max(1),
        reason: z.string().optional(),
      }),
    },
    async ({ scope, workspace_root, from_id, to_id, relation, weight, reason }) => withProjectRootAsync(workspace_root, async () => {
      const resolvedScope = scope ?? 'project';
      ensureMemoryReady(resolvedScope);
      return asTextResult(handleLink({ scope: resolvedScope, from_id, to_id, relation, weight, reason }));
    })
  );

  server.registerTool(
    'memory_unlink',
    {
      title: 'Unlink Memories',
      description: 'Remove a graph edge between two graph-capable memories.',
      inputSchema: z.object({
        scope: scopeSchema,
        workspace_root: workspaceRootSchema,
        from_id: z.string().min(1),
        to_id: z.string().min(1),
        relation: relationEnum,
      }),
    },
    async ({ scope, workspace_root, from_id, to_id, relation }) => withProjectRootAsync(workspace_root, async () => {
      const resolvedScope = scope ?? 'project';
      ensureMemoryReady(resolvedScope);
      return asTextResult(handleUnlink({ scope: resolvedScope, from_id, to_id, relation }));
    })
  );

  server.registerTool(
    'memory_graph',
    {
      title: 'Memory Graph',
      description: 'Read graph neighbors or a bounded subgraph for a graph-capable memory.',
      inputSchema: z.object({
        scope: scopeSchema,
        workspace_root: workspaceRootSchema,
        memory_id: z.string().min(1),
        view: z.enum(['neighbors', 'subgraph']),
        depth: z.number().int().min(1).max(4).optional(),
        direction: directionEnum.optional(),
        relations: z.array(relationEnum).optional(),
        min_weight: z.number().min(0).max(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        max_nodes: z.number().int().min(1).max(200).optional(),
      }),
    },
    async ({ scope, workspace_root, memory_id, view, depth, direction, relations, min_weight, limit, max_nodes }) => withProjectRootAsync(workspace_root, async () => {
      const resolvedScope = scope ?? 'project';
      if (!ensureMemoryReadable(resolvedScope)) {
        throw missingMemoryError(memory_id);
      }
      return asTextResult(handleGraphView({ scope: resolvedScope, memory_id, view, depth, direction, relations, min_weight, limit, max_nodes }));
    })
  );
}

function registerCompatibilityTools(server: McpServer, scope: MemoryScope, prefix: '' | 'global_'): void {
  server.registerTool(
    `${prefix}memory_write`,
    {
      title: scope === 'global' ? 'Write Global Memory' : 'Write Memory',
      description: 'Compatibility alias for memory_save.',
      inputSchema: z.object({
        content: z.string().min(1),
        workspace_root: workspaceRootSchema,
        tags: z.array(z.string()).optional(),
        summary: z.string().optional(),
        layer: z.enum(['lite', 'deep']).optional(),
      }),
    },
    async ({ content, workspace_root, tags, summary, layer }) => withProjectRootAsync(workspace_root, async () => {
      ensureMemoryReady(scope);
      return asTextResult(await handleSave({ content, tags, summary, layer, scope }));
    })
  );

  server.registerTool(
    `${prefix}memory_get`,
    {
      title: scope === 'global' ? 'Recall Global Memory' : 'Recall Memory',
      description: 'Compatibility alias for memory_recall.',
      inputSchema: z.object({ id: z.string().min(1), workspace_root: workspaceRootSchema }),
    },
    async ({ id, workspace_root }) => withProjectRootAsync(workspace_root, async () => {
      if (!ensureMemoryReadable(scope)) {
        return asTextResult(null);
      }
      return asTextResult(handleGet({ id, scope }));
    })
  );

  server.registerTool(
    `${prefix}memory_read_lite`,
    {
      title: scope === 'global' ? 'List Global Memory Index' : 'List Memory Index',
      description: 'Compatibility alias for memory_list with index_only=true.',
      inputSchema: z.object({ workspace_root: workspaceRootSchema }),
    },
    async ({ workspace_root }) => withProjectRootAsync(workspace_root, async () => {
      if (!ensureMemoryReadable(scope)) {
        return asTextResult([]);
      }
      return asTextResult(handleReadLite(scope));
    })
  );

  server.registerTool(
    `${prefix}memory_search`,
    {
      title: scope === 'global' ? 'Query Global Memory' : 'Query Memory',
      description: 'Compatibility alias for memory_query.',
      inputSchema: z.object({
        query: z.string().min(1),
        workspace_root: workspaceRootSchema,
        limit: z.number().int().min(1).max(50).optional(),
      }),
    },
    async ({ query, workspace_root, limit }) => withProjectRootAsync(workspace_root, async () => {
      if (!ensureMemoryReadable(scope)) {
        return asTextResult([]);
      }
      return asTextResult(await handleSearch({ query, limit, scope }));
    })
  );

  if (prefix) {
    server.registerTool(
      `${prefix}memory_delete`,
      {
        title: 'Delete Global Memory',
        description: 'Compatibility alias for memory_delete.',
        inputSchema: z.object({ id: z.string().min(1), workspace_root: workspaceRootSchema }),
      },
      async ({ id, workspace_root }) => withProjectRootAsync(workspace_root, async () => {
        ensureMemoryReady(scope);
        return asTextResult(handleDelete({ id, scope }));
      })
    );

    server.registerTool(
      `${prefix}memory_link`,
      {
        title: 'Link Global Memories',
        description: 'Compatibility alias for memory_link.',
        inputSchema: z.object({
          from_id: z.string().min(1),
          to_id: z.string().min(1),
          workspace_root: workspaceRootSchema,
          relation: relationEnum,
          weight: z.number().min(0).max(1),
          reason: z.string().optional(),
        }),
      },
      async ({ from_id, to_id, workspace_root, relation, weight, reason }) => withProjectRootAsync(workspace_root, async () => {
        ensureMemoryReady(scope);
        return asTextResult(handleLink({ from_id, to_id, relation, weight, reason, scope }));
      })
    );

    server.registerTool(
      `${prefix}memory_unlink`,
      {
        title: 'Unlink Global Memories',
        description: 'Compatibility alias for memory_unlink.',
        inputSchema: z.object({
          from_id: z.string().min(1),
          to_id: z.string().min(1),
          workspace_root: workspaceRootSchema,
          relation: relationEnum,
        }),
      },
      async ({ from_id, to_id, workspace_root, relation }) => withProjectRootAsync(workspace_root, async () => {
        ensureMemoryReady(scope);
        return asTextResult(handleUnlink({ from_id, to_id, relation, scope }));
      })
    );
  }

  server.registerTool(
    `${prefix}memory_neighbors`,
    {
      title: scope === 'global' ? 'Global Memory Neighbors' : 'Memory Neighbors',
      description: 'Compatibility alias for memory_graph view=neighbors.',
      inputSchema: z.object({
        id: z.string().min(1),
        workspace_root: workspaceRootSchema,
        direction: directionEnum.optional(),
        relations: z.array(relationEnum).optional(),
        min_weight: z.number().min(0).max(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
    async ({ id, workspace_root, direction, relations, min_weight, limit }) => withProjectRootAsync(workspace_root, async () => {
      if (!ensureMemoryReadable(scope)) {
        throw missingMemoryError(id);
      }
      return asTextResult(handleGraphView({ memory_id: id, view: 'neighbors', direction, relations, min_weight, limit, scope }));
    })
  );

  server.registerTool(
    `${prefix}memory_subgraph`,
    {
      title: scope === 'global' ? 'Global Memory Subgraph' : 'Memory Subgraph',
      description: 'Compatibility alias for memory_graph view=subgraph.',
      inputSchema: z.object({
        id: z.string().min(1),
        workspace_root: workspaceRootSchema,
        depth: z.number().int().min(1).max(4).optional(),
        direction: directionEnum.optional(),
        relations: z.array(relationEnum).optional(),
        min_weight: z.number().min(0).max(1).optional(),
        max_nodes: z.number().int().min(1).max(200).optional(),
      }),
    },
    async ({ id, workspace_root, depth, direction, relations, min_weight, max_nodes }) => withProjectRootAsync(workspace_root, async () => {
      if (!ensureMemoryReadable(scope)) {
        throw missingMemoryError(id);
      }
      return asTextResult(handleGraphView({ memory_id: id, view: 'subgraph', depth, direction, relations, min_weight, max_nodes, scope }));
    })
  );

  server.registerTool(
    `${prefix}memory_read_all`,
    {
      title: scope === 'global' ? 'Inspect Global Memory' : 'Inspect Memory',
      description: 'Compatibility alias for memory_inspect view=all.',
      inputSchema: z.object({ workspace_root: workspaceRootSchema }),
    },
    async ({ workspace_root }) => withProjectRootAsync(workspace_root, async () => {
      if (!ensureMemoryReadable(scope)) {
        return asTextResult(emptyInspectResult('all'));
      }
      return asTextResult(handleInspect({ scope, view: 'all' }));
    })
  );
}
