import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { normalizeFindings } from '../dist/findings.js';
import {
  completeAuditRun,
  completePlanRun,
  createAuditRun,
  createPlanRun,
  getWorkflowStatus,
  updateAuditRun,
  updatePlanRun,
  writeAuditArtifact,
  writeWorkflowHandoff,
  writePlanArtifact,
} from '../dist/runs.js';

test('creates a plan run and marks it active', () => {
  const workspace = makeWorkspace();

  const result = createPlanRun({
    workspace_root: workspace,
    title: 'Workflow tools',
    slug: '01-01-26-workflow-tools',
    complexity: 'medium',
    plan_markdown: '# Plan\n',
    tasks: [{ id: 'T1', title: 'Create tools' }],
  });

  const rootState = readJson(path.join(workspace, '.workflow', 'state.json'));
  const state = readJson(path.join(workspace, '.workflow', 'plans', '01-01-26-workflow-tools', 'state.json'));
  const manifest = readJson(path.join(workspace, '.workflow', 'plans', '01-01-26-workflow-tools', 'manifest.json'));

  assert.equal(result.run, 'plans/01-01-26-workflow-tools');
  assert.equal(rootState.active_plan, 'plans/01-01-26-workflow-tools');
  assert.equal(manifest.kind, 'plan');
  assert.equal(manifest.paths.ui_contract, 'plans/01-01-26-workflow-tools/ui-contract.md');
  assert.equal(state.tasks[0].id, 'T1');
  assert.equal(state.active_chunk, null);
  assert.equal(readFileSync(path.join(workspace, '.workflow', 'plans', '01-01-26-workflow-tools', 'plan.md'), 'utf8'), '# Plan\n');
  assert.match(readFileSync(path.join(workspace, '.workflow', 'plans', '01-01-26-workflow-tools', 'ui-contract.md'), 'utf8'), /No UI contract applies/);
});

test('updates plan state with structured operations', () => {
  const workspace = makeWorkspace();
  createPlanRun({
    workspace_root: workspace,
    title: 'Plan update',
    slug: '01-01-26-plan-update',
    complexity: 'simple',
  });

  const result = updatePlanRun(workspace, undefined, [
    { type: 'set_phase', phase: 'executing' },
    { type: 'set_complexity', complexity: 'medium' },
    { type: 'upsert_task', task: { id: 'T2', title: 'Patch files', status: 'pending' } },
    { type: 'complete_task', task_id: 'T2' },
    { type: 'set_open_findings', findings: [{ id: 'F2', severity: 'low', summary: 'Minor note' }] },
  ]);
  const manifest = readJson(path.join(workspace, '.workflow', 'plans', '01-01-26-plan-update', 'manifest.json'));

  assert.equal(result.state.phase, 'executing');
  assert.equal(result.state.complexity, 'medium');
  assert.equal(manifest.phase, 'executing');
  assert.equal(manifest.complexity, 'medium');
  assert.equal(result.state.tasks[0].status, 'completed');
  assert.equal(result.state.open_findings[0].severity, 'LOW');
});

test('updates active plan chunk lifecycle with structured operations', () => {
  const workspace = makeWorkspace();
  createPlanRun({
    workspace_root: workspace,
    title: 'Chunk lifecycle',
    slug: '01-01-26-chunk-lifecycle',
    complexity: 'complex',
    chunks: [{ id: 'C1', title: 'First chunk', status: 'pending' }],
  });

  const active = updatePlanRun(workspace, undefined, [
    { type: 'set_active_chunk', chunk_id: 'C1' },
  ]);
  const waiting = updatePlanRun(workspace, undefined, [
    { type: 'wait_chunk', chunk_id: 'C1' },
    { type: 'set_active_chunk', chunk_id: 'C2' },
    { type: 'complete_chunk', chunk_id: 'C2' },
    { type: 'cancel_chunk', chunk_id: 'C3' },
  ]);

  assert.equal(active.state.active_chunk, 'C1');
  assert.equal(active.state.chunks.find((chunk) => chunk.id === 'C1').title, 'First chunk');
  assert.equal(active.state.chunks.find((chunk) => chunk.id === 'C1').status, 'active');
  assert.equal(waiting.state.active_chunk, null);
  assert.equal(waiting.state.chunks.find((chunk) => chunk.id === 'C1').status, 'waiting');
  assert.equal(waiting.state.chunks.find((chunk) => chunk.id === 'C2').status, 'complete');
  assert.equal(waiting.state.chunks.find((chunk) => chunk.id === 'C3').status, 'cancelled');
});

