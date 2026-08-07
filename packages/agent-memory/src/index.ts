#!/usr/bin/env node

import { runInitCommand } from './cli/init.js';
import { isCliAbortError } from './cli/prompts.js';

const VERSION = '1.1.2';

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (process.env.AGENT_MEMORY_INTERACTIVE_VIEW === '1') {
    const { runViewCommand } = await import('./view/cli.js');
    await runViewCommand([], VERSION, { quiet: true });
    return;
  }
  if (command === 'init') {
    await runInitCommand(args);
    return;
  }

  if (command === 'config') {
    const { runConfigCommand } = await import('./cli/config-command.js');
    await runConfigCommand(args);
    return;
  }

  if (command === 'consolidate') {
    const [{ runConsolidateCommand }, { createConfigCliUi }] = await Promise.all([
      import('./cli/consolidate-command.js'),
      import('./cli/config-ui.js'),
    ]);
    const ui = createConfigCliUi();
    ui.intro('Agent Memory · Consolidate');
    await runConsolidateCommand({ ui });
    ui.outro('Consolidation command complete.');
    return;
  }

  if (command === 'usage') {
    const [{ runUsageCommand }, { createConfigCliUi }] = await Promise.all([
      import('./cli/usage-command.js'),
      import('./cli/config-ui.js'),
    ]);
    const ui = createConfigCliUi();
    ui.intro('Agent Memory · Usage');
    runUsageCommand({ ui });
    ui.outro('Usage summary complete.');
    return;
  }

  if (command === 'doctor') {
    const [{ runDoctorCommand }, { createConfigCliUi }] = await Promise.all([
      import('./cli/doctor-command.js'),
      import('./cli/config-ui.js'),
    ]);
    const ui = createConfigCliUi();
    ui.intro('Agent Memory · Doctor');
    await runDoctorCommand({ ui });
    ui.outro('Doctor complete.');
    return;
  }

  if (command === 'mcp') {
    await startMcpServer();
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

  if (process.stdin.isTTY && process.stdout.isTTY) {
    const { runInteractiveRootCommand } = await import('./cli/root-command.js');
    await runInteractiveRootCommand();
  } else {
    await startMcpServer();
  }
}

async function startMcpServer(): Promise<void> {
  const { ensureConfigAndStorageMigrated } = await import('./migration.js');
  await ensureConfigAndStorageMigrated({
    trigger: 'mcp-startup',
    log: (message) => process.stderr.write(`${message}\n`),
  });
  await registerCurrentProjectMemoryIfPresent();

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
        'Agent Memory is this MCP-backed memory system, separate from Codex built-in memory, chat history, and workflow artifacts. For non-trivial work, proactively use memory_query for a focused question or memory_recap for broad recovery whenever prior repository or user context could affect the result; do not wait for an explicit memory request. After a repo boundary is known, pass an absolute workspace_root for project-scoped reads/writes when the MCP server cwd may differ from the repo. Before the final response for completed non-trivial work, inspect the outcome for a reusable preference, workflow, convention, setup gotcha, root cause, fix pattern, or verification sequence and call memory_save or memory_update when one exists. Never save raw progress, transcripts, secrets, or speculative chatter. Read-only/no-edits requests block memory writes unless remembering was explicitly requested. Read tools never initialize missing project memory; project memory storage is created only by memory_setup or write/mutation tools.',
    }
  );

  registerMemoryTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function registerCurrentProjectMemoryIfPresent(): Promise<void> {
  const [{ registerExistingProjectMemoryBestEffort }, { getMemoryRoot, getProjectRoot }] = await Promise.all([
    import('./project-registry.js'),
    import('./scope.js'),
  ]);
  const projectRoot = getProjectRoot();
  // Discovery is auxiliary local metadata. It must not prevent the MCP server
  // from serving an otherwise healthy memory store.
  try {
    await registerExistingProjectMemoryBestEffort(projectRoot, getMemoryRoot('project', projectRoot));
  } catch {
    // Retry on a later MCP startup or successful write.
  }
}

function printHelp(): void {
  console.log([
    'Usage:',
    '  agent-memory                    Start interactive setup if needed, otherwise open the menu; start MCP stdio when piped',
    '  agent-memory init [opts]        Bootstrap providers, routing, and storage',
    '  agent-memory config [opts]      Shortcut to interactive configuration',
    '  agent-memory consolidate        Shortcut to interactive memory consolidation',
    '  agent-memory usage              Show recent model token and provider-reported cost usage',
    '  agent-memory doctor             Check GitHub releases, local plugins, and Codex MCP targets',
    '  agent-memory mcp                Start MCP stdio server explicitly',
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
