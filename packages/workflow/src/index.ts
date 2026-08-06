#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { formatWorkflowAgentSyncResult, registerWorkflowTools, syncWorkflowAgents } from './register.js';

const VERSION = '1.1.1';

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);

  if (command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command) {
    throw new Error(`Unknown command: ${command}`);
  }

  const syncResult = syncWorkflowAgents({ packageVersion: VERSION });
  console.error(formatWorkflowAgentSyncResult(syncResult));

  const server = new McpServer(
    {
      name: 'workflow',
      version: VERSION,
    },
    {
      instructions:
        'Workflow MCP syncs workflow_* custom agents at startup, then exposes deterministic filesystem tools for workflow plan and audit runs under .workflow/. Use these tools whenever available for workflow status, run creation, state updates, run completion, artifact writes, findings normalization, structured handoffs, and material-plan commitment reflection; manual .workflow writes are fallback only. Before executing a material plan, use workflow_plan_commitment_propose and workflow_plan_commitment_confirm for one same-model shrink-first review from existing context. Before final output for a realized active run, call workflow_plan_complete or workflow_audit_complete; setting phase to complete is rejected because it would not clear the root active pointer. Hook enforcement is optional and platform-specific. It does not generate plans, run subagents, or replace agent judgment.',
    }
  );
  registerWorkflowTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function printHelp(): void {
  console.log([
    'Usage:',
    '  workflow    Start MCP stdio server and sync workflow custom agents',
    '',
    'Environment:',
    '  WORKFLOW_MCP_AGENTS_DIR   Override source directory for workflow_*.toml files',
    '  WORKFLOW_MCP_CODEX_HOME   Override Codex home directory; defaults to CODEX_HOME or ~/.codex',
    '  WORKFLOW_MCP_SHARED_AGENTS_HOME   Override shared agents home; defaults to AGENTS_HOME or ~/.agents',
  ].join('\n'));
}

main().catch((error) => {
  console.error('Fatal error in workflow:', error);
  process.exit(1);
});
