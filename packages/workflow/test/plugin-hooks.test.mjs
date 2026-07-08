import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const hookScript = path.join(repoRoot, 'plugins/workflow/hooks/workflow-hook.cjs');
const hookConfig = path.join(repoRoot, 'plugins/workflow/hooks/codex-hooks.json');
const skillDir = path.join(repoRoot, 'plugins/workflow/skills');

function agentNames(dir, extension) {
  return readdirSync(path.join(repoRoot, dir))
    .filter((file) => file.endsWith(extension))
    .map((file) => path.basename(file, extension))
    .sort();
}

function readAgentFile(dir, name, extension) {
  return readFileSync(path.join(repoRoot, dir, `${name}${extension}`), 'utf8');
}

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

  assert.equal(output.continue, true);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(output.hookSpecificOutput.additionalContext, /Active workflow plan: \.workflow\/plans\/01-01-26-hooks/);
  assert.match(output.hookSpecificOutput.additionalContext, /using-workflow/);
  assert.match(output.hookSpecificOutput.additionalContext, /Intent Gate is the default first module/);
  assert.match(output.hookSpecificOutput.additionalContext, /Use Workflow MCP/);
  assert.match(output.hookSpecificOutput.additionalContext, /Agent Memory MCP installed/);
  assert.match(output.hookSpecificOutput.additionalContext, /Do not rely on Codex built-in memory/);
  assert.match(output.hookSpecificOutput.additionalContext, /Merge Request Review installed/);
});

test('workflow session hook omits companion context when companion plugins are absent', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'workflow-no-companion-workspace-'));
  const isolatedPluginRoot = path.join(mkdtempSync(path.join(os.tmpdir(), 'workflow-no-companion-plugin-')), 'workflow');
  mkdirSync(path.join(isolatedPluginRoot, '.codex-plugin'), { recursive: true });
  writeFileSync(path.join(isolatedPluginRoot, '.codex-plugin/plugin.json'), JSON.stringify({ name: 'workflow' }), 'utf8');

  const output = runHookWithEnv({ hook_event_name: 'SessionStart', cwd: workspace }, { PLUGIN_ROOT: isolatedPluginRoot }, workspace);

  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /Agent Memory MCP installed/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /Merge Request Review installed/);
});

test('workflow session hook detects Claude plugin roots and companion manifests', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'workflow-claude-workspace-'));
  const pluginParent = mkdtempSync(path.join(os.tmpdir(), 'workflow-claude-plugins-'));
  const workflowRoot = path.join(pluginParent, 'workflow');
  const memoryRoot = path.join(pluginParent, 'agent-memory');
  const reviewRoot = path.join(pluginParent, 'merge-request-review');

  for (const root of [workflowRoot, memoryRoot, reviewRoot]) {
    mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
    writeFileSync(path.join(root, '.claude-plugin/plugin.json'), JSON.stringify({ name: path.basename(root) }), 'utf8');
  }

  const output = runHookWithEnv(
    { hook_event_name: 'SessionStart', cwd: workspace },
    { PLUGIN_ROOT: '', CLAUDE_PLUGIN_ROOT: workflowRoot },
    workspace
  );

  assert.equal(output.continue, true);
  assert.match(output.hookSpecificOutput.additionalContext, /Agent Memory MCP installed/);
  assert.match(output.hookSpecificOutput.additionalContext, /Merge Request Review installed/);
});

