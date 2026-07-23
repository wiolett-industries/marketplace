import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function runKimiHook(input, cwd = repoRoot) {
  return spawnSync(process.execPath, [hookScript], {
    cwd,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: {
      ...process.env,
      KIMI_PLUGIN_ROOT: repoRoot,
    },
  });
}

test('workflow session hook emits recovery context for active plans', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'workflow-hook-'));
  const planDir = path.join(workspace, '.workflow/plans/01-01-26-hooks');
  mkdirSync(planDir, { recursive: true });
  mkdirSync(path.join(workspace, '.workflow/mr-reviews'), { recursive: true });
  writeFileSync(path.join(workspace, '.workflow/state.json'), JSON.stringify({ active_plan: 'plans/01-01-26-hooks' }), 'utf8');
  writeFileSync(path.join(workspace, '.workflow/mr-reviews/state.json'), JSON.stringify({ active_review: 'mr-reviews/01-01-26-mr-hooks' }), 'utf8');

  const output = runHook({ hook_event_name: 'SessionStart', cwd: workspace }, workspace);

  assert.equal(output.continue, true);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(output.hookSpecificOutput.additionalContext, /Active workflow plan: \.workflow\/plans\/01-01-26-hooks/);
  assert.match(output.hookSpecificOutput.additionalContext, /using-workflow/);
  assert.match(output.hookSpecificOutput.additionalContext, /choose one primary path/);
  assert.match(output.hookSpecificOutput.additionalContext, /triggered skill does not imply an artifact, subagent, plan, review loop, or fresh budget/);
  assert.match(output.hookSpecificOutput.additionalContext, /fast \(0 agents\), standard \(at most 1 total\), assurance \(declared total, default 3; at most 2 reviewers per round\)/);
  assert.match(output.hookSpecificOutput.additionalContext, /Authorization is permission, not activation/);
  assert.match(output.hookSpecificOutput.additionalContext, /Parent Max\/Ultra and multiple skills do not expand the budget/);
  assert.match(output.hookSpecificOutput.additionalContext, /workflow-mcp/);
  assert.match(output.hookSpecificOutput.additionalContext, /workflow_plan_complete/);
  assert.match(output.hookSpecificOutput.additionalContext, /Agent Memory MCP installed/);
  assert.match(output.hookSpecificOutput.additionalContext, /memory_recap/);
  assert.match(output.hookSpecificOutput.additionalContext, /memory completion latch/);
  assert.match(output.hookSpecificOutput.additionalContext, /read-only\/no-edits work does not write memory/);
  assert.match(output.hookSpecificOutput.additionalContext, /Merge Request Review installed/);
  assert.match(output.hookSpecificOutput.additionalContext, /Active merge request review: \.workflow\/mr-reviews\/01-01-26-mr-hooks/);
  assert.match(output.hookSpecificOutput.additionalContext, /mr_review_complete/);
});

test('workflow hook follows configured Workflow and MR Review artifact roots', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'workflow-configured-hook-'));
  const agentsHome = mkdtempSync(path.join(os.tmpdir(), 'workflow-configured-home-'));
  const configDir = path.join(agentsHome, '.wiolett', 'config');
  const workflowRoot = path.join(workspace, '.agent-artifacts', 'workflow');
  const reviewRoot = path.join(workspace, '.agent-artifacts', 'reviews');
  mkdirSync(configDir, { recursive: true });
  mkdirSync(path.join(workflowRoot, 'plans', 'configured-plan'), { recursive: true });
  mkdirSync(reviewRoot, { recursive: true });
  writeFileSync(path.join(configDir, 'mcp-config.yml'), `version: 1
mcp:
  workflow:
    artifacts:
      root: .agent-artifacts/workflow
  merge-request-review:
    artifacts:
      root: .agent-artifacts/reviews
`, 'utf8');
  writeFileSync(path.join(workflowRoot, 'state.json'), JSON.stringify({ active_plan: 'plans/configured-plan' }), 'utf8');
  writeFileSync(path.join(reviewRoot, 'state.json'), JSON.stringify({ active_review: 'mr-reviews/configured-review' }), 'utf8');

  const output = runHookWithEnv(
    { hook_event_name: 'SessionStart', cwd: workspace },
    { PROJECT_MEMORY_AGENTS_HOME: agentsHome },
    workspace,
  );
  assert.match(output.hookSpecificOutput.additionalContext, /Active workflow plan: \.agent-artifacts\/workflow\/plans\/configured-plan/);
  assert.match(output.hookSpecificOutput.additionalContext, /Active merge request review: \.agent-artifacts\/reviews\/configured-review/);
});

