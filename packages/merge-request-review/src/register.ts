import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { syncMergeRequestReviewAgents, type SyncMergeRequestReviewAgentsResult } from './sync-agents.js';
import { registerMergeRequestReviewTools } from './tools.js';

export { syncMergeRequestReviewAgents, type SyncMergeRequestReviewAgentsResult };

export function registerMergeRequestReviewControlTools(server: McpServer): void {
  registerMergeRequestReviewTools(server);
}

export function formatMergeRequestReviewAgentSyncResult(result: SyncMergeRequestReviewAgentsResult): string {
  return [
    'merge-request-review: synced custom agents',
    `source=${result.source_dir}`,
    `target=${result.target_dir}`,
    `compatibility=${result.compatibility_dir}`,
    `count=${result.count}`,
    `updated=${result.synced.length}`,
    `unchanged=${result.unchanged.length}`,
    `removed=${result.removed.length}`,
    `linked=${result.linked.length}`,
    `copied=${result.copied.length}`,
    `compatibility_errors=${result.compatibility_errors.length}`,
  ].join(' ');
}
