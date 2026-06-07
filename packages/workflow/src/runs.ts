import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeFindings } from './findings.js';
import { resolveSafeRelative, writeJsonFile } from './fs-utils.js';
import { makeSlug } from './naming.js';
import { applyOperation, asArray, type RunOperation, upsertById } from './run-operations.js';
import { readRootState, relativeToWorkspace, updateRootState } from './workflow-state.js';
import { listRunDirs, resolveWorkspaceRoot, workflowRoot } from './workspace.js';

export type PlanComplexity = 'simple' | 'medium' | 'complex' | 'very_complex';
export type AuditDepth = 'simple' | 'standard' | 'deep' | 'exhaustive';
export type AuditTarget = 'project' | 'subsystem' | 'diff' | 'plan';

export interface CreatePlanInput {
  workspace_root?: string;
  title: string;
  slug?: string;
  complexity: PlanComplexity;
  plan_markdown?: string;
  context_markdown?: string;
  questions_markdown?: string;
  decisions_markdown?: string;
  tasks?: unknown[];
  chunks?: unknown[];
}

export interface CreateAuditInput {
  workspace_root?: string;
  title: string;
  slug?: string;
  depth: AuditDepth;
  target: AuditTarget;
  audit_markdown?: string;
  scope_markdown?: string;
  planning_input_markdown?: string;
  findings?: unknown;
}

export interface ArtifactWriteInput {
  workspace_root?: string;
  run?: string;
  path: string;
  content?: string;
  json?: unknown;
}

export interface HandoffWriteInput {
  workspace_root?: string;
  kind: 'plan' | 'audit';
  run?: string;
  id?: string;
  from_module: string;
  to_module: string;
  status?: 'ready' | 'partial' | 'blocked' | 'complete';
  summary: string;
  artifacts?: string[];
  decisions?: string[];
  open_questions?: string[];
  risks?: string[];
  next_actions?: string[];
  payload?: unknown;
}

export function createPlanRun(input: CreatePlanInput): Record<string, unknown> {
  const workspaceRoot = resolveWorkspaceRoot(input.workspace_root);
  const slug = normalizeRunSlug(input.slug || makeSlug(input.title));
  const runDir = resolveSafeRelative(path.join(workspaceRoot, '.workflow', 'plans'), slug);
  const now = new Date().toISOString();

  assertNewRun(runDir);
  mkdirSync(path.join(runDir, 'artifacts'), { recursive: true });
  mkdirSync(path.join(runDir, 'chunks'), { recursive: true });
  mkdirSync(path.join(runDir, 'handoffs'), { recursive: true });

  const manifest = {
    kind: 'plan',
    version: 1,
    run_id: `plans/${slug}`,
    slug,
    phase: 'planning',
    title: input.title,
    complexity: input.complexity,
    created_at: now,
    updated_at: now,
    workspace_root: workspaceRoot,
    paths: planPaths(slug),
  };
  const state = {
    phase: 'planning',
    complexity: input.complexity,
    tasks: input.tasks || [],
    chunks: input.chunks || [],
    active_chunk: null,
    review_round: 0,
    clean_streak: 0,
    open_findings: [],
    handoffs: [],
    latest_handoff: null,
    updated_at: now,
  };

  writeJsonFile(path.join(runDir, 'manifest.json'), manifest);
  writeJsonFile(path.join(runDir, 'state.json'), state);
  writeText(path.join(runDir, 'plan.md'), input.plan_markdown || `# ${input.title}\n`);
  writeText(path.join(runDir, 'context.md'), input.context_markdown || `# Context\n`);
  writeText(path.join(runDir, 'questions.md'), input.questions_markdown || `# Questions\n`);
  writeText(path.join(runDir, 'decisions.md'), input.decisions_markdown || `# Decisions\n`);
  writeText(path.join(runDir, 'ui-contract.md'), `# UI Contract\n\nNo UI contract applies unless frontend or visible UI work is in scope.\n`);

  const rootState = updateRootState(workspaceRoot, { active_plan: `plans/${slug}` });
  return runResult(workspaceRoot, runDir, manifest, state, rootState);
}