test('workflow hook follows configured roots in YAML flow mappings', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'workflow-flow-config-hook-'));
  const agentsHome = mkdtempSync(path.join(os.tmpdir(), 'workflow-flow-config-home-'));
  const configDir = path.join(agentsHome, '.wiolett', 'config');
  const workflowRoot = path.join(workspace, '.flow-workflow');
  const reviewRoot = path.join(workspace, '.flow-reviews');
  const memoryRoot = path.join(workspace, '.flow-memory');
  mkdirSync(configDir, { recursive: true });
  mkdirSync(path.join(workflowRoot, 'plans', 'flow-plan'), { recursive: true });
  mkdirSync(reviewRoot, { recursive: true });
  mkdirSync(memoryRoot, { recursive: true });
  writeFileSync(path.join(configDir, 'mcp-config.yml'), `version: 1
mcp:
  workflow: { artifacts: { root: .flow-workflow, plans: plans, audits: audits } }
  merge-request-review: { artifacts: { root: .flow-reviews } }
  agent-memory: { storage: { memory: { project: .flow-memory } } }
`, 'utf8');
  writeFileSync(path.join(workflowRoot, 'state.json'), JSON.stringify({ active_plan: 'plans/flow-plan' }), 'utf8');
  writeFileSync(path.join(reviewRoot, 'state.json'), JSON.stringify({ active_review: 'mr-reviews/flow-review' }), 'utf8');

  const output = runHookWithEnv(
    { hook_event_name: 'SessionStart', cwd: workspace },
    { PROJECT_MEMORY_AGENTS_HOME: agentsHome },
    workspace,
  );
  const context = output.hookSpecificOutput.additionalContext;
  assert.match(context, /Active workflow plan: \.flow-workflow\/plans\/flow-plan/);
  assert.match(context, /Active merge request review: \.flow-reviews\/flow-review/);
  assert.match(context, /Project Agent Memory `\.flow-memory\/` exists/);
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

test('Codex registers commitment Stop enforcement while Claude remains hook-optional', () => {
  const codexConfig = JSON.parse(readFileSync(hookConfig, 'utf8'));
  const claudeConfig = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/workflow/hooks/hooks.json'), 'utf8'));

  assert.match(codexConfig.hooks.Stop[0].hooks[0].command, /PLUGIN_ROOT/);
  assert.equal(claudeConfig.hooks.Stop, undefined);
});

test('Codex Stop blocks pending material reflection once without affecting legacy plans', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'workflow-stop-reflection-'));
  const planDir = path.join(workspace, '.workflow/plans/01-01-26-reflection');
  mkdirSync(planDir, { recursive: true });
  writeFileSync(path.join(workspace, '.workflow/state.json'), JSON.stringify({ active_plan: 'plans/01-01-26-reflection' }), 'utf8');
  writeFileSync(
    path.join(planDir, 'state.json'),
    JSON.stringify({ commitment_reflection: { required: true, status: 'pending', proposal: { id: 'commitment-1' } } }),
    'utf8'
  );

  const blocked = runHook({ hook_event_name: 'Stop', cwd: workspace, stop_hook_active: false }, workspace);
  const loopGuard = runHook({ hook_event_name: 'Stop', cwd: workspace, stop_hook_active: true }, workspace);

  assert.equal(blocked.decision, 'block');
  assert.match(blocked.reason, /shrink-first reflection/);
  assert.doesNotMatch(blocked.reason, /launch an agent/i);
  assert.equal(loopGuard.continue, true);

  writeFileSync(path.join(planDir, 'state.json'), JSON.stringify({ phase: 'executing' }), 'utf8');
  assert.equal(runHook({ hook_event_name: 'Stop', cwd: workspace }, workspace).continue, true);
});

