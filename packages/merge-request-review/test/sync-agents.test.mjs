import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { syncMergeRequestReviewAgents } from '../dist/sync-agents.js';

test('syncs merge request review agents globally', () => {
  const env = {
    MERGE_REQUEST_REVIEW_CODEX_HOME: mkdtempSync(path.join(os.tmpdir(), 'mr-review-codex-')),
    MERGE_REQUEST_REVIEW_SHARED_AGENTS_HOME: mkdtempSync(path.join(os.tmpdir(), 'mr-review-shared-')),
  };
  const result = syncMergeRequestReviewAgents({ packageVersion: 'test', env });
  const lock = JSON.parse(readFileSync(path.join(env.MERGE_REQUEST_REVIEW_CODEX_HOME, 'agents', '.merge-request-review-agents.lock.json'), 'utf8'));

  assert.equal(result.count, 4);
  assert.equal(result.compatibility_errors.length, 0);
  assert.equal(lock.managed_by, '@wiolett/merge-request-review');
  assert.ok(result.synced.includes('merge_request_primary_reviewer.toml'));
});