export function createAuditRun(input: CreateAuditInput): Record<string, unknown> {
  const workspaceRoot = resolveWorkspaceRoot(input.workspace_root);
  const slug = normalizeRunSlug(input.slug || makeSlug(input.title));
  const runDir = resolveSafeRelative(path.join(workspaceRoot, '.workflow', 'audits'), slug);
  const now = new Date().toISOString();
  const normalizedFindings = normalizeFindings(input.findings || []);

  assertNewRun(runDir);
  for (const dir of ['prompts', 'reviews', 'sanity']) {
    mkdirSync(path.join(runDir, dir), { recursive: true });
  }
  mkdirSync(path.join(runDir, 'handoffs'), { recursive: true });

  const manifest = {
    kind: 'audit',
    version: 1,
    run_id: `audits/${slug}`,
    slug,
    phase: 'scoping',
    title: input.title,
    depth: input.depth,
    target: input.target,
    created_at: now,
    updated_at: now,
    workspace_root: workspaceRoot,
    paths: auditPaths(slug),
  };
  const state = {
    phase: 'scoping',
    depth: input.depth,
    target: input.target,
    reviewers: [],
    sanity_checks: [],
    open_findings: normalizedFindings.findings,
    handoffs: [],
    latest_handoff: null,
    updated_at: now,
  };

  writeJsonFile(path.join(runDir, 'manifest.json'), manifest);
  writeJsonFile(path.join(runDir, 'state.json'), state);
  writeJsonFile(path.join(runDir, 'findings.json'), normalizedFindings);
  writeText(path.join(runDir, 'audit.md'), input.audit_markdown || `# ${input.title}\n`);
  writeText(path.join(runDir, 'scope.md'), input.scope_markdown || `# Scope\n`);
  writeText(path.join(runDir, 'planning-input.md'), input.planning_input_markdown || `# Planning Input\n`);
  writeText(path.join(runDir, 'master-audit.md'), `# Master Audit\n`);

  const rootState = updateRootState(workspaceRoot, { active_audit: `audits/${slug}` });
  return runResult(workspaceRoot, runDir, manifest, state, rootState);
}

export function updatePlanRun(workspaceRootInput: string | undefined, run: string | undefined, operations: RunOperation[]): Record<string, unknown> {
  return updateRunState(workspaceRootInput, 'plans', run, operations);
}

export function updateAuditRun(workspaceRootInput: string | undefined, run: string | undefined, operations: RunOperation[]): Record<string, unknown> {
  return updateRunState(workspaceRootInput, 'audits', run, operations);
}

export function completePlanRun(workspaceRootInput?: string, run?: string): Record<string, unknown> {
  return completeRun(workspaceRootInput, 'plans', run);
}

export function completeAuditRun(workspaceRootInput?: string, run?: string): Record<string, unknown> {
  return completeRun(workspaceRootInput, 'audits', run);
}

export function writePlanArtifact(input: ArtifactWriteInput): Record<string, unknown> {
  return writeRunArtifact('plans', input, ['plan.md', 'context.md', 'questions.md', 'decisions.md', 'ui-contract.md', 'manifest.json', 'state.json'], ['artifacts/', 'chunks/', 'handoffs/']);
}

export function writeAuditArtifact(input: ArtifactWriteInput): Record<string, unknown> {
  return writeRunArtifact('audits', input, ['audit.md', 'scope.md', 'master-audit.md', 'findings.json', 'planning-input.md', 'manifest.json', 'state.json'], ['prompts/', 'reviews/', 'sanity/', 'handoffs/']);
}

export function writeWorkflowHandoff(input: HandoffWriteInput): Record<string, unknown> {
  const workspaceRoot = resolveWorkspaceRoot(input.workspace_root);
  const kind = input.kind === 'plan' ? 'plans' : 'audits';
  const runDir = resolveRunDir(workspaceRoot, kind, input.run);
  const statePath = path.join(runDir, 'state.json');
  const state = readRunJson(statePath);
  const now = new Date().toISOString();
  const id = normalizeHandoffId(input.id || `${input.from_module}-to-${input.to_module}`);
  const handoff = {
    id,
    from_module: input.from_module,
    to_module: input.to_module,
    status: input.status || 'ready',
    summary: input.summary,
    artifacts: input.artifacts || [],
    decisions: input.decisions || [],
    open_questions: input.open_questions || [],
    risks: input.risks || [],
    next_actions: input.next_actions || [],
    payload: input.payload ?? null,
    created_at: now,
    updated_at: now,
  };
  const basePath = path.join(runDir, 'handoffs', id);
  writeJsonFile(`${basePath}.json`, handoff);
  writeText(`${basePath}.md`, renderHandoffMarkdown(handoff));

  const nextState = {
    ...state,
    handoffs: upsertById(asArray(state.handoffs), handoff),
    latest_handoff: handoff,
    updated_at: now,
  };
  writeJsonFile(statePath, nextState);
  syncManifestFromState(runDir, kind, nextState);

  return {
    workspace_root: workspaceRoot,
    run: relativeToWorkflow(workspaceRoot, runDir),
    handoff,
    json_path: relativeToWorkspace(workspaceRoot, `${basePath}.json`),
    markdown_path: relativeToWorkspace(workspaceRoot, `${basePath}.md`),
  };
}