test('Codex Stop allows reviewed and awaiting-user commitment states', () => {
  for (const status of ['reviewed', 'awaiting_user', 'not_required']) {
    const workspace = mkdtempSync(path.join(os.tmpdir(), 'workflow-stop-allowed-'));
    const planDir = path.join(workspace, '.workflow/plans/01-01-26-reflection');
    mkdirSync(planDir, { recursive: true });
    writeFileSync(path.join(workspace, '.workflow/state.json'), JSON.stringify({ active_plan: 'plans/01-01-26-reflection' }), 'utf8');
    writeFileSync(
      path.join(planDir, 'state.json'),
      JSON.stringify({ commitment_reflection: { required: status !== 'not_required', status } }),
      'utf8'
    );
    assert.equal(runHook({ hook_event_name: 'Stop', cwd: workspace }, workspace).continue, true);
  }
});

test('Kimi Stop uses native exit-code blocking without changing Codex output', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'workflow-kimi-stop-'));
  const planDir = path.join(workspace, '.workflow/plans/01-01-26-kimi-reflection');
  mkdirSync(planDir, { recursive: true });
  writeFileSync(path.join(workspace, '.workflow/state.json'), JSON.stringify({ active_plan: 'plans/01-01-26-kimi-reflection' }), 'utf8');
  writeFileSync(
    path.join(planDir, 'state.json'),
    JSON.stringify({ commitment_reflection: { required: true, status: 'pending', proposal: { id: 'commitment-1' } } }),
    'utf8'
  );

  const kimiBlocked = runKimiHook({ hook_event_name: 'Stop', cwd: workspace }, workspace);
  assert.equal(kimiBlocked.status, 2);
  assert.equal(kimiBlocked.stdout, '');
  assert.match(kimiBlocked.stderr, /shrink-first reflection/);

  const codexBlocked = runHook({ hook_event_name: 'Stop', cwd: workspace }, workspace);
  assert.equal(codexBlocked.decision, 'block');
  assert.match(codexBlocked.reason, /shrink-first reflection/);

  writeFileSync(
    path.join(planDir, 'state.json'),
    JSON.stringify({ commitment_reflection: { required: true, status: 'reviewed' } }),
    'utf8'
  );
  const kimiAllowed = runKimiHook({ hook_event_name: 'Stop', cwd: workspace }, workspace);
  assert.equal(kimiAllowed.status, 0);
  assert.equal(kimiAllowed.stdout, '');
  assert.equal(kimiAllowed.stderr, '');
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

