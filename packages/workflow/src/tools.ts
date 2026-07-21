import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { normalizeFindings } from './findings.js';
import { confirmPlanCommitment, proposePlanCommitment } from './commitments.js';
import {
  completeAuditRun,
  completePlanRun,
  createAuditRun,
  createPlanRun,
  getWorkflowStatus,
  updateAuditRun,
  updatePlanRun,
  writeWorkflowHandoff,
  writeAuditArtifact,
  writePlanArtifact,
} from './runs.js';

const workspaceRoot = z.string().min(1).optional();
const operation = z.object({ type: z.string().min(1) }).catchall(z.unknown());
const changeClass = z.enum(['L0', 'L1', 'L2', 'L3']);
const stateOperationHint = [
  'Supported operations include set_phase, set_open_findings, upsert_task, complete_task, set_active_chunk,',
  'clear_active_chunk, upsert_chunk, set_chunk_status, complete_chunk, cancel_chunk, wait_chunk,',
  'upsert_reviewer, upsert_sanity_check, and merge, depending on plan or audit state.',
  'Unsupported operation errors include the nearest supported operation; correct the payload and retry the MCP call.',
].join(' ');

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

export function registerWorkflowTools(server: McpServer): void {
  server.registerTool(
    'workflow_status',
    {
      title: 'Workflow Status',
      description: 'Read active workflow plan/audit state and latest filesystem-backed workflow runs.',
      inputSchema: {
        workspace_root: workspaceRoot,
      },
    },
    async ({ workspace_root }) => asTextResult(getWorkflowStatus(workspace_root))
  );

  server.registerTool(
    'workflow_plan_create',
    {
      title: 'Create Workflow Plan',
      description: 'Create a durable .workflow plan run with manifest, state, markdown files, artifacts, and chunks directory.',
      inputSchema: {
        workspace_root: workspaceRoot,
        title: z.string().min(1),
        slug: z.string().min(1).optional(),
        complexity: z.enum(['simple', 'medium', 'complex', 'very_complex']),
        plan_markdown: z.string().optional(),
        context_markdown: z.string().optional(),
        questions_markdown: z.string().optional(),
        decisions_markdown: z.string().optional(),
        tasks: z.array(z.record(z.string(), z.unknown())).optional(),
        chunks: z.array(z.record(z.string(), z.unknown())).optional(),
      },
    },
    async (input) => asTextResult(createPlanRun(input))
  );

  server.registerTool(
    'workflow_plan_update',
    {
      title: 'Update Workflow Plan',
      description: `Apply structured state operations to the active or named workflow plan run. ${stateOperationHint}`,
      inputSchema: {
        workspace_root: workspaceRoot,
        plan_run: z.string().min(1).optional(),
        operations: z.array(operation).min(1),
      },
    },
    async ({ workspace_root, plan_run, operations }) => asTextResult(updatePlanRun(workspace_root, plan_run, operations))
  );

  server.registerTool(
    'workflow_plan_commitment_propose',
    {
      title: 'Propose Plan Commitment',
      description: 'Record a material plan or handoff candidate and return one bounded shrink-first same-model reflection prompt. This portable tool never launches an agent or requires a lifecycle hook.',
      inputSchema: {
        workspace_root: workspaceRoot,
        plan_run: z.string().min(1).optional(),
        kind: z.enum(['plan', 'architecture', 'implementation_handoff']),
        original_request: z.string().min(1),
        candidate_summary: z.string().min(1),
        expected_change_class: changeClass,
        candidate_change_class: changeClass,
        expected_surfaces: z.array(z.string()).optional(),
        candidate_surfaces: z.array(z.string()).optional(),
        must_preserve: z.array(z.string()).optional(),
        non_goals: z.array(z.string()).optional(),
        new_abstractions: z.array(z.string()).optional(),
        new_contracts: z.array(z.string()).optional(),
        simpler_alternative: z.string().optional(),
      },
    },
    async (input) => asTextResult(proposePlanCommitment(input))
  );

  server.registerTool(
    'workflow_plan_commitment_confirm',
    {
      title: 'Confirm Plan Commitment',
      description: 'Record the result of the bounded same-model reflection. KEEP preserves the candidate, SHRINK narrows it, ASK pauses for one material user decision, and REPLAN requires another proposal.',
      inputSchema: {
        workspace_root: workspaceRoot,
        plan_run: z.string().min(1).optional(),
        decision: z.enum(['KEEP', 'SHRINK', 'ASK', 'REPLAN']),
        rationale: z.string().min(1),
        revised_summary: z.string().optional(),
        removed_scope: z.array(z.string()).optional(),
        justifications: z.array(z.string()).optional(),
        user_question: z.string().optional(),
      },
    },
    async (input) => asTextResult(confirmPlanCommitment(input))
  );

  server.registerTool(
    'workflow_plan_complete',
    {
      title: 'Complete Workflow Plan',
      description: 'Mark the active or named workflow plan run complete and clear active_plan when it points to that run.',
      inputSchema: {
        workspace_root: workspaceRoot,
        plan_run: z.string().min(1).optional(),
      },
    },
    async ({ workspace_root, plan_run }) => asTextResult(completePlanRun(workspace_root, plan_run))
  );

  server.registerTool(
    'workflow_plan_artifact_write',
    {
      title: 'Write Plan Artifact',
      description: 'Write allowed files inside the active or named workflow plan run without allowing path escape.',
      inputSchema: {
        workspace_root: workspaceRoot,
        plan_run: z.string().min(1).optional(),
        path: z.string().min(1),
        content: z.string().optional(),
        json: z.unknown().optional(),
      },
    },
    async ({ workspace_root, plan_run, path, content, json }) => asTextResult(writePlanArtifact({ workspace_root, run: plan_run, path, content, json }))
  );

  server.registerTool(
    'workflow_audit_create',
    {
      title: 'Create Workflow Audit',
      description: 'Create a durable .workflow audit run with prompts, reviews, sanity, findings, and master audit files.',
      inputSchema: {
        workspace_root: workspaceRoot,
        title: z.string().min(1),
        slug: z.string().min(1).optional(),
        depth: z.enum(['simple', 'standard', 'deep', 'exhaustive']),
        target: z.enum(['project', 'subsystem', 'diff', 'plan']),
        audit_markdown: z.string().optional(),
        scope_markdown: z.string().optional(),
        planning_input_markdown: z.string().optional(),
        findings: z.unknown().optional(),
      },
    },
    async (input) => asTextResult(createAuditRun(input))
  );

  server.registerTool(
    'workflow_audit_update',
    {
      title: 'Update Workflow Audit',
      description: `Apply structured state operations to the active or named workflow audit run. ${stateOperationHint}`,
      inputSchema: {
        workspace_root: workspaceRoot,
        audit_run: z.string().min(1).optional(),
        operations: z.array(operation).min(1),
      },
    },
    async ({ workspace_root, audit_run, operations }) => asTextResult(updateAuditRun(workspace_root, audit_run, operations))
  );

  server.registerTool(
    'workflow_audit_complete',
    {
      title: 'Complete Workflow Audit',
      description: 'Mark the active or named workflow audit run complete and clear active_audit when it points to that run.',
      inputSchema: {
        workspace_root: workspaceRoot,
        audit_run: z.string().min(1).optional(),
      },
    },
    async ({ workspace_root, audit_run }) => asTextResult(completeAuditRun(workspace_root, audit_run))
  );

  server.registerTool(
    'workflow_audit_artifact_write',
    {
      title: 'Write Audit Artifact',
      description: 'Write allowed files inside the active or named workflow audit run without allowing path escape.',
      inputSchema: {
        workspace_root: workspaceRoot,
        audit_run: z.string().min(1).optional(),
        path: z.string().min(1),
        content: z.string().optional(),
        json: z.unknown().optional(),
      },
    },
    async ({ workspace_root, audit_run, path, content, json }) => asTextResult(writeAuditArtifact({ workspace_root, run: audit_run, path, content, json }))
  );

  server.registerTool(
    'workflow_handoff_write',
    {
      title: 'Write Workflow Handoff',
      description: 'Write a structured module handoff into the active or named plan/audit run and update state.json.',
      inputSchema: {
        workspace_root: workspaceRoot,
        kind: z.enum(['plan', 'audit']),
        run: z.string().min(1).optional(),
        id: z.string().min(1).optional(),
        from_module: z.string().min(1),
        to_module: z.string().min(1),
        status: z.enum(['ready', 'partial', 'blocked', 'complete']).optional(),
        summary: z.string().min(1),
        artifacts: z.array(z.string()).optional(),
        decisions: z.array(z.string()).optional(),
        open_questions: z.array(z.string()).optional(),
        risks: z.array(z.string()).optional(),
        next_actions: z.array(z.string()).optional(),
        payload: z.unknown().optional(),
      },
    },
    async (input) => asTextResult(writeWorkflowHandoff(input))
  );

  server.registerTool(
    'workflow_findings_normalize',
    {
      title: 'Normalize Findings',
      description: 'Normalize review or audit findings into severity-sorted workflow findings with stable IDs and evidence arrays.',
      inputSchema: {
        findings: z.unknown().optional(),
        payload: z.unknown().optional(),
      },
    },
    async ({ findings, payload }) => asTextResult(normalizeFindings(findings ?? payload ?? []))
  );
}