test('suggests nearest supported workflow operation on update errors', () => {
  const workspace = makeWorkspace();
  createPlanRun({
    workspace_root: workspace,
    title: 'Plan operation error',
    slug: '01-01-26-plan-operation-error',
    complexity: 'simple',
    tasks: [{ id: 'T1', title: 'Patch files', status: 'pending' }],
  });

  assert.throws(
    () => updatePlanRun(workspace, undefined, [{ type: 'set_task_status', task_id: 'T1', status: 'in_progress' }]),
    (error) => {
      assert.match(error.message, /Unsupported workflow operation: set_task_status\./);
      assert.match(error.message, /Nearest supported operation: upsert_task\./);
      assert.match(error.message, /\{"type":"upsert_task","task":\{"id":"T1","status":"in_progress"\}\}/);
      assert.match(error.message, /Supported operations:/);
      return true;
    }
  );
});

test('completes active plan run and clears active plan pointer', () => {
  const workspace = makeWorkspace();
  createPlanRun({
    workspace_root: workspace,
    title: 'Plan completion',
    slug: '01-01-26-plan-completion',
    complexity: 'simple',
  });

  const result = completePlanRun(workspace);
  const rootState = readJson(path.join(workspace, '.workflow', 'state.json'));
  const state = readJson(path.join(workspace, '.workflow', 'plans', '01-01-26-plan-completion', 'state.json'));
  const manifest = readJson(path.join(workspace, '.workflow', 'plans', '01-01-26-plan-completion', 'manifest.json'));

  assert.equal(result.run, 'plans/01-01-26-plan-completion');
  assert.equal(result.state.phase, 'complete');
  assert.equal(state.phase, 'complete');
  assert.equal(manifest.phase, 'complete');
  assert.equal(rootState.active_plan, null);
});

test('completing a named inactive plan preserves the active plan pointer', () => {
  const workspace = makeWorkspace();
  createPlanRun({
    workspace_root: workspace,
    title: 'Old plan',
    slug: '01-01-26-old-plan',
    complexity: 'simple',
  });
  createPlanRun({
    workspace_root: workspace,
    title: 'Current plan',
    slug: '01-01-26-current-plan',
    complexity: 'medium',
  });

  const result = completePlanRun(workspace, 'plans/01-01-26-old-plan');
  const rootState = readJson(path.join(workspace, '.workflow', 'state.json'));
  const oldManifest = readJson(path.join(workspace, '.workflow', 'plans', '01-01-26-old-plan', 'manifest.json'));

  assert.equal(result.run, 'plans/01-01-26-old-plan');
  assert.equal(result.state.phase, 'complete');
  assert.equal(oldManifest.phase, 'complete');
  assert.equal(rootState.active_plan, 'plans/01-01-26-current-plan');
});

test('writes only allowed plan artifact paths', () => {
  const workspace = makeWorkspace();
  createPlanRun({
    workspace_root: workspace,
    title: 'Artifact write',
    slug: '01-01-26-artifact-write',
    complexity: 'simple',
  });

  const result = writePlanArtifact({
    workspace_root: workspace,
    path: 'artifacts/review-round-1/summary.md',
    content: 'CLEAN\n',
  });

  assert.equal(result.path, '.workflow/plans/01-01-26-artifact-write/artifacts/review-round-1/summary.md');
  assert.equal(readFileSync(path.join(workspace, result.path), 'utf8'), 'CLEAN\n');
  writePlanArtifact({
    workspace_root: workspace,
    path: 'ui-contract.md',
    content: '# UI Contract\n',
  });
  assert.equal(readFileSync(path.join(workspace, '.workflow', 'plans', '01-01-26-artifact-write', 'ui-contract.md'), 'utf8'), '# UI Contract\n');
  assert.throws(
    () => writePlanArtifact({ workspace_root: workspace, path: '../escape.md', content: 'nope' }),
    /not allowed|escapes/
  );
  assert.throws(
    () => writePlanArtifact({ workspace_root: workspace, path: 'artifacts/empty.md' }),
    /exactly one/
  );
  assert.throws(
    () => writePlanArtifact({ workspace_root: workspace, path: 'artifacts/both.md', content: 'text', json: { text: true } }),
    /exactly one/
  );
});