test('repository ships Kimi aggregate and per-plugin manifests without cross-platform hook drift', () => {
  const rootPackage = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const kimiMarketplace = JSON.parse(readFileSync(path.join(repoRoot, '.kimi-plugin/marketplace.json'), 'utf8'));
  const aggregate = JSON.parse(readFileSync(path.join(repoRoot, 'kimi.plugin.json'), 'utf8'));
  const pluginNames = ['agent-memory', 'workflow', 'merge-request-review'];
  const supportedKimiFields = new Set([
    'name',
    'version',
    'description',
    'keywords',
    'author',
    'homepage',
    'license',
    'skills',
    'sessionStart',
    'skillInstructions',
    'mcpServers',
    'hooks',
    'commands',
    'interface',
  ]);

  assert.equal(aggregate.name, 'wiolett-industries');
  assert.equal(aggregate.version, rootPackage.version);
  assert.equal(aggregate.sessionStart.skill, 'using-workflow');
  assert.deepEqual(Object.keys(aggregate.mcpServers), pluginNames);
  assert.deepEqual(aggregate.hooks.map((hook) => hook.event), ['Stop']);
  assert.doesNotMatch(JSON.stringify(aggregate.hooks), /PostToolUse/);
  assert.equal(aggregate.agents, undefined);
  assert.deepEqual(kimiMarketplace.plugins.map((plugin) => plugin.id), ['wiolett-industries']);
  assert.equal(kimiMarketplace.plugins[0].source, 'https://github.com/wiolett-industries/marketplace');
  assert.equal(kimiMarketplace.plugins[0].version, aggregate.version);

  for (const pluginName of pluginNames) {
    const pluginRoot = path.join(repoRoot, 'plugins', pluginName);
    const kimi = JSON.parse(readFileSync(path.join(pluginRoot, 'kimi.plugin.json'), 'utf8'));
    const codex = JSON.parse(readFileSync(path.join(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'));
    const claude = JSON.parse(readFileSync(path.join(pluginRoot, '.claude-plugin/plugin.json'), 'utf8'));
    const sourceMcp = JSON.parse(readFileSync(path.join(pluginRoot, '.mcp.json'), 'utf8')).mcpServers;

    assert.equal(kimi.name, pluginName);
    assert.equal(kimi.version, codex.version);
    assert.equal(kimi.version, claude.version);
    assert.equal(kimi.agents, undefined);
    assert.ok(Object.keys(kimi).every((field) => supportedKimiFields.has(field)), `${pluginName} has an unsupported Kimi field`);

    for (const skillPath of Array.isArray(kimi.skills) ? kimi.skills : [kimi.skills]) {
      assert.match(skillPath, /^\.\/.+\/$/);
      assert.equal(existsSync(path.resolve(pluginRoot, skillPath)), true, `${pluginName} has a missing Kimi skills path`);
    }

    for (const [serverName, server] of Object.entries(sourceMcp)) {
      assert.deepEqual(kimi.mcpServers[serverName], {
        command: server.command,
        args: server.args,
      });
      assert.deepEqual(aggregate.mcpServers[serverName], kimi.mcpServers[serverName]);
    }
  }

  const kimiWorkflow = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/workflow/kimi.plugin.json'), 'utf8'));
  const codexWorkflow = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/workflow/.codex-plugin/plugin.json'), 'utf8'));
  const claudeHooks = JSON.parse(readFileSync(path.join(repoRoot, 'plugins/workflow/hooks/hooks.json'), 'utf8'));
  assert.deepEqual(kimiWorkflow.hooks.map((hook) => hook.event), ['Stop']);
  assert.equal(codexWorkflow.hooks, './hooks/codex-hooks.json');
  assert.equal(claudeHooks.hooks.PostToolUse[0].matcher, 'Bash');
  assert.equal(claudeHooks.hooks.Stop, undefined);
});

test('README documents Kimi aggregate installation and platform boundaries', () => {
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

  assert.match(readme, /\/plugins install https:\/\/github\.com\/wiolett-industries\/marketplace/);
  assert.match(readme, /one aggregate `wiolett-industries`\s+plugin/);
  assert.match(readme, /MCP servers can be enabled or disabled\s+independently/);
  assert.match(readme, /does not load the Codex TOML agents or Claude Code plugin\s+agents/);
  assert.match(readme, /Claude\/Codex hook\s+configuration remains separate/);
  assert.match(readme, /Kimi treats that event as observation-only/);
});

test('runtime source versions match package manifests', () => {
  for (const packageName of ['agent-memory', 'workflow', 'merge-request-review']) {
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, `packages/${packageName}/package.json`), 'utf8'));
    const source = readFileSync(path.join(repoRoot, `packages/${packageName}/src/index.ts`), 'utf8');
    assert.match(source, new RegExp(`const VERSION = '${packageJson.version.replaceAll('.', '\\.')}'`));
  }
});

