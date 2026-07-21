import assert from 'node:assert/strict';
import test from 'node:test';
import { registerWorkflowTools } from '../dist/tools.js';

test('registers the expected Workflow MCP tools', () => {
  const tools = [];
  const server = {
    registerTool(name) {
      tools.push(name);
    },
  };

  registerWorkflowTools(server);

  assert.deepEqual(tools, [
    'workflow_status',
    'workflow_plan_create',
    'workflow_plan_update',
    'workflow_plan_commitment_propose',
    'workflow_plan_commitment_confirm',
    'workflow_plan_complete',
    'workflow_plan_artifact_write',
    'workflow_audit_create',
    'workflow_audit_update',
    'workflow_audit_complete',
    'workflow_audit_artifact_write',
    'workflow_handoff_write',
    'workflow_findings_normalize',
  ]);
});
