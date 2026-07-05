import assert from 'node:assert/strict';
import test from 'node:test';
import { registerMergeRequestReviewTools } from '../dist/tools.js';

test('registers the expected Merge Request Review MCP tools', () => {
  const tools = [];
  const server = {
    registerTool(name) {
      tools.push(name);
    },
  };

  registerMergeRequestReviewTools(server);

  assert.deepEqual(tools, [
    'mr_review_status',
    'mr_review_create',
    'mr_review_update',
    'mr_review_artifact_write',
    'mr_review_findings_normalize',
    'mr_review_note_draft',
  ]);
});