test('workflow docs describe source MCP tool and artifact contracts', () => {
  const packageReadme = readFileSync(path.join(repoRoot, 'packages/workflow/README.md'), 'utf8');
  const pluginReadme = readFileSync(path.join(repoRoot, 'plugins/workflow/README.md'), 'utf8');
  const workflowMcp = readFileSync(path.join(skillDir, 'workflow-mcp/SKILL.md'), 'utf8');
  const workflowMcpReference = readFileSync(path.join(skillDir, 'workflow-mcp/references/operations.md'), 'utf8');
  const workflowMcpContract = `${workflowMcp}\n${workflowMcpReference}`;
  const expectedTools = [
    'workflow_status',
    'workflow_plan_create',
    'workflow_plan_update',
    'workflow_plan_commitment_propose',
    'workflow_plan_commitment_confirm',
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
  assert.match(workflowMcpContract, /ui-contract\.md/);
  assert.match(workflowMcpContract, /shared operation handler/);
  assert.match(workflowMcpContract, /installed\/published package version/);
});

test('workflow skills use lowercase names, lean entrypoints, and valid direct references', () => {
  const skillFolders = readdirSync(skillDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  let totalWords = 0;

  for (const folder of skillFolders) {
    const skillPath = path.join(skillDir, folder, 'SKILL.md');
    const content = readFileSync(skillPath, 'utf8');
    const name = content.match(/^name: (.+)$/m)?.[1];
    const words = content.trim().split(/\s+/).length;
    totalWords += words;

    assert.equal(name, folder);
    assert.match(name, /^[a-z0-9-]+$/);
    assert.doesNotMatch(content, /^description: ALWAYS/m);
    assert.ok(words < 850, `${folder} entrypoint is too large: ${words} words`);

    for (const match of content.matchAll(/\]\((references\/[^)]+)\)/g)) {
      assert.equal(existsSync(path.join(skillDir, folder, match[1])), true, `${folder} has a missing reference ${match[1]}`);
    }
  }

  assert.ok(totalWords < 5200, `workflow skill entrypoints are too large: ${totalWords} words`);
});

test('workflow and merge request agents stay paired across Codex and Claude', () => {
  assert.deepEqual(agentNames('packages/workflow/agents', '.toml'), agentNames('plugins/workflow/agents', '.md'));
  assert.deepEqual(agentNames('packages/merge-request-review/agents', '.toml'), agentNames('plugins/merge-request-review/agents', '.md'));
});

test('shared workflow agent output contracts keep routing fields', () => {
  const codexFixTriage = readAgentFile('packages/workflow/agents', 'workflow_fix_triage', '.toml');
  const claudeFixTriage = readAgentFile('plugins/workflow/agents', 'workflow_fix_triage', '.md');

  assert.match(codexFixTriage, /work_class: mechanical \| structured \| standard \| complex \| critical/);
  assert.match(codexFixTriage, /agent_role: workflow_implementer \| workflow_implementer_standard \| workflow_implementer_complex \| main/);
  assert.match(claudeFixTriage, /work_class: mechanical \| structured \| standard \| complex \| critical/);
  assert.match(claudeFixTriage, /agent_role: workflow_implementer \| workflow_implementer_standard \| workflow_implementer_complex \| main/);
});