export function getWorkflowStatus(workspaceRootInput?: string): Record<string, unknown> {
  const workspaceRoot = resolveWorkspaceRoot(workspaceRootInput);
  const root = workflowRoot(workspaceRoot);
  const state = readRootState(workspaceRoot);
  return {
    workspace_root: workspaceRoot,
    workflow_root: root,
    state,
    latest_plans: listRunDirs(path.join(root, 'plans')).map((entry) => relativeToWorkspace(workspaceRoot, entry)),
    latest_audits: listRunDirs(path.join(root, 'audits')).map((entry) => relativeToWorkspace(workspaceRoot, entry)),
  };
}

function updateRunState(workspaceRootInput: string | undefined, kind: 'plans' | 'audits', run: string | undefined, operations: RunOperation[]): Record<string, unknown> {
  const workspaceRoot = resolveWorkspaceRoot(workspaceRootInput);
  const runDir = resolveRunDir(workspaceRoot, kind, run);
  const statePath = path.join(runDir, 'state.json');
  const current = readRunJson(statePath);
  let next = { ...current };

  for (const operation of operations) {
    next = applyOperation(next, operation);
  }

  next.updated_at = new Date().toISOString();
  writeJsonFile(statePath, next);
  syncManifestFromState(runDir, kind, next);
  return {
    workspace_root: workspaceRoot,
    run: relativeToWorkflow(workspaceRoot, runDir),
    state: next,
  };
}

function completeRun(workspaceRootInput: string | undefined, kind: 'plans' | 'audits', run: string | undefined): Record<string, unknown> {
  const workspaceRoot = resolveWorkspaceRoot(workspaceRootInput);
  const runDir = resolveRunDir(workspaceRoot, kind, run);
  const statePath = path.join(runDir, 'state.json');
  const current = readRunJson(statePath);
  const now = new Date().toISOString();
  const nextState = {
    ...current,
    phase: 'complete',
    updated_at: now,
  };

  writeJsonFile(statePath, nextState);
  syncManifestFromState(runDir, kind, nextState);

  const runId = relativeToWorkflow(workspaceRoot, runDir);
  const rootState = readRootState(workspaceRoot);
  const activeKey = kind === 'plans' ? 'active_plan' : 'active_audit';
  const rootPatch = kind === 'plans' ? { active_plan: null } : { active_audit: null };
  const nextRootState = rootState[activeKey] === runId ? updateRootState(workspaceRoot, rootPatch) : rootState;
  const manifest = readRunJson(path.join(runDir, 'manifest.json'));

  return runResult(workspaceRoot, runDir, manifest, nextState, nextRootState);
}

function writeRunArtifact(kind: 'plans' | 'audits', input: ArtifactWriteInput, exact: string[], prefixes: string[]): Record<string, unknown> {
  const workspaceRoot = resolveWorkspaceRoot(input.workspace_root);
  const runDir = resolveRunDir(workspaceRoot, kind, input.run);
  const relativePath = normalizeArtifactPath(input.path);
  if (!exact.includes(relativePath) && !prefixes.some((prefix) => relativePath.startsWith(prefix))) {
    throw new Error(`Artifact path is not allowed for ${kind}: ${input.path}`);
  }
  const target = resolveSafeRelative(runDir, relativePath);
  const content = artifactContent(input);
  writeText(target, content);
  if (relativePath === 'state.json') {
    syncManifestFromState(runDir, kind, readRunJson(target));
  }
  if (relativePath !== 'manifest.json') {
    touchManifest(runDir);
  }
  return {
    workspace_root: workspaceRoot,
    run: relativeToWorkflow(workspaceRoot, runDir),
    path: relativeToWorkspace(workspaceRoot, target),
    bytes: Buffer.byteLength(content),
  };
}

function resolveRunDir(workspaceRoot: string, kind: 'plans' | 'audits', run?: string): string {
  const root = workflowRoot(workspaceRoot);
  const state = readRootState(workspaceRoot);
  const active = kind === 'plans' ? state.active_plan : state.active_audit;
  const value = run || active;
  if (!value) {
    throw new Error(`No active ${kind.slice(0, -1)} run. Pass run explicitly or create one first.`);
  }
  if (value.startsWith(`${kind}/`)) {
    return resolveSafeRelative(root, value);
  }
  return resolveSafeRelative(path.join(root, kind), value);
}

function touchManifest(runDir: string): void {
  const manifestPath = path.join(runDir, 'manifest.json');
  const manifest = readRunJson(manifestPath);
  manifest.updated_at = new Date().toISOString();
  writeJsonFile(manifestPath, manifest);
}

