import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeFindings } from './findings.js';
import { readJsonFile, resolveSafeRelative, writeJsonFile, writeTextFile } from './fs-utils.js';
import { dateSlug } from './naming.js';
import { listReviewDirs, resolveWorkspaceRoot, reviewRoot, statePath } from './workspace.js';

export type ReviewMode = 'normal' | 'high-risk';
export type ReviewState = 'intake' | 'blocked' | 'reviewing' | 'findings' | 'clean' | 'approved';

export interface CreateReviewInput {
  workspace_root?: string;
  title: string;
  slug?: string;
  project?: string;
  iid?: string | number;
  url?: string;
  source_branch?: string;
  target_branch?: string;
  commit_sha?: string;
  review_mode: ReviewMode;
  task_context?: string;
  ci_status?: string;
}

export interface ArtifactWriteInput {
  workspace_root?: string;
  review_run?: string;
  path: string;
  content?: string;
  json?: unknown;
}

export interface ReviewOperation {
  type: string;
  [key: string]: unknown;
}

export function createReviewRun(input: CreateReviewInput): Record<string, unknown> {
  const workspaceRoot = resolveWorkspaceRoot(input.workspace_root);
  const slug = normalizeSlug(input.slug || dateSlug(input.title));
  const runDir = resolveSafeRelative(reviewRoot(workspaceRoot), slug);
  const now = new Date().toISOString();
  if (existsSync(runDir)) {
    throw new Error(`MR review run already exists: ${runDir}`);
  }

  for (const dir of ['artifacts', 'artifacts/review-round-1', 'notes-to-post', 'posted-notes']) {
    mkdirSync(path.join(runDir, dir), { recursive: true });
  }

  const manifest = {
    kind: 'merge-request-review',
    version: 1,
    run_id: `mr-reviews/${slug}`,
    slug,
    title: input.title,
    phase: 'intake',
    review_mode: input.review_mode,
    created_at: now,
    updated_at: now,
    workspace_root: workspaceRoot,
    paths: {
      manifest: `mr-reviews/${slug}/manifest.json`,
      state: `mr-reviews/${slug}/state.json`,
      discussions: `mr-reviews/${slug}/discussions.json`,
      diff_summary: `mr-reviews/${slug}/diff-summary.md`,
      notes_to_post: `mr-reviews/${slug}/notes-to-post`,
      posted_notes: `mr-reviews/${slug}/posted-notes.json`,
      artifacts: `mr-reviews/${slug}/artifacts`,
    },
  };
  const state = {
    phase: 'intake',
    review_state: 'intake',
    review_mode: input.review_mode,
    mr: {
      project: input.project || null,
      iid: input.iid ?? null,
      url: input.url || null,
      source_branch: input.source_branch || null,
      target_branch: input.target_branch || null,
      commit_sha: input.commit_sha || null,
    },
    task_context: input.task_context || '',
    ci_status: input.ci_status || 'unknown',
    discussions_loaded: false,
    discussions: [],
    findings: [],
    blockers: [],
    posted_notes: [],
    review_round: 0,
    clean_rounds: 0,
    approved: false,
    updated_at: now,
  };

  writeJsonFile(path.join(runDir, 'manifest.json'), manifest);
  writeJsonFile(path.join(runDir, 'state.json'), state);
  writeJsonFile(path.join(runDir, 'discussions.json'), { discussions: [] });
  writeJsonFile(path.join(runDir, 'posted-notes.json'), { notes: [] });
  writeTextFile(path.join(runDir, 'diff-summary.md'), '# Diff Summary\n');
  writeRootState(workspaceRoot, { active_review: `mr-reviews/${slug}` });

  return runResult(workspaceRoot, runDir, manifest, state);
}

export function updateReviewRun(workspaceRootInput: string | undefined, run: string | undefined, operations: ReviewOperation[]): Record<string, unknown> {
  const workspaceRoot = resolveWorkspaceRoot(workspaceRootInput);
  const runDir = resolveRunDir(workspaceRoot, run);
  const statePath = path.join(runDir, 'state.json');
  let state = readObject(statePath);

  for (const operation of operations) {
    if (operation.type === 'mark_approved') assertReviewCompletionReady(state);
    state = applyOperation(state, operation);
  }
  state.updated_at = new Date().toISOString();
  writeJsonFile(statePath, state);
  syncManifest(runDir, state);
  if (operations.some((operation) => operation.type === 'mark_approved')) {
    clearActiveReview(workspaceRoot, runDir);
  }

  return {
    workspace_root: workspaceRoot,
    run: relativeToReviewRoot(workspaceRoot, runDir),
    state,
  };
}

