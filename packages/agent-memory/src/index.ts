#!/usr/bin/env node

import { runInitCommand } from './cli/init.js';

const VERSION = '0.2.0';

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'init') {
    await runInitCommand(args);
    return;
  }

  if (command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command) {
    throw new Error(`Unknown command: ${command}`);
  }

  await startMcpServer();
}

async function startMcpServer(): Promise<void> {
  const [{ McpServer }, { StdioServerTransport }, { registerMemoryTools }] = await Promise.all([
    import('@modelcontextprotocol/sdk/server/mcp.js'),
    import('@modelcontextprotocol/sdk/server/stdio.js'),
    import('./tools/register.js'),
  ]);

  const server = new McpServer(
    {
      name: 'agent-memory',
      version: VERSION,
    },
    {
      instructions:
        'Use memory_list or global_memory_read_lite at conversation start for persistent preferences, memory_save to store reusable knowledge, memory_recall for compiled context by ID, memory_query for topic lookup, memory_graph for relationships, and memory_inspect only for raw maintenance/debug views. Read tools never initialize missing project memory; project memory storage is created only by memory_setup or write/mutation tools.',
    }
  );

  registerMemoryTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function printHelp(): void {
  console.log([
    'Usage:',
    '  agent-memory-mcp              Start MCP stdio server',
    '  agent-memory-mcp init [opts]  Configure OpenAI API key',
    '',
    'Run agent-memory-mcp init --help for init options.',
  ].join('\n'));
}

main().catch((error) => {
  console.error('Fatal error in agent-memory:', error);
  process.exit(1);
});
