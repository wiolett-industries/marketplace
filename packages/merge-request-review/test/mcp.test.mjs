import assert from 'node:assert/strict';
import test from 'node:test';
import { registerMergeRequestReviewTools } from '../dist/tools.js';

test('registers the expected Merge Request Review MCP tools', () => {
  const tools = [];
  const server = {
    registerTool(name, definition) {
      tools.push({ name, definition });
    },
  };

  registerMergeRequestReviewTools(server);

  assert.deepEqual(tools.map((tool) => tool.name), [
    'mr_review_status',
    'mr_review_create',
    'mr_review_update',
    'mr_review_complete',
    'mr_review_artifact_write',
    'mr_review_findings_normalize',
    'mr_review_note_draft',
  ]);

  const update = tools.find((tool) => tool.name === 'mr_review_update').definition;
  assert.match(update.description, /mark_approved/);
  assert.match(update.description, /mr_review_complete/);
  assert.equal(update.inputSchema.operations.safeParse([{ type: 'mark_approved' }]).success, true);
  assert.equal(update.inputSchema.operations.safeParse([{ type: 'unknown_operation' }]).success, false);

  const noteDraft = tools.find((tool) => tool.name === 'mr_review_note_draft').definition;
  assert.equal(noteDraft.inputSchema.evidence_basis.safeParse('Canonical contract plus current proof').success, true);
  assert.equal(noteDraft.inputSchema.evidence_basis.safeParse('').success, false);
});