export function completeReviewRun(workspaceRootInput: string | undefined, run?: string): Record<string, unknown> {
  const workspaceRoot = resolveWorkspaceRoot(workspaceRootInput);
  const runDir = resolveRunDir(workspaceRoot, run);
  const statePath = path.join(runDir, 'state.json');
  const current = readObject(statePath);
  assertReviewCompletionReady(current);
  const state = {
    ...current,
    approved: true,
    phase: 'approved',
    review_state: 'approved',
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(statePath, state);
  syncManifest(runDir, state);
  clearActiveReview(workspaceRoot, runDir);

  return {
    workspace_root: workspaceRoot,
    run: relativeToReviewRoot(workspaceRoot, runDir),
    state,
  };
}

function assertReviewCompletionReady(state: Record<string, unknown>): void {
  const phase = String(state.phase || state.review_state || '');
  if (phase !== 'clean') throw new Error(`MR review must be in clean phase before approval; current phase is ${phase || 'unknown'}.`);
  if (state.discussions_loaded !== true) throw new Error('MR review discussions must be loaded before approval.');
  if (asArray(state.blockers).length > 0) throw new Error('MR review blockers must be empty before approval.');
  const blocking = asArray(state.findings).filter((finding) => {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) return false;
    const record = finding as Record<string, unknown>;
    const severity = String(record.severity || '');
    const status = String(record.status || 'open').toLowerCase();
    return (severity === 'Critical' || severity === 'Important')
      && !['resolved', 'fixed', 'closed', 'dismissed'].includes(status);
  });
  if (blocking.length > 0) throw new Error('MR review has unresolved Critical or Important findings.');
  if (typeof state.clean_rounds === 'number' && state.clean_rounds < 1) {
    throw new Error('MR review requires one recorded clean round before approval.');
  }
}

export function writeReviewArtifact(input: ArtifactWriteInput): Record<string, unknown> {
  const workspaceRoot = resolveWorkspaceRoot(input.workspace_root);
  const runDir = resolveRunDir(workspaceRoot, input.review_run);
  const relativePath = normalizeArtifactPath(input.path);
  if (!isAllowedArtifact(relativePath)) {
    throw new Error(`Artifact path is not allowed for merge request review: ${input.path}`);
  }
  const content = artifactContent(input);
  const target = resolveSafeRelative(runDir, relativePath);
  writeTextFile(target, content);
  touchManifest(runDir);
  return {
    workspace_root: workspaceRoot,
    run: relativeToReviewRoot(workspaceRoot, runDir),
    path: path.relative(workspaceRoot, target).split(path.sep).join('/'),
    bytes: Buffer.byteLength(content),
  };
}

export function draftReviewNote(input: {
  severity: 'Critical' | 'Important' | 'Minor' | 'Notes';
  problem: string;
  why_it_matters: string;
  expected_fix: string;
  evidence_basis: string;
}): { markdown: string } {
  return {
    markdown: [
      `Severity: ${input.severity}`,
      '',
      'Problem:',
      input.problem,
      '',
      'Why it matters:',
      input.why_it_matters,
      '',
      'Expected fix:',
      input.expected_fix,
      '',
      'Evidence basis:',
      input.evidence_basis,
      '',
    ].join('\n'),
  };
}

export function getReviewStatus(workspaceRootInput?: string): Record<string, unknown> {
  const workspaceRoot = resolveWorkspaceRoot(workspaceRootInput);
  const root = reviewRoot(workspaceRoot);
  const rootState = readRootState(workspaceRoot);
  return {
    workspace_root: workspaceRoot,
    review_root: root,
    state: rootState,
    latest_reviews: listReviewDirs(root).map((entry) => relativeToReviewRoot(workspaceRoot, entry)),
  };
}

function applyOperation(state: Record<string, unknown>, operation: ReviewOperation): Record<string, unknown> {
  switch (operation.type) {
    case 'set_phase':
      return { ...state, phase: stringField(operation, 'phase'), review_state: stringField(operation, 'phase') };
    case 'set_review_mode':
      return { ...state, review_mode: stringField(operation, 'review_mode') };
    case 'set_ci_status':
      return { ...state, ci_status: stringField(operation, 'ci_status') };
    case 'set_discussions':
      return { ...state, discussions_loaded: true, discussions: arrayField(operation, 'discussions') };
    case 'set_findings':
      return { ...state, findings: normalizeFindings(operation.findings).findings };
    case 'set_blockers':
      return { ...state, blockers: arrayField(operation, 'blockers') };
    case 'set_review_round':
      return { ...state, review_round: numberField(operation, 'review_round') };
    case 'set_clean_rounds':
      return { ...state, clean_rounds: numberField(operation, 'clean_rounds') };
    case 'upsert_posted_note':
      return { ...state, posted_notes: upsertById(asArray(state.posted_notes), recordField(operation, 'note')) };
    case 'mark_approved':
      return { ...state, approved: true, phase: 'approved', review_state: 'approved' };
    case 'merge':
      return { ...state, ...recordField(operation, 'patch') };
    default:
      throw new Error(`Unsupported MR review operation: ${operation.type}`);
  }
}

