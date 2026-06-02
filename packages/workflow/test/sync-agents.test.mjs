import assert from 'node:assert/strict';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { syncWorkflowAgents } from '../dist/sync-agents.js';

test('syncs workflow agents globally and writes lock file', () => {
  const sourceDir = makeSourceDir();
  writeAgent(sourceDir, 'workflow_alpha', 'Alpha reviewer');
  writeAgent(sourceDir, 'workflow_beta', 'Beta reviewer');
  const env = makeEnv(sourceDir);

  const result = syncWorkflowAgents({
    packageVersion: 'test',
    env,
  });

  const agentsDir = path.join(env.WORKFLOW_MCP_CODEX_HOME, 'agents');
  const sharedAgentsDir = path.join(env.WORKFLOW_MCP_SHARED_AGENTS_HOME, 'agents');
  const lock = JSON.parse(readFileSync(path.join(agentsDir, '.workflow-agents.lock.json'), 'utf8'));
  const sharedLock = JSON.parse(readFileSync(path.join(sharedAgentsDir, '.workflow-agents.lock.json'), 'utf8'));

  assert.equal(result.count, 2);
  assert.deepEqual(result.synced, ['workflow_alpha.toml', 'workflow_beta.toml']);
  assert.deepEqual(result.compatibility_errors, []);
  assert.equal(readFileSync(path.join(agentsDir, 'workflow_alpha.toml'), 'utf8'), agentContent('workflow_alpha', 'Alpha reviewer'));
  assert.equal(readFileSync(path.join(sharedAgentsDir, 'workflow_alpha.toml'), 'utf8'), agentContent('workflow_alpha', 'Alpha reviewer'));
  assert.equal(lstatSync(path.join(sharedAgentsDir, 'workflow_alpha.toml')).isSymbolicLink(), true);
  assert.equal(lock.managed_by, '@wiolett/workflow');
  assert.equal(sharedLock.managed_by, '@wiolett/workflow');
  assert.deepEqual(Object.keys(lock.files).sort(), ['workflow_alpha.toml', 'workflow_beta.toml']);
});

test('sync is idempotent when installed files match source', () => {
  const sourceDir = makeSourceDir();
  writeAgent(sourceDir, 'workflow_alpha', 'Alpha reviewer');
  const env = makeEnv(sourceDir);

  syncWorkflowAgents({ packageVersion: 'test', env });
  const second = syncWorkflowAgents({ packageVersion: 'test', env });

  assert.deepEqual(second.synced, []);
  assert.deepEqual(second.unchanged, ['workflow_alpha.toml']);
  assert.deepEqual(second.compatibility_errors, []);
  assert.deepEqual(second.compatibility_unchanged, ['workflow_alpha.toml']);
});

test('updates previously managed workflow agents when source changes', () => {
  const sourceDir = makeSourceDir();
  writeAgent(sourceDir, 'workflow_alpha', 'Alpha reviewer');
  const env = makeEnv(sourceDir);

  syncWorkflowAgents({ packageVersion: 'test', env });
  writeAgent(sourceDir, 'workflow_alpha', 'Alpha reviewer v2');
  const second = syncWorkflowAgents({ packageVersion: 'test', env });

  assert.deepEqual(second.synced, ['workflow_alpha.toml']);
  assert.deepEqual(second.compatibility_errors, []);
  assert.match(readFileSync(path.join(env.WORKFLOW_MCP_CODEX_HOME, 'agents', 'workflow_alpha.toml'), 'utf8'), /Alpha reviewer v2/);
  assert.match(readFileSync(path.join(env.WORKFLOW_MCP_SHARED_AGENTS_HOME, 'agents', 'workflow_alpha.toml'), 'utf8'), /Alpha reviewer v2/);
});

