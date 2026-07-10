import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createReviewRun, draftReviewNote, getReviewStatus, updateReviewRun, writeReviewArtifact } from '../dist/runs.js';
import { normalizeFindings } from '../dist/findings.js';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const reviewSkill = path.join(repoRoot, 'plugins/merge-request-review/skills/review-merge-request/SKILL.md');
const reviewProtocol = path.join(repoRoot, 'plugins/merge-request-review/skills/review-merge-request/references/protocol.md');
const packageReadme = path.join(repoRoot, 'packages/merge-request-review/README.md');
const pluginReadme = path.join(repoRoot, 'plugins/merge-request-review/README.md');

test('creates and updates a merge request review run', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'mr-review-workspace-'));
  const create = createReviewRun({
    workspace_root: workspace,
    title: 'Pearl Diver !123',
    slug: '01-01-26-pearl-diver-123',
    project: 'pearl-diver-game',
    iid: 123,
    review_mode: 'high-risk',
    commit_sha: 'abc123',
  });

  const update = updateReviewRun(workspace, undefined, [
    { type: 'set_phase', phase: 'reviewing' },
    { type: 'set_discussions', discussions: [{ id: 'D1', status: 'resolved' }] },
    { type: 'set_findings', findings: [{ id: 'F1', severity: 'high', problem: 'Missing guard', location: 'src/a.ts:1' }] },
    { type: 'upsert_posted_note', note: { id: 'N1', finding_id: 'F1', status: 'posted' } },
  ]);
  const artifact = writeReviewArtifact({
    workspace_root: workspace,
    path: 'artifacts/review-round-1/primary.md',
    content: 'Reviewed\n',
  });

  const status = getReviewStatus(workspace);
  const state = JSON.parse(readFileSync(path.join(workspace, '.workflow', 'mr-reviews', '01-01-26-pearl-diver-123', 'state.json'), 'utf8'));

  assert.equal(create.run, 'mr-reviews/01-01-26-pearl-diver-123');
  assert.equal(update.state.phase, 'reviewing');
  assert.equal(update.state.findings[0].severity, 'Critical');
  assert.equal(update.state.posted_notes[0].id, 'N1');
  assert.equal(artifact.path, '.workflow/mr-reviews/01-01-26-pearl-diver-123/artifacts/review-round-1/primary.md');
  assert.equal(status.state.active_review, 'mr-reviews/01-01-26-pearl-diver-123');
  assert.equal(state.discussions_loaded, true);
});

test('normalizes findings and drafts fixed-format notes', () => {
  const normalized = normalizeFindings([
    { severity: 'low', problem: 'Minor' },
    { severity: 'important', problem: 'Important' },
  ]);
  const note = draftReviewNote({
    severity: 'Important',
    problem: 'Bug',
    why_it_matters: 'Breaks review',
    expected_fix: 'Patch it',
  });

  assert.deepEqual(normalized.findings.map((finding) => finding.severity), ['Important', 'Minor']);
  assert.match(note.markdown, /Severity: Important/);
  assert.match(note.markdown, /Expected fix:/);
});

test('review skill keeps a lean trigger, public severity contract, and bounded loops', () => {
  const skill = readFileSync(reviewSkill, 'utf8');
  const protocol = readFileSync(reviewProtocol, 'utf8');
  const contract = `${skill}\n${protocol}`;

  assert.match(skill, /^name: review-merge-request$/m);
  assert.match(skill, /Do not trigger for casual MR discussion, draft\/WIP work, GitHub PRs, or local code review/);
  assert.match(skill, /mutually exclusive with Workflow `finalizing-plan`/);
  assert.match(skill, /Use current CI as primary verification/);
  assert.match(skill, /Apply only relevant review gates/);
  assert.match(contract, /Do not expose internal triage labels/);
  assert.match(contract, /Critical.*Important.*Minor.*Notes/s);
  assert.match(skill, /`Minor` does not block unless it materially affects acceptance/);
  assert.match(skill, /`Notes` never block approval/);
  assert.match(skill, /After two failed fix\/re-review cycles, escalate/);
  assert.match(skill, /`normal`: 0 agents by default; at most 1 total/);
  assert.match(skill, /`high-risk`.*at most 2 agents total/s);
  assert.match(skill, /do not restart every support agent/);
  assert.match(skill, /follow `using-agent-memory` for its single durable-memory decision/);
  assert.match(skill, /One clean pass at the current SHA is sufficient/);
});

test('merge request review docs describe MCP tool and artifact contracts', () => {
  const skillContract = `${readFileSync(reviewSkill, 'utf8')}\n${readFileSync(reviewProtocol, 'utf8')}`;
  const docs = [
    skillContract,
    readFileSync(packageReadme, 'utf8'),
    readFileSync(pluginReadme, 'utf8'),
  ];
  const expectedTools = [
    'mr_review_status',
    'mr_review_create',
    'mr_review_update',
    'mr_review_artifact_write',
    'mr_review_findings_normalize',
    'mr_review_note_draft',
  ];

  for (const doc of docs) {
    for (const tool of expectedTools) {
      assert.match(doc, new RegExp(tool));
    }
  }

  const skill = docs[0];
  const expectedUpdateOperations = [
    'set_phase',
    'set_review_mode',
    'set_ci_status',
    'set_discussions',
    'set_findings',
    'set_blockers',
    'set_review_round',
    'set_clean_rounds',
    'upsert_posted_note',
    'mark_approved',
    'merge',
  ];

  for (const operation of expectedUpdateOperations) {
    assert.match(skill, new RegExp(operation));
  }

  assert.doesNotMatch(skill, /posted-notes\.json\n  approval\.md\n/);
  assert.match(skill, /`approval\.md` is an allowed artifact/);
  assert.match(skill, /approved/);
  assert.match(docs[1], /Supported `mr_review_update` operations/);
  assert.match(docs[2], /Supported `mr_review_update` operations/);
  assert.match(docs[1], /owns only the review protocol state/);
});

test('prints help', () => {
  const output = execFileSync(process.execPath, [path.resolve('dist/index.js'), '--help'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
  });
  assert.match(output, /merge-request-review\s+Start MCP stdio server/);
});