test('canonical Codex agents use GPT-5.6 role routing without static extreme effort', () => {
  const expected = {
    workflow_fix_triage: ['gpt-5.6-luna', 'low'],
    workflow_implementer: ['gpt-5.6-luna', 'medium'],
    workflow_combined_reviewer: ['gpt-5.6-luna', 'medium'],
    workflow_explorer: ['gpt-5.6-terra', 'medium'],
    workflow_implementer_standard: ['gpt-5.6-terra', 'medium'],
    workflow_plan_overall_reviewer: ['gpt-5.6-terra', 'medium'],
    workflow_overall_reviewer: ['gpt-5.6-terra', 'medium'],
    workflow_scope_compliance_reviewer: ['gpt-5.6-terra', 'medium'],
    workflow_audit_prompt_writer: ['gpt-5.6-terra', 'medium'],
    workflow_audit_sanity_reviewer: ['gpt-5.6-terra', 'medium'],
    workflow_sanity_reviewer: ['gpt-5.6-terra', 'high'],
    workflow_plan_sanity_reviewer: ['gpt-5.6-terra', 'high'],
    workflow_audit_reviewer: ['gpt-5.6-terra', 'high'],
    workflow_master_auditor: ['gpt-5.6-terra', 'high'],
    workflow_intent_reviewer: ['gpt-5.6-sol', 'high'],
    workflow_implementer_complex: ['gpt-5.6-sol', 'high'],
    workflow_risk_reviewer: ['gpt-5.6-sol', 'high'],
    merge_request_discussion_auditor: ['gpt-5.6-luna', 'medium'],
    merge_request_verification_reviewer: ['gpt-5.6-luna', 'medium'],
    merge_request_primary_reviewer: ['gpt-5.6-terra', 'high'],
    merge_request_risk_reviewer: ['gpt-5.6-sol', 'high'],
  };

  for (const [name, [model, effort]] of Object.entries(expected)) {
    const dir = name.startsWith('workflow_') ? 'packages/workflow/agents' : 'packages/merge-request-review/agents';
    const content = readAgentFile(dir, name, '.toml');
    assert.match(content, new RegExp(`^model = "${model.replaceAll('.', '\\.')}"$`, 'm'));
    assert.match(content, new RegExp(`^model_reasoning_effort = "${effort}"$`, 'm'));
    assert.doesNotMatch(content, /^model_reasoning_effort = "(?:xhigh|max|ultra)"$/m);
  }
});

test('Claude-compatible agents mirror lightweight, everyday, and high-assurance tiers', () => {
  const expected = {
    workflow_fix_triage: ['haiku', 'low'],
    workflow_implementer: ['haiku', 'medium'],
    workflow_implementer_standard: ['sonnet', 'medium'],
    workflow_implementer_complex: ['opus', 'high'],
    workflow_risk_reviewer: ['opus', 'high'],
    merge_request_discussion_auditor: ['haiku', 'medium'],
    merge_request_verification_reviewer: ['haiku', 'medium'],
    merge_request_primary_reviewer: ['sonnet', 'high'],
    merge_request_risk_reviewer: ['opus', 'high'],
  };

  for (const [name, [model, effort]] of Object.entries(expected)) {
    const dir = name.startsWith('workflow_') ? 'plugins/workflow/agents' : 'plugins/merge-request-review/agents';
    const content = readAgentFile(dir, name, '.md');
    assert.match(content, new RegExp(`^model: ${model}$`, 'm'));
    assert.match(content, new RegExp(`^effort: ${effort}$`, 'm'));
  }

  for (const dir of ['plugins/workflow/agents', 'plugins/merge-request-review/agents']) {
    for (const name of agentNames(dir, '.md')) {
      assert.doesNotMatch(readAgentFile(dir, name, '.md'), /^effort: (?:xhigh|max|ultra)$/m);
    }
  }
});

test('workflow skills preserve mandatory routing and MCP boundaries', () => {
  const usingWorkflow = readFileSync(path.join(skillDir, 'using-workflow/SKILL.md'), 'utf8');
  const intentGate = readFileSync(path.join(skillDir, 'intent-gate/SKILL.md'), 'utf8');
  const workflowMcp = readFileSync(path.join(skillDir, 'workflow-mcp/SKILL.md'), 'utf8');
  const writingPlans = readFileSync(path.join(skillDir, 'writing-plans/SKILL.md'), 'utf8');
  const executingPlans = readFileSync(path.join(skillDir, 'executing-plans/SKILL.md'), 'utf8');
  const finalizingPlan = readFileSync(path.join(skillDir, 'finalizing-plan/SKILL.md'), 'utf8');

  assert.match(usingWorkflow, /Run a local `intent-gate` for non-trivial work/);
  assert.match(usingWorkflow, /A skill trigger never implies an artifact, subagent, plan, or verification step/);
  assert.match(usingWorkflow, /Read-only, no-edits, without changes/);
  assert.match(intentGate, /brief local routing decision, not optional ceremony and not an automatic subagent step/);
  assert.match(workflowMcp, /normal path, not a preference/);
  assert.match(writingPlans, /Manual `\.workflow\/` writes are fallback only/);
  assert.match(executingPlans, /manual state\/artifact writes are fallback only/i);
  assert.match(executingPlans, /workflow_plan_complete/);
  assert.match(finalizingPlan, /Manual findings\/state\/artifact writes are fallback only/);
  assert.match(finalizingPlan, /workflow_plan_complete/);
});

