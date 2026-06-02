import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const hookScript = path.join(repoRoot, 'plugins/merge-request-review/hooks/merge-request-review-hook.cjs');
const hookConfig = path.join(repoRoot, 'plugins/merge-request-review/hooks/hooks.json');

function runHook(input, cwd = repoRoot) {
  const result = spawnSync(process.execPath, [hookScript], {
    cwd,
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

test('merge-request-review subagent start emits reviewer context', () => {
  const output = runHook({
    hook_event_name: 'SubagentStart',
    agent_type: 'merge_request_primary_reviewer',
  });

  assert.equal(output.hookSpecificOutput.hookEventName, 'SubagentStart');
  assert.match(output.hookSpecificOutput.additionalContext, /MR discussions\/diff\/CI/);
  assert.match(output.hookSpecificOutput.additionalContext, /Verdict: REVIEW_BLOCKED/);
});

test('merge-request-review subagent stop blocks malformed primary output', () => {
  const output = runHook({
    hook_event_name: 'SubagentStop',
    agent_type: 'merge_request_primary_reviewer',
    last_assistant_message: 'No issues.',
  });

  assert.equal(output.decision, 'block');
  assert.match(output.reason, /Scope Check/);
});

test('merge-request-review subagent stop accepts valid primary output', () => {
  const output = runHook({
    hook_event_name: 'SubagentStop',
    agent_type: 'merge_request_primary_reviewer',
    last_assistant_message: [
      'Reviewed: current MR',
      'Scope Check: PASS',
      'Critical findings',
      'Important findings',
      'Minor findings',
      'Notes',
      'Verdict: REVIEW_PASS',
      'Review Summary',
    ].join('\n'),
  });

  assert.equal(output.continue, true);
});

test('merge-request-review hook config does not register session end hooks', () => {
  const config = JSON.parse(readFileSync(hookConfig, 'utf8'));

  assert.equal(config.hooks.Stop, undefined);
});
