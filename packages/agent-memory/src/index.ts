#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { persistOpenAIKeyFromEnvironment, setStoredOpenAIApiKey } from './config.js';
import { GRAPH_RELATIONS } from './graph.js';
import { getResolvedOpenAIApiKey, resetOpenAIClient } from './openai.js';
import { ensureMemoryReady } from './runtime.js';
import type { MemoryScope } from './scope.js';
import { handleDelete } from './tools/delete.js';
import { handleGet } from './tools/get.js';
import { handleLink, handleNeighbors, handleSubgraph, handleUnlink } from './tools/graph.js';
import { handleReadAll } from './tools/read-all.js';
import { handleReadLite } from './tools/read-lite.js';
import { handleSearch } from './tools/search.js';
import { handleWrite } from './tools/write.js';
import { setupProjectMemory } from './setup.js';

const VERSION = '0.1.2';

function asTextResult(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload),
      },
    ],
  };
}

function registerCommonMemoryTools(server: McpServer, scope: MemoryScope, prefix: '' | 'global_'): void {
  const relationEnum = z.enum(GRAPH_RELATIONS);
  const directionEnum = z.enum(['outgoing', 'incoming', 'both']);
  const scopeLabel = scope === 'global' ? 'global' : 'project';
  const deepLabel = scope === 'global' ? 'global deep memory' : 'deep memory';
  const readLiteTitle = scope === 'global' ? 'Read Global Lite Memory' : 'Read Lite Memory';
  const readAllTitle = scope === 'global' ? 'Read All Global Memory' : 'Read All Memory';
  const getTitle = scope === 'global' ? 'Get Global Memory' : 'Get Memory';
  const writeTitle = scope === 'global' ? 'Write Global Memory' : 'Write Memory';
  const searchTitle = scope === 'global' ? 'Search Global Memory' : 'Search Memory';
  const deleteTitle = scope === 'global' ? 'Delete Global Memory' : 'Delete Memory';
  const linkTitle = scope === 'global' ? 'Link Global Memories' : 'Link Memories';
  const unlinkTitle = scope === 'global' ? 'Unlink Global Memories' : 'Unlink Memories';
  const neighborsTitle = scope === 'global' ? 'Global Memory Neighbors' : 'Memory Neighbors';
  const subgraphTitle = scope === 'global' ? 'Global Memory Subgraph' : 'Memory Subgraph';

  server.registerTool(
    `${prefix}memory_write`,
    {
      title: writeTitle,
      description:
        `Save ${scopeLabel} knowledge. Deep writes automatically create a lite pointer. Use layer="lite" only for short standalone facts.`,
      inputSchema: z.object({
        content: z.string().min(1).describe('Full content to store.'),
        tags: z.array(z.string()).optional().describe('Search tags for the memory entry.'),
        summary: z.string().optional().describe('Optional one-line label for the lite pointer.'),
        layer: z.enum(['lite', 'deep']).optional().describe('Defaults to deep.'),
      }),
    },
    async ({ content, tags, summary, layer }) => {
      ensureMemoryReady(scope);
      return asTextResult(await handleWrite({ content, tags, summary, layer, scope }));
    }
  );

  server.registerTool(
    `${prefix}memory_get`,
    {
      title: getTitle,
      description: `Fetch one stored ${scopeLabel} memory by ID. ${scope === 'global' ? 'Global' : 'Deep'} memories also include incoming and outgoing graph link summaries.`,
      inputSchema: z.object({
        id: z.string().min(1).describe('Memory entry ID.'),
      }),
    },
    async ({ id }) => {
      ensureMemoryReady(scope);
      return asTextResult(handleGet({ id, scope }));
    }
  );

  server.registerTool(
    `${prefix}memory_read_lite`,
    {
      title: readLiteTitle,
      description: `Return all lite-layer ${scopeLabel} memory entries.`,
      inputSchema: z.object({}),
    },
    async () => {
      ensureMemoryReady(scope);
      return asTextResult(handleReadLite(scope));
    }
  );

  server.registerTool(
    `${prefix}memory_search`,
    {
      title: searchTitle,
      description: `Search ${scopeLabel} deep memory by topic using semantic and keyword ranking. Results include graph link summaries for matched ${deepLabel} entries.`,
      inputSchema: z.object({
        query: z.string().min(1).describe('Search query.'),
        limit: z.number().int().min(1).max(50).optional().describe('Maximum number of results.'),
      }),
    },
    async ({ query, limit }) => {
      ensureMemoryReady(scope);
      return asTextResult(await handleSearch({ query, limit, scope }));
    }
  );

  server.registerTool(
    `${prefix}memory_delete`,
    {
      title: deleteTitle,
      description: `Delete one ${scopeLabel} memory entry by ID. Deep entries also remove their generated lite pointers.`,
      inputSchema: z.object({
        id: z.string().min(1).describe('Memory entry ID to delete.'),
      }),
    },
    async ({ id }) => {
      ensureMemoryReady(scope);
      return asTextResult(handleDelete({ id, scope }));
    }
  );

  server.registerTool(
    `${prefix}memory_link`,
    {
      title: linkTitle,
      description: `Create a weighted graph edge between two ${scopeLabel} deep memories. Symmetric relations are mirrored automatically.`,
      inputSchema: z.object({
        from_id: z.string().min(1).describe(`Source ${scopeLabel} deep memory ID.`),
        to_id: z.string().min(1).describe(`Target ${scopeLabel} deep memory ID.`),
        relation: relationEnum.describe('Graph relation type.'),
        weight: z.number().min(0).max(1).describe('Edge strength from 0 to 1.'),
        reason: z.string().optional().describe('Optional note explaining why the link exists.'),
      }),
    },
    async ({ from_id, to_id, relation, weight, reason }) => {
      ensureMemoryReady(scope);
      return asTextResult(handleLink({ from_id, to_id, relation, weight, reason, scope }));
    }
  );

  server.registerTool(
    `${prefix}memory_unlink`,
    {
      title: unlinkTitle,
      description: `Remove a graph edge between two ${scopeLabel} deep memories. Symmetric relations remove the mirrored edge too.`,
      inputSchema: z.object({
        from_id: z.string().min(1).describe(`Source ${scopeLabel} deep memory ID.`),
        to_id: z.string().min(1).describe(`Target ${scopeLabel} deep memory ID.`),
        relation: relationEnum.describe('Graph relation type to remove.'),
      }),
    },
    async ({ from_id, to_id, relation }) => {
      ensureMemoryReady(scope);
      return asTextResult(handleUnlink({ from_id, to_id, relation, scope }));
    }
  );

  server.registerTool(
    `${prefix}memory_neighbors`,
    {
      title: neighborsTitle,
      description: `Inspect linked neighbors for one ${scopeLabel} deep memory without loading the neighbor content.`,
      inputSchema: z.object({
        id: z.string().min(1).describe(`${scopeLabel} deep memory ID to inspect.`),
        direction: directionEnum.optional().describe('Which edge direction to inspect. Defaults to both.'),
        relations: z.array(relationEnum).optional().describe('Optional relation filter.'),
        min_weight: z.number().min(0).max(1).optional().describe('Minimum edge weight to include.'),
        limit: z.number().int().min(1).max(100).optional().describe('Maximum neighbors to return.'),
      }),
    },
    async ({ id, direction, relations, min_weight, limit }) => {
      ensureMemoryReady(scope);
      return asTextResult(handleNeighbors({ id, direction, relations, min_weight, limit, scope }));
    }
  );

  server.registerTool(
    `${prefix}memory_subgraph`,
    {
      title: subgraphTitle,
      description: `Traverse the weighted ${scopeLabel} memory graph from one deep memory and return a bounded subgraph of node references and edges.`,
      inputSchema: z.object({
        id: z.string().min(1).describe(`Root ${scopeLabel} deep memory ID.`),
        depth: z.number().int().min(1).max(4).optional().describe('Traversal depth. Defaults to 1.'),
        direction: directionEnum.optional().describe('Which edge direction to traverse. Defaults to both.'),
        relations: z.array(relationEnum).optional().describe('Optional relation filter.'),
        min_weight: z.number().min(0).max(1).optional().describe('Minimum edge weight to include.'),
        max_nodes: z.number().int().min(1).max(200).optional().describe('Maximum nodes to include in the subgraph.'),
      }),
    },
    async ({ id, depth, direction, relations, min_weight, max_nodes }) => {
      ensureMemoryReady(scope);
      return asTextResult(handleSubgraph({ id, depth, direction, relations, min_weight, max_nodes, scope }));
    }
  );

  server.registerTool(
    `${prefix}memory_read_all`,
    {
      title: readAllTitle,
      description: `Return every stored ${scopeLabel} memory entry. Deep entries include graph link summaries. Use only for cleanup and auditing.`,
      inputSchema: z.object({}),
    },
    async () => {
      ensureMemoryReady(scope);
      return asTextResult(handleReadAll(scope));
    }
  );
}