test('writes structured handoffs and indexes them in state', () => {
  const workspace = makeWorkspace();
  createPlanRun({
    workspace_root: workspace,
    title: 'Handoff plan',
    slug: '01-01-26-handoff-plan',
    complexity: 'medium',
  });

  const result = writeWorkflowHandoff({
    workspace_root: workspace,
    kind: 'plan',
    from_module: 'audit-flow',
    to_module: 'writing-plans',
    summary: 'Audit is ready to become a plan.',
    artifacts: ['audits/01-01-26-audit/master-audit.md'],
    decisions: ['Fix confirmed HIGH findings first'],
    open_questions: ['Should LOW findings be deferred?'],
    risks: ['Scope could expand'],
    next_actions: ['Write plan from planning-input.md'],
  });

  const state = readJson(path.join(workspace, '.workflow', 'plans', '01-01-26-handoff-plan', 'state.json'));
  const handoff = readJson(path.join(workspace, result.json_path));
  const markdown = readFileSync(path.join(workspace, result.markdown_path), 'utf8');

  assert.equal(result.handoff.id, 'audit-flow-to-writing-plans');
  assert.equal(state.latest_handoff.to_module, 'writing-plans');
  assert.equal(state.handoffs[0].status, 'ready');
  assert.equal(handoff.summary, 'Audit is ready to become a plan.');
  assert.match(markdown, /# Handoff: audit-flow -> writing-plans/);
});

test('creates an audit run and writes audit artifacts', () => {
  const workspace = makeWorkspace();

  createAuditRun({
    workspace_root: workspace,
    title: 'Security audit',
    slug: '01-01-26-security-audit',
    depth: 'deep',
    target: 'project',
    findings: [{ id: 'F1', severity: 'high', summary: 'Needs review', evidence: 'src/index.ts:1' }],
  });
  const update = updateAuditRun(workspace, undefined, [
    { type: 'set_phase', phase: 'sanity_review' },
    { type: 'upsert_reviewer', reviewer: { id: 'R1', model: 'gpt-5.4', status: 'done' } },
  ]);
  const write = writeAuditArtifact({
    workspace_root: workspace,
    path: 'reviews/R1.md',
    content: '# Review\n',
  });

  const rootState = readJson(path.join(workspace, '.workflow', 'state.json'));
  const findings = readJson(path.join(workspace, '.workflow', 'audits', '01-01-26-security-audit', 'findings.json'));

  assert.equal(rootState.active_audit, 'audits/01-01-26-security-audit');
  assert.equal(update.state.phase, 'sanity_review');
  assert.equal(update.state.reviewers[0].id, 'R1');
  assert.equal(write.path, '.workflow/audits/01-01-26-security-audit/reviews/R1.md');
  assert.equal(findings.findings[0].severity, 'HIGH');
});

test('syncs manifest indexes when state artifacts are written directly', () => {
  const workspace = makeWorkspace();
  createAuditRun({
    workspace_root: workspace,
    title: 'Direct state write',
    slug: '01-01-26-direct-state-write',
    depth: 'standard',
    target: 'project',
  });

  writeAuditArtifact({
    workspace_root: workspace,
    path: 'state.json',
    json: {
      phase: 'master_audit',
      depth: 'deep',
      target: 'plan',
      reviewers: [],
      sanity_checks: [],
      open_findings: [],
    },
  });

  const manifest = readJson(path.join(workspace, '.workflow', 'audits', '01-01-26-direct-state-write', 'manifest.json'));

  assert.equal(manifest.phase, 'master_audit');
  assert.equal(manifest.depth, 'deep');
  assert.equal(manifest.target, 'plan');
});

test('completes active audit run and clears active audit pointer', () => {
  const workspace = makeWorkspace();
  createAuditRun({
    workspace_root: workspace,
    title: 'Audit completion',
    slug: '01-01-26-audit-completion',
    depth: 'standard',
    target: 'project',
  });

  const result = completeAuditRun(workspace);
  const rootState = readJson(path.join(workspace, '.workflow', 'state.json'));
  const state = readJson(path.join(workspace, '.workflow', 'audits', '01-01-26-audit-completion', 'state.json'));
  const manifest = readJson(path.join(workspace, '.workflow', 'audits', '01-01-26-audit-completion', 'manifest.json'));

  assert.equal(result.run, 'audits/01-01-26-audit-completion');
  assert.equal(result.state.phase, 'complete');
  assert.equal(state.phase, 'complete');
  assert.equal(manifest.phase, 'complete');
  assert.equal(rootState.active_audit, null);
});

test('reports status and normalizes findings deterministically', () => {
  const workspace = makeWorkspace();
  createPlanRun({
    workspace_root: workspace,
    title: 'Status plan',
    slug: '01-01-26-status-plan',
    complexity: 'complex',
  });
  createAuditRun({
    workspace_root: workspace,
    title: 'Status audit',
    slug: '01-01-26-status-audit',
    depth: 'standard',
    target: 'diff',
  });

  const status = getWorkflowStatus(workspace);
  const normalized = normalizeFindings([
    { id: 'L', severity: 'low', summary: 'Low' },
    { id: 'B', severity: 'blocking', summary: 'Blocker' },
    { id: 'B', severity: 'blocking', summary: 'Duplicate' },
  ]);

  assert.equal(status.state.active_plan, 'plans/01-01-26-status-plan');
  assert.equal(status.state.active_audit, 'audits/01-01-26-status-audit');
  assert.deepEqual(normalized.findings.map((finding) => finding.id), ['B', 'L']);
});

function makeWorkspace() {
  return mkdtempSync(path.join(os.tmpdir(), 'workflow-run-workspace-'));
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}
