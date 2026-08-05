import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { ensureMemoryReadable, ensureMemoryReady } from '../runtime.js';
import { handlePath, type PathStrategy } from './path.js';
import { handleGraphMaintenance, handleGraphPrune } from './graph.js';
import { asTextResult, directionEnum, localDestructiveAnnotations, localReadOnlyAnnotations, relationEnum, scopeSchema, workspaceRootSchema } from './registry-helpers.js';
import type { GraphDirection, GraphRelation } from '../graph.js';
import type { MemoryScope } from '../scope.js';
import { withProjectRoot } from '../scope.js';

const strategyEnum = z.enum(['shortest', 'strongest']);

interface PathInput {
  from_id: string;
  to_id: string;
  workspace_root?: string;
  direction?: GraphDirection;
  relations?: GraphRelation[];
  min_weight?: number;
  max_depth?: number;
  strategy?: PathStrategy;
}

interface PruneInput {
  workspace_root?: string;
  dry_run?: boolean;
  drop_dangling?: boolean;
  min_weight?: number;
}

interface MaintenanceInput {
  workspace_root?: string;
  dry_run?: boolean;
}

const pathFields = {
  from_id: z.string().min(1),
  to_id: z.string().min(1),
  direction: directionEnum.optional(),
  relations: z.array(relationEnum).optional(),
  min_weight: z.number().min(0).max(1).optional(),
  max_depth: z.number().int().min(1).max(6).optional(),
  strategy: strategyEnum.optional(),
};

const pruneFields = {
  dry_run: z.boolean().optional().describe('Report-only when true (default).'),
  drop_dangling: z.boolean().optional(),
  min_weight: z.number().min(0).max(1).optional(),
};

function runPath(scope: MemoryScope, input: PathInput) {
  return withProjectRoot(input.workspace_root, () => {
    if (!ensureMemoryReadable(scope)) {
      return asTextResult({
        from_id: input.from_id,
        to_id: input.to_id,
        found: false,
        strategy: input.strategy ?? 'shortest',
        path: [],
        edges: [],
        hops: 0,
        total_weight: 0,
      });
    }
    return asTextResult(handlePath({ ...input, scope }));
  });
}

function runPrune(scope: MemoryScope, input: PruneInput) {
  return withProjectRoot(input.workspace_root, () => {
    ensureMemoryReady(scope);
    return asTextResult(handleGraphPrune({ ...input, scope }));
  });
}

function runMaintenance(scope: MemoryScope, input: MaintenanceInput) {
  return withProjectRoot(input.workspace_root, async () => {
    ensureMemoryReady(scope);
    return asTextResult(await handleGraphMaintenance({ ...input, scope }));
  });
}

export function registerGraphTools(server: McpServer): void {
  server.registerTool(
    'memory_path',
    {
      title: 'Memory Path',
      description: 'Find a path between two memories: shortest (fewest hops) or strongest (highest edge-weight product).',
      annotations: localReadOnlyAnnotations,
      inputSchema: z.object({ scope: scopeSchema, workspace_root: workspaceRootSchema, ...pathFields }),
    },
    async ({ scope, ...input }) => runPath(scope ?? 'project', input)
  );

  server.registerTool(
    'global_memory_path',
    {
      title: 'Global Memory Path',
      description: 'Find a path between two global memories.',
      annotations: localReadOnlyAnnotations,
      inputSchema: z.object({ workspace_root: workspaceRootSchema, ...pathFields }),
    },
    async (input) => runPath('global', input)
  );

  server.registerTool(
    'memory_graph_prune',
    {
      title: 'Prune Graph',
      description: 'Remove unhealthy AUTO edges (dangling and/or below a weight floor); manual edges are never touched. Defaults to a dry run.',
      annotations: localDestructiveAnnotations,
      inputSchema: z.object({ scope: scopeSchema, workspace_root: workspaceRootSchema, ...pruneFields }),
    },
    async ({ scope, ...input }) => runPrune(scope ?? 'project', input)
  );

  server.registerTool(
    'memory_graph_maintain',
    {
      title: 'Maintain Graph',
      description: 'Repair dead index pointers, orphan graph files, and structurally impossible edges, then rebuild AUTO links. Valid manual edges and canonical memories are preserved. Defaults to a dry run.',
      annotations: localDestructiveAnnotations,
      inputSchema: z.object({ scope: scopeSchema, workspace_root: workspaceRootSchema, dry_run: z.boolean().optional().describe('Report-only when true (default).') }),
    },
    async ({ scope, ...input }) => runMaintenance(scope ?? 'project', input)
  );

  server.registerTool(
    'global_memory_graph_prune',
    {
      title: 'Prune Global Graph',
      description: 'Remove unhealthy AUTO edges from the global graph. Defaults to a dry run.',
      annotations: localDestructiveAnnotations,
      inputSchema: z.object({ workspace_root: workspaceRootSchema, ...pruneFields }),
    },
    async (input) => runPrune('global', input)
  );

  server.registerTool(
    'global_memory_graph_maintain',
    {
      title: 'Maintain Global Graph',
      description: 'Repair dead pointers, orphan graph files, and structurally impossible edges, then rebuild AUTO links in the global graph. Defaults to a dry run.',
      annotations: localDestructiveAnnotations,
      inputSchema: z.object({ workspace_root: workspaceRootSchema, dry_run: z.boolean().optional().describe('Report-only when true (default).') }),
    },
    async (input) => runMaintenance('global', input)
  );
}