function isAllowedArtifact(relativePath: string): boolean {
  const exact = ['manifest.json', 'state.json', 'discussions.json', 'diff-summary.md', 'posted-notes.json', 'approval.md'];
  const prefixes = ['artifacts/', 'notes-to-post/', 'posted-notes/'];
  return exact.includes(relativePath) || prefixes.some((prefix) => relativePath.startsWith(prefix));
}

function artifactContent(input: ArtifactWriteInput): string {
  const hasContent = input.content !== undefined;
  const hasJson = input.json !== undefined;
  if (hasContent === hasJson) {
    throw new Error('Artifact write requires exactly one of content or json');
  }
  return hasJson ? `${JSON.stringify(input.json, null, 2)}\n` : input.content as string;
}

function resolveRunDir(workspaceRoot: string, run?: string): string {
  const rootState = readRootState(workspaceRoot);
  const value = run || (typeof rootState.active_review === 'string' ? rootState.active_review : '');
  if (!value) {
    throw new Error('No active merge request review run. Pass review_run explicitly or create one first.');
  }
  if (value.startsWith('mr-reviews/')) {
    return resolveSafeRelative(reviewRoot(workspaceRoot), value.slice('mr-reviews/'.length));
  }
  return resolveSafeRelative(reviewRoot(workspaceRoot), value);
}

function writeRootState(workspaceRoot: string, patch: Record<string, unknown>): void {
  mkdirSync(reviewRoot(workspaceRoot), { recursive: true });
  writeJsonFile(statePath(workspaceRoot), {
    ...readRootState(workspaceRoot),
    ...patch,
    updated_at: new Date().toISOString(),
  });
}

function clearActiveReview(workspaceRoot: string, runDir: string): void {
  const run = relativeToReviewRoot(workspaceRoot, runDir);
  const rootState = readRootState(workspaceRoot);
  if (rootState.active_review === run) {
    writeRootState(workspaceRoot, { active_review: null });
  }
}

function readRootState(workspaceRoot: string): Record<string, unknown> {
  return readJsonFile(statePath(workspaceRoot), {
    active_review: null,
    updated_at: new Date(0).toISOString(),
  });
}

function syncManifest(runDir: string, state: Record<string, unknown>): void {
  const manifestPath = path.join(runDir, 'manifest.json');
  const manifest = readObject(manifestPath);
  writeJsonFile(manifestPath, {
    ...manifest,
    phase: state.phase,
    review_mode: state.review_mode,
    updated_at: new Date().toISOString(),
  });
}

function touchManifest(runDir: string): void {
  const manifestPath = path.join(runDir, 'manifest.json');
  const manifest = readObject(manifestPath);
  writeJsonFile(manifestPath, {
    ...manifest,
    updated_at: new Date().toISOString(),
  });
}

function runResult(workspaceRoot: string, runDir: string, manifest: unknown, state: unknown): Record<string, unknown> {
  return {
    workspace_root: workspaceRoot,
    run: relativeToReviewRoot(workspaceRoot, runDir),
    path: path.relative(workspaceRoot, runDir).split(path.sep).join('/'),
    manifest,
    state,
  };
}

function relativeToReviewRoot(workspaceRoot: string, runDir: string): string {
  const relative = path.relative(reviewRoot(workspaceRoot), runDir).split(path.sep).join('/');
  return `mr-reviews/${relative}`;
}

function normalizeSlug(value: string): string {
  const slug = value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(slug)) {
    throw new Error(`Invalid MR review slug: ${value}`);
  }
  return slug;
}

function normalizeArtifactPath(value: string): string {
  return path.normalize(value).split(path.sep).join('/');
}

function readObject(filePath: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected object JSON at ${filePath}`);
  }
  return parsed as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function arrayField(value: Record<string, unknown>, key: string): unknown[] {
  const field = value[key];
  if (!Array.isArray(field)) {
    throw new Error(`${key} must be an array`);
  }
  return field;
}

function recordField(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const field = value[key];
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    throw new Error(`${key} must be an object`);
  }
  return field as Record<string, unknown>;
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== 'string' || !field.trim()) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return field;
}

function numberField(value: Record<string, unknown>, key: string): number {
  const field = value[key];
  if (typeof field !== 'number' || !Number.isFinite(field)) {
    throw new Error(`${key} must be a finite number`);
  }
  return field;
}

function upsertById(items: unknown[], item: Record<string, unknown>): unknown[] {
  const id = String(item.id || '').trim();
  if (!id) {
    throw new Error('posted note requires id');
  }
  const index = items.findIndex((entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && (entry as Record<string, unknown>).id === id);
  if (index === -1) {
    return [...items, item];
  }
  const next = [...items];
  next[index] = { ...(next[index] as Record<string, unknown>), ...item };
  return next;
}
