import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const hookScript = path.join(repoRoot, 'plugins/workflow/hooks/workflow-hook.cjs');

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

test('workflow session hook emits recovery context for active plans', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'workflow-hook-'));
  const planDir = path.join(workspace, '.workflow/plans/01-01-26-hooks');
  mkdirSync(planDir, { recursive: true });
  writeFileSync(path.join(workspace, '.workflow/state.json'), JSON.stringify({ active_plan: 'plans/01-01-26-hooks' }), 'utf8');

  const output = runHook({ hook_event_name: 'SessionStart', cwd: workspace }, workspace);

  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(output.hookSpecificOutput.additionalContext, /Active workflow plan: \.workflow\/plans\/01-01-26-hooks/);
  assert.match(output.hookSpecificOutput.additionalContext, /using-workflow/);
});

test('workflow subagent stop blocks malformed reviewer output', () => {
  const output = runHook({
    hook_event_name: 'SubagentStop',
    agent_type: 'workflow_combined_reviewer',
    last_assistant_message: 'Looks fine to me.',
  });

  assert.equal(output.decision, 'block');
  assert.match(output.reason, /Verdict/);
});

test('workflow subagent stop accepts valid implementer output', () => {
  const output = runHook({
    hook_event_name: 'SubagentStop',
    agent_type: 'workflow_implementer',
    last_assistant_message: [
      'Status: DONE',
      'Changed files:',
      '- src/example.ts',
      'Verification:',
      '- pnpm test',
      'Concerns:',
      '- none',
    ].join('\n'),
  });

  assert.equal(output.continue, true);
});

test('workflow stop hook only blocks dirty worktree for commit or push claims', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'workflow-hook-'));
  execFileSync('git', ['init'], { cwd: workspace, stdio: 'ignore' });
  writeFileSync(path.join(workspace, 'changed.txt'), 'dirty\n', 'utf8');

  const ordinaryDone = runHook({
    hook_event_name: 'Stop',
    cwd: workspace,
    last_assistant_message: 'Готово, изменения внесены.',
  }, workspace);
  assert.equal(ordinaryDone.continue, true);

  const commitClaim = runHook({
    hook_event_name: 'Stop',
    cwd: workspace,
    last_assistant_message: 'Committed and pushed.',
  }, workspace);
  assert.equal(commitClaim.decision, 'block');
  assert.match(commitClaim.reason, /commit\/push/i);
});