async function main(): Promise<void> {
  persistOpenAIKeyFromEnvironment();

  const server = new McpServer(
    {
      name: 'agent-memory',
      version: VERSION,
    },
    {
      instructions:
        'Use memory_setup to initialize project memory in the current repo, global_memory_read_lite at conversation start for persistent user preferences, memory_write or global_memory_write to store reusable knowledge, memory_get or global_memory_get for pointer IDs, memory_search or global_memory_search for topic lookup, graph tools for deep-memory relationships, and *_read_all only for cleanup.',
    }
  );

  server.registerTool(
    'agent_memory_configure',
    {
      title: 'Configure Agent Memory',
      description:
        'Persist the OpenAI API key for agent-memory under ~/.agents/agent-memory/config.json so embeddings and AI-generated memory names work across Codex restarts without re-exporting OPENAI_API_KEY every time.',
      inputSchema: z.object({
        openai_api_key: z.string().min(1).describe('OpenAI API key to store for agent-memory.'),
      }),
    },
    async ({ openai_api_key }) => {
      const configPath = setStoredOpenAIApiKey(openai_api_key);
      resetOpenAIClient();
      const resolved = getResolvedOpenAIApiKey();
      return asTextResult({
        configured: true,
        config_path: configPath,
        source: resolved.source,
        semantic_search_enabled: Boolean(resolved.apiKey),
      });
    }
  );

  server.registerTool(
    'memory_setup',
    {
      title: 'Setup Project Memory',
      description:
        'Initialize project-local memory storage for the current repo. Creates .memory/memories, .memory/embeddings, and .memory/graph, ensures the SQLite cache exists, and updates .gitignore to ignore only .memory/memory.db*.',
      inputSchema: z.object({}),
    },
    async () => asTextResult(setupProjectMemory())
  );

  registerCommonMemoryTools(server, 'project', '');
  registerCommonMemoryTools(server, 'global', 'global_');

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error in agent-memory MCP server:', error);
  process.exit(1);
});
