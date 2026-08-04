#!/usr/bin/env node

const VERSION = '0.2.8';

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);
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
  const [
    { McpServer },
    { StdioServerTransport },
    { formatMergeRequestReviewAgentSyncResult, registerMergeRequestReviewControlTools, syncMergeRequestReviewAgents },
  ] = await Promise.all([
    import('@modelcontextprotocol/sdk/server/mcp.js'),
    import('@modelcontextprotocol/sdk/server/stdio.js'),
    import('./register.js'),
  ]);

  const syncResult = syncMergeRequestReviewAgents({ packageVersion: VERSION });
  console.error(formatMergeRequestReviewAgentSyncResult(syncResult));

  const server = new McpServer(
    {
      name: 'merge-request-review',
      version: VERSION,
    },
    {
      instructions:
        'Merge Request Review MCP syncs merge_request_* custom agents at startup and exposes deterministic .workflow/mr-reviews artifact/state tools. It does not talk to GitLab directly, post notes, approve MRs, or replace agent judgment. After the clean note is posted and external GitLab approval succeeds, call mr_review_complete before final output; changing phase alone does not close active_review.',
    }
  );

  registerMergeRequestReviewControlTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function printHelp(): void {
  console.log([
    'Usage:',
    '  merge-request-review        Start MCP stdio server',
    '  merge-request-review --help Print help',
  ].join('\n'));
}

main().catch((error) => {
  console.error('Fatal error in merge-request-review:', error);
  process.exit(1);
});
