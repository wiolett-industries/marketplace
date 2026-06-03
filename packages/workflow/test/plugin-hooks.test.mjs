import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const hookScript = path.join(repoRoot, 'plugins/workflow/hooks/workflow-hook.cjs');
const hookConfig = path.join(repoRoot, 'plugins/workflow/hooks/hooks.json');

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

test('workflow hook config does not register session end hooks', () => {
  const config = JSON.parse(readFileSync(hookConfig, 'utf8'));

  assert.equal(config.hooks.Stop, undefined);
});

test('workflow hook config does not match compact source as SessionStart', () => {
  const config = JSON.parse(readFileSync(hookConfig, 'utf8'));

  assert.equal(config.hooks.SessionStart[0].matcher, 'startup|resume|clear');
});

test('workflow post-compact hook returns common output fields only', () => {
  const output = runHook({ hook_event_name: 'PostCompact', cwd: repoRoot });

  assert.equal(output.continue, true);
  assert.equal(output.systemMessage, undefined);
  assert.equal(output.hookSpecificOutput, undefined);
});
