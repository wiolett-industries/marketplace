import assert from 'node:assert/strict';
import test from 'node:test';
import { registerWorkflowTools } from '../dist/tools.js';

test('registers the expected Workflow MCP tools', () => {
  const tools = new Map();
  const server = {
    registerTool(name, config) {
      tools.set(name, config);
    },
  };

  registerWorkflowTools(server);

  assert.deepEqual([...tools.keys()], [
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
  assert.deepEqual(tools.get('workflow_status').annotations, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  });
  assert.deepEqual(tools.get('workflow_findings_normalize').annotations, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  });
  assert.deepEqual(tools.get('workflow_plan_create').annotations, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  });
  assert.deepEqual(tools.get('workflow_plan_artifact_write').annotations, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  });
});