function syncManifestFromState(runDir: string, kind: 'plans' | 'audits', state: Record<string, unknown>): void {
  const manifestPath = path.join(runDir, 'manifest.json');
  const manifest = readRunJson(manifestPath);
  const next: Record<string, unknown> = {
    ...manifest,
    updated_at: new Date().toISOString(),
  };
  if (typeof state.phase === 'string') {
    next.phase = state.phase;
  }
  if (kind === 'plans' && typeof state.complexity === 'string') {
    next.complexity = state.complexity;
  }
  if (kind === 'audits') {
    if (typeof state.depth === 'string') {
      next.depth = state.depth;
    }
    if (typeof state.target === 'string') {
      next.target = state.target;
    }
  }
  writeJsonFile(manifestPath, next);
}

function artifactContent(input: ArtifactWriteInput): string {
  const hasContent = input.content !== undefined;
  const hasJson = input.json !== undefined;
  if (hasContent === hasJson) {
    throw new Error('Artifact write requires exactly one of content or json');
  }
  return hasJson ? `${JSON.stringify(input.json, null, 2)}\n` : input.content as string;
}

function readRunJson(filePath: string): Record<string, unknown> {
  const value = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!isRecord(value)) {
    throw new Error(`Expected object JSON at ${filePath}`);
  }
  return value;
}

function writeText(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

function normalizeArtifactPath(value: string): string {
  return path.normalize(value).split(path.sep).join('/');
}

function normalizeRunSlug(value: string): string {
  const slug = value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(slug)) {
    throw new Error(`Invalid workflow run slug: ${value}`);
  }
  return slug;
}

function assertNewRun(runDir: string): void {
  if (existsSync(runDir)) {
    throw new Error(`Workflow run already exists: ${runDir}`);
  }
}

function runResult(workspaceRoot: string, runDir: string, manifest: unknown, state: unknown, rootState: unknown): Record<string, unknown> {
  return {
    workspace_root: workspaceRoot,
    run: relativeToWorkflow(workspaceRoot, runDir),
    path: relativeToWorkspace(workspaceRoot, runDir),
    manifest,
    state,
    root_state: rootState,
  };
}

function relativeToWorkflow(workspaceRoot: string, runDir: string): string {
  return path.relative(workflowRoot(workspaceRoot), runDir).split(path.sep).join('/');
}

function planPaths(slug: string): Record<string, string> {
  return {
    plan: `plans/${slug}/plan.md`,
    manifest: `plans/${slug}/manifest.json`,
    state: `plans/${slug}/state.json`,
    context: `plans/${slug}/context.md`,
    questions: `plans/${slug}/questions.md`,
    decisions: `plans/${slug}/decisions.md`,
    ui_contract: `plans/${slug}/ui-contract.md`,
    artifacts: `plans/${slug}/artifacts`,
    chunks: `plans/${slug}/chunks`,
    handoffs: `plans/${slug}/handoffs`,
  };
}

function auditPaths(slug: string): Record<string, string> {
  return {
    audit: `audits/${slug}/audit.md`,
    manifest: `audits/${slug}/manifest.json`,
    state: `audits/${slug}/state.json`,
    scope: `audits/${slug}/scope.md`,
    prompts: `audits/${slug}/prompts`,
    reviews: `audits/${slug}/reviews`,
    sanity: `audits/${slug}/sanity`,
    findings: `audits/${slug}/findings.json`,
    master_audit: `audits/${slug}/master-audit.md`,
    planning_input: `audits/${slug}/planning-input.md`,
    handoffs: `audits/${slug}/handoffs`,
  };
}

function renderHandoffMarkdown(handoff: Record<string, unknown>): string {
  return [
    `# Handoff: ${handoff.from_module} -> ${handoff.to_module}`,
    '',
    `Status: ${handoff.status}`,
    '',
    '## Summary',
    '',
    String(handoff.summary),
    '',
    renderList('Artifacts', asStringArray(handoff.artifacts)),
    renderList('Decisions', asStringArray(handoff.decisions)),
    renderList('Open Questions', asStringArray(handoff.open_questions)),
    renderList('Risks', asStringArray(handoff.risks)),
    renderList('Next Actions', asStringArray(handoff.next_actions)),
  ].filter((section) => section !== '').join('\n');
}

function renderList(title: string, items: string[]): string {
  if (items.length === 0) {
    return '';
  }
  return [`## ${title}`, '', ...items.map((item) => `- ${item}`), ''].join('\n');
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function normalizeHandoffId(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!normalized) {
    throw new Error('handoff id must contain at least one alphanumeric character');
  }
  return normalized.slice(0, 96);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
