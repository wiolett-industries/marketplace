import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { normalizeFindings } from './findings.js';
import { completeReviewRun, createReviewRun, draftReviewNote, getReviewStatus, updateReviewRun, writeReviewArtifact } from './runs.js';

const workspaceRoot = z.string().min(1).optional();
const reviewOperationType = z.enum([
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
]);
const operation = z.object({ type: reviewOperationType }).catchall(z.unknown());

function asTextResult(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload),
      },
    ],
  };
}

export function registerMergeRequestReviewTools(server: McpServer): void {
  server.registerTool(
    'mr_review_status',
    {
      title: 'MR Review Status',
      description: 'Read active merge request review state and latest filesystem-backed review runs.',
      inputSchema: {
        workspace_root: workspaceRoot,
      },
    },
    async ({ workspace_root }) => asTextResult(getReviewStatus(workspace_root))
  );

  server.registerTool(
    'mr_review_create',
    {
      title: 'Create MR Review Run',
      description: 'Create a durable .workflow/mr-reviews run with manifest, state, discussions, notes, and review artifacts.',
      inputSchema: {
        workspace_root: workspaceRoot,
        title: z.string().min(1),
        slug: z.string().min(1).optional(),
        project: z.string().optional(),
        iid: z.union([z.string(), z.number()]).optional(),
        url: z.string().optional(),
        source_branch: z.string().optional(),
        target_branch: z.string().optional(),
        commit_sha: z.string().optional(),
        review_mode: z.enum(['normal', 'high-risk']),
        task_context: z.string().optional(),
        ci_status: z.string().optional(),
      },
    },
    async (input) => asTextResult(createReviewRun(input))
  );

  server.registerTool(
    'mr_review_update',
    {
      title: 'Update MR Review Run',
      description: 'Apply structured state operations to the active or named merge request review run. mark_approved is a compatibility terminal operation that also clears the matching active_review pointer; prefer mr_review_complete for the final latch.',
      inputSchema: {
        workspace_root: workspaceRoot,
        review_run: z.string().min(1).optional(),
        operations: z.array(operation).min(1),
      },
    },
    async ({ workspace_root, review_run, operations }) => asTextResult(updateReviewRun(workspace_root, review_run, operations))
  );

  server.registerTool(
    'mr_review_complete',
    {
      title: 'Complete MR Review Run',
      description: 'After the clean note is posted and the GitLab MR is approved, mark the active or named review approved and clear active_review when it points to that run. This is the mandatory terminal latch for a realized clean review.',
      inputSchema: {
        workspace_root: workspaceRoot,
        review_run: z.string().min(1).optional(),
      },
    },
    async ({ workspace_root, review_run }) => asTextResult(completeReviewRun(workspace_root, review_run))
  );

  server.registerTool(
    'mr_review_artifact_write',
    {
      title: 'Write MR Review Artifact',
      description: 'Write allowed files inside the active or named merge request review run without allowing path escape.',
      inputSchema: {
        workspace_root: workspaceRoot,
        review_run: z.string().min(1).optional(),
        path: z.string().min(1),
        content: z.string().optional(),
        json: z.unknown().optional(),
      },
    },
    async ({ workspace_root, review_run, path, content, json }) => asTextResult(writeReviewArtifact({ workspace_root, review_run, path, content, json }))
  );

  server.registerTool(
    'mr_review_findings_normalize',
    {
      title: 'Normalize MR Review Findings',
      description: 'Normalize MR review findings into severity-sorted Critical/Important/Minor/Notes findings.',
      inputSchema: {
        findings: z.unknown().optional(),
        payload: z.unknown().optional(),
      },
    },
    async ({ findings, payload }) => asTextResult(normalizeFindings(findings ?? payload ?? []))
  );

  server.registerTool(
    'mr_review_note_draft',
    {
      title: 'Draft MR Review Note',
      description: 'Render a fixed-format MR review finding note without posting it.',
      inputSchema: {
        severity: z.enum(['Critical', 'Important', 'Minor', 'Notes']),
        problem: z.string().min(1),
        why_it_matters: z.string().min(1),
        expected_fix: z.string().min(1),
        evidence_basis: z.string().min(1),
      },
    },
    async (input) => asTextResult(draftReviewNote(input))
  );
}