test('Codex and Claude workflow hook configs stay platform-specific', () => {
  const codexConfig = JSON.parse(readFileSync(hookConfig, 'utf8'));
  const claudeConfig = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/workflow/hooks/hooks.json'), 'utf8'));

  assert.match(codexConfig.hooks.SessionStart[0].hooks[0].command, /PLUGIN_ROOT/);
  assert.equal(codexConfig.hooks.PostCompact[0].matcher, 'manual|auto');
  assert.equal(codexConfig.hooks.SubagentStart[0].matcher, '^(workflow_|merge_request_)');
  assert.match(claudeConfig.hooks.SessionStart[0].hooks[0].command, /CLAUDE_PLUGIN_ROOT/);
  assert.equal(claudeConfig.hooks.PostToolUse[0].matcher, 'Bash');
  assert.equal(claudeConfig.hooks.SubagentStart, undefined);
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

test('workflow subagent start reminds implementers to stay bounded', () => {
  const output = runHook({
    hook_event_name: 'SubagentStart',
    agent_type: 'workflow_implementer',
  });

  assert.equal(output.continue, true);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SubagentStart');
  assert.match(output.hookSpecificOutput.additionalContext, /bounded code patches only/);
  assert.match(output.hookSpecificOutput.additionalContext, /no open-ended analysis/);
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

  assert.equal(startOutput.continue, true);
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

  assert.equal(workflowPlugin.hooks, './hooks/codex-hooks.json');
  assert.equal(agentMemoryPlugin.hooks, undefined);
  assert.equal(mrReviewPlugin.hooks, undefined);
});

test('repository ships both Codex and Claude plugin manifests', () => {
  const codexMarketplace = JSON.parse(readFileSync(path.join(repoRoot, '.agents/plugins/marketplace.json'), 'utf8'));
  const claudeMarketplace = JSON.parse(readFileSync(path.join(repoRoot, '.claude-plugin/marketplace.json'), 'utf8'));
  const codexWorkflow = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/workflow/.codex-plugin/plugin.json'), 'utf8'));
  const claudeWorkflow = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/workflow/.claude-plugin/plugin.json'), 'utf8'));
  const codexMemory = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/agent-memory/.codex-plugin/plugin.json'), 'utf8'));
  const claudeMemory = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/agent-memory/.claude-plugin/plugin.json'), 'utf8'));
  const codexReview = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/merge-request-review/.codex-plugin/plugin.json'), 'utf8'));
  const claudeReview = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/merge-request-review/.claude-plugin/plugin.json'), 'utf8'));
  const claudeHookConfig = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/workflow/hooks/hooks.json'), 'utf8'));

  assert.deepEqual(codexMarketplace.plugins.map((plugin) => plugin.name), ['agent-memory', 'workflow', 'merge-request-review']);
  assert.deepEqual(claudeMarketplace.plugins.map((plugin) => plugin.name), ['agent-memory', 'workflow', 'merge-request-review']);
  assert.equal(codexWorkflow.hooks, './hooks/codex-hooks.json');
  assert.equal(claudeWorkflow.name, 'workflow');
  assert.equal(codexMemory.version, claudeMemory.version);
  assert.equal(codexWorkflow.version, claudeWorkflow.version);
  assert.equal(codexReview.version, claudeReview.version);
  for (const plugin of [codexMemory, claudeMemory, codexWorkflow, claudeWorkflow, codexReview, claudeReview]) {
    assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  }
  for (const entry of [...codexMarketplace.plugins, ...claudeMarketplace.plugins]) {
    assert.equal(entry.version, undefined);
  }
  assert.equal(claudeHookConfig.hooks.PostToolUse[0].matcher, 'Bash');
});

test('workflow docs describe source MCP tool and artifact contracts', () => {
  const packageReadme = readFileSync(path.join(repoRoot, 'packages/workflow/README.md'), 'utf8');
  const pluginReadme = readFileSync(path.join(repoRoot, 'plugins/workflow/README.md'), 'utf8');
  const workflowMcp = readFileSync(path.join(skillDir, 'workflow-mcp/SKILL.md'), 'utf8');
  const expectedTools = [
    'workflow_status',
    'workflow_plan_create',
    'workflow_plan_update',
    'workflow_plan_complete',
    'workflow_plan_artifact_write',
    'workflow_audit_create',
    'workflow_audit_update',
    'workflow_audit_complete',
    'workflow_audit_artifact_write',
    'workflow_handoff_write',
    'workflow_findings_normalize',
  ];

  for (const doc of [packageReadme, pluginReadme, workflowMcp]) {
    for (const tool of expectedTools) {
      assert.match(doc, new RegExp(tool));
    }
  }

  assert.match(packageReadme, /ui-contract\.md.*handoffs\//s);
  assert.match(workflowMcp, /ui-contract\.md/);
  assert.match(workflowMcp, /shared operation handler/);
  assert.match(workflowMcp, /installed package drift/);
});

test('workflow and merge request agents stay paired across Codex and Claude', () => {
  assert.deepEqual(agentNames('packages/workflow/agents', '.toml'), agentNames('plugins/workflow/agents', '.md'));
  assert.deepEqual(agentNames('packages/merge-request-review/agents', '.toml'), agentNames('plugins/merge-request-review/agents', '.md'));
});

test('shared workflow agent output contracts keep routing fields', () => {
  const codexFixTriage = readAgentFile('packages/workflow/agents', 'workflow_fix_triage', '.toml');
  const claudeFixTriage = readAgentFile('plugins/workflow/agents', 'workflow_fix_triage', '.md');

  assert.match(codexFixTriage, /model_class: spark_tiny \| spark_mechanical \| gpt54_implementation \| gpt54_analysis \| gpt54_risk_review/);
  assert.match(claudeFixTriage, /model_class: spark_tiny \| spark_mechanical \| gpt54_implementation \| gpt54_analysis \| gpt54_risk_review/);
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
  assert.match(executingPlans, /workflow_plan_complete/);
  assert.match(finalizingPlan, /Manual findings\/state\/artifact writes are fallback only/);
  assert.match(finalizingPlan, /workflow_plan_complete/);
});

test('workflow prompts route subagents by task shape and cap review loops', () => {
  const writingPlans = readFileSync(path.join(skillDir, 'writing-plans/SKILL.md'), 'utf8');
  const executingPlans = readFileSync(path.join(skillDir, 'executing-plans/SKILL.md'), 'utf8');
  const finalizingPlan = readFileSync(path.join(skillDir, 'finalizing-plan/SKILL.md'), 'utf8');
  const implementer = readFileSync(path.join(repoRoot, 'packages/workflow/agents/workflow_implementer.toml'), 'utf8');
  const fixTriage = readFileSync(path.join(repoRoot, 'packages/workflow/agents/workflow_fix_triage.toml'), 'utf8');

  assert.match(writingPlans, /separate analysis\/decision tasks from small implementation tasks/);
  assert.match(writingPlans, /model_class.*delegation_reason/s);
  assert.match(executingPlans, /gpt-5\.4 high.*gpt-5\.4 xhigh/);
  assert.match(executingPlans, /gpt-5\.3-codex-spark low/);
  assert.match(executingPlans, /Spark has a smaller context budget/);
  assert.match(executingPlans, /Spark prompt template/);
  assert.match(executingPlans, /Parallelism cap/);
  assert.match(executingPlans, /Do not give Spark open-ended discovery/);
  assert.match(finalizingPlan, /Do not chase perfection indefinitely/);
  assert.match(finalizingPlan, /Review budget/);
  assert.match(finalizingPlan, /after two unsuccessful fix-review cycles escalate/);
  assert.match(implementer, /bounded patch worker, not an architecture analyst/);
  assert.match(implementer, /report `NEEDS_CONTEXT`/);
  assert.match(fixTriage, /Stop low-value loops/);
  assert.match(fixTriage, /must_fix.*should_fix.*accept_low.*out_of_scope/s);
  assert.match(fixTriage, /spark_tiny \| spark_mechanical \| gpt54_implementation \| gpt54_analysis \| gpt54_risk_review/);
});

test('workflow skills preserve memory, audit, and MCP guardrails', () => {
  const usingWorkflow = readFileSync(path.join(skillDir, 'using-workflow/SKILL.md'), 'utf8');
  const finalizingPlan = readFileSync(path.join(skillDir, 'finalizing-plan/SKILL.md'), 'utf8');
  const auditFlow = readFileSync(path.join(skillDir, 'audit-flow/SKILL.md'), 'utf8');
  const workflowMcp = readFileSync(path.join(skillDir, 'workflow-mcp/SKILL.md'), 'utf8');

  assert.match(usingWorkflow, /make an Agent Memory MCP decision/);
  assert.match(usingWorkflow, /standing authorization/);
  assert.match(finalizingPlan, /When Agent Memory MCP is available/);
  assert.match(finalizingPlan, /Do not substitute Codex built-in memory/);
  assert.match(auditFlow, /Reviewer budget/);
  assert.match(auditFlow, /3-6 reviewers is the normal range/);
  assert.match(workflowMcp, /Create vs update guard/);
  assert.match(workflowMcp, /Do not reopen or update an old completed run/);
  assert.match(workflowMcp, /workflow_plan_complete/);
  assert.match(workflowMcp, /active_chunk/);
  assert.match(workflowMcp, /complete_chunk/);
  assert.match(workflowMcp, /Any status other than `active` or `in_progress` clears `active_chunk`/);
  assert.match(workflowMcp, /set_chunk_status` with `blocked`/);
  assert.match(usingWorkflow, /workflow_plan_complete/);
});