test('removes stale agents from legacy workflow lock files', () => {
  const sourceDir = makeSourceDir();
  writeAgent(sourceDir, 'workflow_alpha', 'Alpha reviewer');
  writeAgent(sourceDir, 'workflow_beta', 'Beta reviewer');
  const env = makeEnv(sourceDir);
  const agentsDir = path.join(env.WORKFLOW_MCP_CODEX_HOME, 'agents');

  syncWorkflowAgents({ packageVersion: 'test', env });
  const lockPath = path.join(agentsDir, '.workflow-agents.lock.json');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  lock.managed_by = '@wiolett/workflow-control';
  writeFileSync(lockPath, JSON.stringify(lock, null, 2), 'utf8');

  const nextSourceDir = makeSourceDir();
  writeAgent(nextSourceDir, 'workflow_alpha', 'Alpha reviewer');
  const next = syncWorkflowAgents({
    packageVersion: 'test',
    env: {
      ...env,
      WORKFLOW_MCP_AGENTS_DIR: nextSourceDir,
    },
  });

  assert.deepEqual(next.removed, ['workflow_beta.toml']);
  assert.equal(readFileSync(lockPath, 'utf8').includes('@wiolett/workflow"'), true);
});

test('overwrites locally modified workflow agents', () => {
  const sourceDir = makeSourceDir();
  writeAgent(sourceDir, 'workflow_alpha', 'Alpha reviewer');
  const env = makeEnv(sourceDir);

  syncWorkflowAgents({ packageVersion: 'test', env });
  writeFileSync(path.join(env.WORKFLOW_MCP_CODEX_HOME, 'agents', 'workflow_alpha.toml'), agentContent('workflow_alpha', 'Locally edited'), 'utf8');
  writeAgent(sourceDir, 'workflow_alpha', 'Alpha reviewer v2');

  const result = syncWorkflowAgents({ packageVersion: 'test', env });

  assert.deepEqual(result.synced, ['workflow_alpha.toml']);
  assert.match(readFileSync(path.join(env.WORKFLOW_MCP_CODEX_HOME, 'agents', 'workflow_alpha.toml'), 'utf8'), /Alpha reviewer v2/);
});

test('repairs compatibility conflicts without failing Codex agent sync', () => {
  const sourceDir = makeSourceDir();
  writeAgent(sourceDir, 'workflow_alpha', 'Alpha reviewer');
  const env = makeEnv(sourceDir);
  const sharedAgentsDir = path.join(env.WORKFLOW_MCP_SHARED_AGENTS_HOME, 'agents');

  mkdirSync(sharedAgentsDir, { recursive: true });
  writeFileSync(path.join(sharedAgentsDir, 'workflow_alpha.toml'), agentContent('workflow_alpha', 'Foreign file'), 'utf8');

  const result = syncWorkflowAgents({ packageVersion: 'test', env });

  assert.deepEqual(result.synced, ['workflow_alpha.toml']);
  assert.deepEqual(result.compatibility_errors, []);
  assert.deepEqual(result.linked, ['workflow_alpha.toml']);
  assert.match(readFileSync(path.join(env.WORKFLOW_MCP_CODEX_HOME, 'agents', 'workflow_alpha.toml'), 'utf8'), /Alpha reviewer/);
  assert.match(readFileSync(path.join(sharedAgentsDir, 'workflow_alpha.toml'), 'utf8'), /Alpha reviewer/);
});

test('validates workflow agent naming and required fields', () => {
  const sourceDir = makeSourceDir();
  writeFileSync(path.join(sourceDir, 'workflow_bad.toml'), 'name = "workflow_other"\n', 'utf8');
  const env = makeEnv(sourceDir);

  assert.throws(
    () => syncWorkflowAgents({
      packageVersion: 'test',
      env,
    }),
    /Missing required string field: description|filename stem must match/
  );
});

function makeSourceDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'workflow-agent-source-'));
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeAgent(dir, name, description) {
  writeFileSync(path.join(dir, `${name}.toml`), agentContent(name, description), 'utf8');
}

function makeEnv(sourceDir) {
  return {
    WORKFLOW_MCP_AGENTS_DIR: sourceDir,
    WORKFLOW_MCP_CODEX_HOME: mkdtempSync(path.join(os.tmpdir(), 'workflow-codex-home-')),
    WORKFLOW_MCP_SHARED_AGENTS_HOME: mkdtempSync(path.join(os.tmpdir(), 'workflow-shared-agents-home-')),
  };
}

function agentContent(name, description) {
  return [
    `name = "${name}"`,
    `description = "${description}"`,
    'developer_instructions = """',
    `# ${name}`,
    '',
    'Do the assigned workflow job.',
    '"""',
    '',
  ].join('\n');
}
