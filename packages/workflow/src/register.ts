import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { syncWorkflowAgents, type SyncWorkflowAgentsResult } from './sync-agents.js';
import { registerWorkflowTools as registerWorkflowMcpTools } from './tools.js';

export { syncWorkflowAgents, type SyncWorkflowAgentsResult };
export {
  confirmPlanCommitment,
  initialCommitmentReflection,
  proposePlanCommitment,
  type ChangeClass,
  type CommitmentConfirmationInput,
  type CommitmentDecision,
  type CommitmentKind,
  type CommitmentProposalInput,
} from './commitments.js';

export function registerWorkflowTools(server: McpServer): void {
  registerWorkflowMcpTools(server);
}

export function formatWorkflowAgentSyncResult(result: SyncWorkflowAgentsResult): string {
  return [
    'workflow: synced workflow custom agents',
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
