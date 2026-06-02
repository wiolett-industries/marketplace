import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

test('overwrites locally modified merge request review agents', () => {
  const sourceDir = makeSourceDir();
  writeAgent(sourceDir, 'merge_request_alpha', 'Alpha reviewer');
  const env = {
    MERGE_REQUEST_REVIEW_AGENTS_DIR: sourceDir,
    MERGE_REQUEST_REVIEW_CODEX_HOME: mkdtempSync(path.join(os.tmpdir(), 'mr-review-codex-')),
    MERGE_REQUEST_REVIEW_SHARED_AGENTS_HOME: mkdtempSync(path.join(os.tmpdir(), 'mr-review-shared-')),
  };

  syncMergeRequestReviewAgents({ packageVersion: 'test', env });
  writeFileSync(
    path.join(env.MERGE_REQUEST_REVIEW_CODEX_HOME, 'agents', 'merge_request_alpha.toml'),
    agentContent('merge_request_alpha', 'Locally edited'),
    'utf8'
  );
  writeAgent(sourceDir, 'merge_request_alpha', 'Alpha reviewer v2');

  const result = syncMergeRequestReviewAgents({ packageVersion: 'test', env });

  assert.deepEqual(result.synced, ['merge_request_alpha.toml']);
  assert.match(readFileSync(path.join(env.MERGE_REQUEST_REVIEW_CODEX_HOME, 'agents', 'merge_request_alpha.toml'), 'utf8'), /Alpha reviewer v2/);
  assert.deepEqual(result.compatibility_errors, []);
});

function makeSourceDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mr-review-agent-source-'));
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeAgent(dir, name, description) {
  writeFileSync(path.join(dir, `${name}.toml`), agentContent(name, description), 'utf8');
}

function agentContent(name, description) {
  return [
    `name = "${name}"`,
    `description = "${description}"`,
    'developer_instructions = """',
    `# ${name}`,
    '',
    'Review the assigned merge request context.',
    '"""',
    '',
  ].join('\n');
}