test('workflow prompts route subagents by task shape and cap review loops', () => {
  const writingPlans = readFileSync(path.join(skillDir, 'writing-plans/SKILL.md'), 'utf8');
  const executingPlans = readFileSync(path.join(skillDir, 'executing-plans/SKILL.md'), 'utf8');
  const finalizingPlan = readFileSync(path.join(skillDir, 'finalizing-plan/SKILL.md'), 'utf8');
  const executionReference = readFileSync(path.join(skillDir, 'executing-plans/references/execution-state.md'), 'utf8');
  const contextDiscovery = readFileSync(path.join(skillDir, 'context-discovery/SKILL.md'), 'utf8');
  const uiContract = readFileSync(path.join(skillDir, 'ui-contract/SKILL.md'), 'utf8');
  const implementer = readFileSync(path.join(repoRoot, 'packages/workflow/agents/workflow_implementer.toml'), 'utf8');
  const fixTriage = readFileSync(path.join(repoRoot, 'packages/workflow/agents/workflow_fix_triage.toml'), 'utf8');

  assert.match(writingPlans, /separate analysis\/decision tasks from small implementation tasks/);
  assert.match(writingPlans, /work_class.*agent_role.*delegation_reason/s);
  assert.match(executingPlans, /Semantic Work Routing/);
  assert.match(executingPlans, /Exact model and reasoning effort live only in canonical custom-agent TOML files/);
  assert.match(executionReference, /Bounded Worker Prompt/);
  assert.match(executingPlans, /agent budget is global across planning, execution, and finalization/i);
  assert.match(executingPlans, /Never fan out by file count, checklist length, number of chunks, or number of applicable skills/);
  assert.match(finalizingPlan, /Do not chase perfection indefinitely/);
  assert.match(finalizingPlan, /finalization never creates fresh budgets/);
  assert.match(finalizingPlan, /re-review only the changed delta plus affected integration paths/i);
  assert.match(contextDiscovery, /Ask only questions whose answers can change scope, architecture, risk, acceptance criteria, or user-visible behavior/);
  assert.match(uiContract, /Mockup And Prototype Fast Path/);
  assert.match(uiContract, /use no UI review agent under `fast`/);
  assert.match(implementer, /bounded patch worker, not an architecture analyst/);
  assert.match(implementer, /report `NEEDS_CONTEXT`/);
  assert.match(fixTriage, /Stop low-value loops/);
  assert.match(fixTriage, /must_fix.*should_fix.*accept_low.*out_of_scope/s);
  assert.match(fixTriage, /work_class: mechanical \| structured \| standard \| complex \| critical/);
  assert.match(fixTriage, /agent_role: workflow_implementer \| workflow_implementer_standard \| workflow_implementer_complex \| main/);
});

