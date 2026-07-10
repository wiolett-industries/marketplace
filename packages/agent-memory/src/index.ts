#!/usr/bin/env node

import { runInitCommand } from './cli/init.js';
import { isCliAbortError } from './cli/prompts.js';

const VERSION = '0.4.3';

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'init') {
    await runInitCommand(args);
    return;
  }

  if (command === 'view') {
    // Lazy import: keeps the UI/server (and its deps) out of the MCP server path.
    const { runViewCommand } = await import('./view/cli.js');
    await runViewCommand(args, VERSION);
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
        'Agent Memory is this MCP-backed memory system, separate from Codex built-in memory, chat history, and workflow artifacts. Common tools include memory_list, memory_query, memory_recall, memory_save, memory_update, memory_inspect, memory_graph, memory_path, memory_graph_prune, and memory_setup; maintenance tools include memory_delete, memory_link, and memory_unlink. Use memory_list({ scope: "global", index_only: true }) or global_memory_read_lite at conversation start for persistent preferences. After a repo boundary is known, pass an absolute workspace_root for project-scoped reads/writes when the MCP server cwd may differ from the repo. Do not treat an empty project memory_list as proof that no memories exist until scope/root has been checked with memory_inspect or workspace_root. Do not substitute Codex built-in memory for Agent Memory MCP reads/writes when these tools are available. Before finalizing non-trivial work, save/update distilled preferences, repo workflows, setup gotchas, root causes, fix patterns, or verification sequences when they are likely to matter again. Read tools never initialize missing project memory; project memory storage is created only by memory_setup or write/mutation tools.',
    }
  );

  registerMemoryTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function printHelp(): void {
  console.log([
    'Usage:',
    '  agent-memory                    Start MCP stdio server',
    '  agent-memory init [opts]        Configure OpenAI API key',
    '  agent-memory view [path|global] Open the local memory dashboard',
    '',
    'view options: --port <n>, --no-open. Defaults to ./.memory; pass a',
    'project path or "global" to target another store.',
    '',
    'Run agent-memory init --help for init options.',
  ].join('\n'));
}

main().catch((error) => {
  if (isCliAbortError(error)) {
    console.error('Canceled.');
    process.exit(130);
  }
  console.error('Fatal error in agent-memory:', error);
  process.exit(1);
});
