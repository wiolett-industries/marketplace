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
const skillDir = path.join(repoRoot, 'plugins/workflow/skills');

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

function runHookWithEnv(input, env, cwd = repoRoot) {
  const result = spawnSync(process.execPath, [hookScript], {
    cwd,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
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
  assert.match(output.hookSpecificOutput.additionalContext, /Intent Gate is the default first module/);
  assert.match(output.hookSpecificOutput.additionalContext, /Use Workflow MCP/);
  assert.match(output.hookSpecificOutput.additionalContext, /Agent Memory installed/);
  assert.match(output.hookSpecificOutput.additionalContext, /Merge Request Review installed/);
});

test('workflow session hook omits companion context when companion plugins are absent', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'workflow-no-companion-workspace-'));
  const isolatedPluginRoot = path.join(mkdtempSync(path.join(os.tmpdir(), 'workflow-no-companion-plugin-')), 'workflow');
  mkdirSync(path.join(isolatedPluginRoot, '.codex-plugin'), { recursive: true });
  writeFileSync(path.join(isolatedPluginRoot, '.codex-plugin/plugin.json'), JSON.stringify({ name: 'workflow' }), 'utf8');

  const output = runHookWithEnv({ hook_event_name: 'SessionStart', cwd: workspace }, { PLUGIN_ROOT: isolatedPluginRoot }, workspace);

  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /Agent Memory installed/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /Merge Request Review installed/);
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
  assert.equal(config.hooks.SubagentStart[0].matcher, '^(workflow_|merge_request_)');
  assert.equal(config.hooks.SubagentStop[0].matcher, '^(workflow_|merge_request_)');
});

test('workflow post-compact hook returns common output fields only', () => {
  const output = runHook({ hook_event_name: 'PostCompact', cwd: repoRoot });

  assert.equal(output.continue, true);
  assert.equal(output.systemMessage, undefined);
  assert.equal(output.hookSpecificOutput, undefined);
});

test('workflow hook applies merge request reviewer context and validation when plugin is installed', () => {
  const startOutput = runHook({
    hook_event_name: 'SubagentStart',
    agent_type: 'merge_request_primary_reviewer',
  });

  assert.equal(startOutput.hookSpecificOutput.hookEventName, 'SubagentStart');
  assert.match(startOutput.hookSpecificOutput.additionalContext, /MR review agent merge_request_primary_reviewer/);
  assert.match(startOutput.hookSpecificOutput.additionalContext, /Verdict: REVIEW_BLOCKED/);

  const stopOutput = runHook({
    hook_event_name: 'SubagentStop',
    agent_type: 'merge_request_primary_reviewer',
    last_assistant_message: 'No issues.',
  });

  assert.equal(stopOutput.decision, 'block');
  assert.match(stopOutput.reason, /Scope Check/);
});

test('workflow hook does not apply merge request validation when plugin is absent', () => {
  const isolatedPluginRoot = path.join(mkdtempSync(path.join(os.tmpdir(), 'workflow-no-mr-plugin-')), 'workflow');
  mkdirSync(path.join(isolatedPluginRoot, '.codex-plugin'), { recursive: true });
  writeFileSync(path.join(isolatedPluginRoot, '.codex-plugin/plugin.json'), JSON.stringify({ name: 'workflow' }), 'utf8');

  const output = runHookWithEnv({
    hook_event_name: 'SubagentStop',
    agent_type: 'merge_request_primary_reviewer',
    last_assistant_message: 'No structured MR output.',
  }, { PLUGIN_ROOT: isolatedPluginRoot });

  assert.equal(output.continue, true);
});

test('only workflow plugin manifest registers hooks', () => {
  const workflowPlugin = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/workflow/.codex-plugin/plugin.json'), 'utf8'));
  const agentMemoryPlugin = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/agent-memory/.codex-plugin/plugin.json'), 'utf8'));
  const mrReviewPlugin = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/merge-request-review/.codex-plugin/plugin.json'), 'utf8'));

  assert.equal(workflowPlugin.hooks, './hooks/hooks.json');
  assert.equal(agentMemoryPlugin.hooks, undefined);
  assert.equal(mrReviewPlugin.hooks, undefined);
});

test('workflow skills make intent gate and MCP usage mandatory by default', () => {
  const usingWorkflow = readFileSync(path.join(skillDir, 'using-workflow/SKILL.md'), 'utf8');
  const intentGate = readFileSync(path.join(skillDir, 'intent-gate/SKILL.md'), 'utf8');
  const workflowMcp = readFileSync(path.join(skillDir, 'workflow-mcp/SKILL.md'), 'utf8');
  const writingPlans = readFileSync(path.join(skillDir, 'writing-plans/SKILL.md'), 'utf8');
  const executingPlans = readFileSync(path.join(skillDir, 'executing-plans/SKILL.md'), 'utf8');
  const finalizingPlan = readFileSync(path.join(skillDir, 'finalizing-plan/SKILL.md'), 'utf8');

  assert.match(usingWorkflow, /For any non-trivial .* run `Intent Gate` first/);
  assert.match(usingWorkflow, /Manual `\.workflow\/` writes are fallback only/);
  assert.match(intentGate, /default entry gate, not optional ceremony/);
  assert.match(workflowMcp, /normal path, not a preference/);
  assert.match(writingPlans, /Manual `\.workflow\/` writes are fallback only/);
  assert.match(executingPlans, /manual state\/artifact writes are fallback only/);
  assert.match(finalizingPlan, /Manual findings\/state\/artifact writes are fallback only/);
});