test('workflow skills bound context, delegation, and scope amplification portably', () => {
  const usingWorkflow = readFileSync(path.join(skillDir, 'using-workflow/SKILL.md'), 'utf8');
  const intentGate = readFileSync(path.join(skillDir, 'intent-gate/SKILL.md'), 'utf8');
  const contextDiscovery = readFileSync(path.join(skillDir, 'context-discovery/SKILL.md'), 'utf8');
  const writingPlans = readFileSync(path.join(skillDir, 'writing-plans/SKILL.md'), 'utf8');
  const executingPlans = readFileSync(path.join(skillDir, 'executing-plans/SKILL.md'), 'utf8');
  const finalizingPlan = readFileSync(path.join(skillDir, 'finalizing-plan/SKILL.md'), 'utf8');
  const workflowMcp = readFileSync(path.join(skillDir, 'workflow-mcp/SKILL.md'), 'utf8');

  assert.match(usingWorkflow, /Authorization is permission, not activation or an explicit request/);
  assert.match(usingWorkflow, /existing-code review.*default to local work/);
  assert.match(contextDiscovery, /at most five relevant files/);
  assert.match(contextDiscovery, /twelve files or about 50 KB/);
  assert.match(contextDiscovery, /does not restart discovery/);
  assert.match(intentGate, /L0.*L1.*L2.*L3/s);
  assert.match(intentGate, /material plan, architecture decision, or scope-expanding solution/);
  assert.match(intentGate, /Do this silently for chat-only work/);
  assert.match(writingPlans, /workflow_plan_commitment_propose/);
  assert.match(writingPlans, /same-model shrink-first reflection/);
  assert.match(executingPlans, /Do not perform opportunistic refactors/);
  assert.match(finalizingPlan, /Check scope before style/);
  assert.match(workflowMcp, /Claude Code and other clients must never be instructed to find or wait for that hook/);

  for (const sharedSkill of [writingPlans, executingPlans, finalizingPlan, workflowMcp]) {
    assert.doesNotMatch(sharedSkill, /stop_hook_active|PLUGIN_ROOT|CLAUDE_PLUGIN_ROOT/);
  }
});

test('workflow skills preserve memory, audit, and MCP guardrails', () => {
  const usingWorkflow = readFileSync(path.join(skillDir, 'using-workflow/SKILL.md'), 'utf8');
  const finalizingPlan = readFileSync(path.join(skillDir, 'finalizing-plan/SKILL.md'), 'utf8');
  const auditFlow = readFileSync(path.join(skillDir, 'audit-flow/SKILL.md'), 'utf8');
  const workflowMcp = readFileSync(path.join(skillDir, 'workflow-mcp/SKILL.md'), 'utf8');
  const workflowMcpReference = readFileSync(path.join(skillDir, 'workflow-mcp/references/operations.md'), 'utf8');
  const workflowMcpContract = `${workflowMcp}\n${workflowMcpReference}`;

  assert.match(usingWorkflow, /final memory completion latch/);
  assert.match(usingWorkflow, /Authorization is permission, not activation/);
  assert.match(finalizingPlan, /follow the memory completion latch in `using-agent-memory`/);
  assert.match(auditFlow, /Agents are read-only and consume the declared audit budget/);
  assert.match(auditFlow, /default maximum 4/);
  assert.match(workflowMcpContract, /Create vs update guard/);
  assert.match(workflowMcp, /Do not reopen completed runs without an explicit request/);
  assert.match(workflowMcpContract, /workflow_plan_complete/);
  assert.match(workflowMcpContract, /active_chunk/);
  assert.match(workflowMcpContract, /complete_chunk/);
  assert.match(workflowMcpContract, /Any status other than `active` or `in_progress` clears `active_chunk`/);
  assert.match(workflowMcpContract, /set_chunk_status` with `blocked`/);
  assert.match(usingWorkflow, /workflow_plan_complete/);
  assert.match(usingWorkflow, /workflow_audit_complete/);
  assert.match(usingWorkflow, /phase update is not completion/);
});

test('generic review rejects findings without canonical provenance evidence', () => {
  const finalizingPlan = readFileSync(path.join(skillDir, 'finalizing-plan/SKILL.md'), 'utf8');
  const codexReviewer = readAgentFile('packages/workflow/agents', 'workflow_overall_reviewer', '.toml');
  const claudeReviewer = readAgentFile('plugins/workflow/agents', 'workflow_overall_reviewer', '.md');

  assert.match(finalizingPlan, /one focused project-memory query/);
  assert.match(finalizingPlan, /Reject findings based only on a derived artifact/);
  assert.match(finalizingPlan, /pass the verified source-of-truth fact and current anchor/);
  for (const prompt of [codexReviewer, claudeReviewer]) {
    assert.match(prompt, /canonical source\/owning contract/);
    assert.match(prompt, /A derived artifact alone is not a finding/);
    assert.match(prompt, /evidence_basis/);
  }
});
