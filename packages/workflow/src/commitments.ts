import path from 'node:path';
import { readJsonFile, resolveSafeRelative, writeJsonFile } from './fs-utils.js';
import { readRootState } from './workflow-state.js';
import { resolveWorkspaceRoot, workflowRoot } from './workspace.js';

export type ChangeClass = 'L0' | 'L1' | 'L2' | 'L3';
export type CommitmentKind = 'plan' | 'architecture' | 'implementation_handoff';
export type CommitmentDecision = 'KEEP' | 'SHRINK' | 'ASK' | 'REPLAN';

export interface CommitmentProposalInput {
  workspace_root?: string;
  plan_run?: string;
  kind: CommitmentKind;
  original_request: string;
  candidate_summary: string;
  expected_change_class: ChangeClass;
  candidate_change_class: ChangeClass;
  expected_surfaces?: string[];
  candidate_surfaces?: string[];
  must_preserve?: string[];
  non_goals?: string[];
  new_abstractions?: string[];
  new_contracts?: string[];
  simpler_alternative?: string;
}

export interface CommitmentConfirmationInput {
  workspace_root?: string;
  plan_run?: string;
  decision: CommitmentDecision;
  rationale: string;
  revised_summary?: string;
  removed_scope?: string[];
  justifications?: string[];
  user_question?: string;
}

const CHANGE_CLASS_RANK: Record<ChangeClass, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };

export function initialCommitmentReflection(complexity: string, now: string): Record<string, unknown> {
  const required = complexity !== 'simple';
  return {
    protocol_version: 1,
    required,
    status: required ? 'pending' : 'not_required',
    proposal: null,
    review: null,
    updated_at: now,
  };
}

export function proposePlanCommitment(input: CommitmentProposalInput): Record<string, unknown> {
  const { workspaceRoot, runDir, run } = resolvePlan(input.workspace_root, input.plan_run);
  const statePath = path.join(runDir, 'state.json');
  const state = readPlanState(statePath);
  const now = new Date().toISOString();
  const findings = proposalFindings(input);
  const proposal = {
    id: `commitment-${Date.now()}`,
    kind: input.kind,
    original_request: input.original_request,
    candidate_summary: input.candidate_summary,
    expected_change_class: input.expected_change_class,
    candidate_change_class: input.candidate_change_class,
    expected_surfaces: input.expected_surfaces || [],
    candidate_surfaces: input.candidate_surfaces || [],
    must_preserve: input.must_preserve || [],
    non_goals: input.non_goals || [],
    new_abstractions: input.new_abstractions || [],
    new_contracts: input.new_contracts || [],
    simpler_alternative: input.simpler_alternative || null,
    findings,
    proposed_at: now,
  };
  const reflection = {
    protocol_version: 1,
    required: true,
    status: 'pending',
    proposal,
    review: null,
    updated_at: now,
  };
  const nextState = { ...state, commitment_reflection: reflection, updated_at: now };
  writeJsonFile(statePath, nextState);

  return {
    workspace_root: workspaceRoot,
    run,
    commitment_reflection: reflection,
    reflection_prompt: renderReflectionPrompt(proposal),
  };
}

export function confirmPlanCommitment(input: CommitmentConfirmationInput): Record<string, unknown> {
  const { workspaceRoot, runDir, run } = resolvePlan(input.workspace_root, input.plan_run);
  const statePath = path.join(runDir, 'state.json');
  const state = readPlanState(statePath);
  const reflection = asRecord(state.commitment_reflection);
  if (!reflection || reflection.status !== 'pending') {
    throw new Error('No pending commitment proposal. Call workflow_plan_commitment_propose first.');
  }
  const proposal = asRecord(reflection.proposal);
  if (!proposal) {
    throw new Error('No pending commitment proposal. Call workflow_plan_commitment_propose first.');
  }

  validateConfirmation(input, proposal);
  const now = new Date().toISOString();
  const status = input.decision === 'ASK' ? 'awaiting_user' : input.decision === 'REPLAN' ? 'replan_required' : 'reviewed';
  const review = {
    decision: input.decision,
    rationale: input.rationale,
    revised_summary: input.revised_summary || null,
    removed_scope: input.removed_scope || [],
    justifications: input.justifications || [],
    user_question: input.user_question || null,
    reviewed_at: now,
  };
  const nextReflection = { ...reflection, status, review, updated_at: now };
  const nextState = { ...state, commitment_reflection: nextReflection, updated_at: now };
  writeJsonFile(statePath, nextState);

  return {
    workspace_root: workspaceRoot,
    run,
    commitment_reflection: nextReflection,
    next_action: nextAction(status),
  };
}

export function assertPlanCommitmentReady(state: Record<string, unknown>): void {
  const reflection = asRecord(state.commitment_reflection);
  if (!reflection || reflection.required !== true) return;
  if (reflection.status !== 'reviewed') {
    throw new Error(`Plan commitment reflection is ${String(reflection.status || 'pending')}. Complete the bounded reflection before execution or completion.`);
  }
}

function proposalFindings(input: CommitmentProposalInput): Array<Record<string, unknown>> {
  const findings: Array<Record<string, unknown>> = [];
  if (CHANGE_CLASS_RANK[input.candidate_change_class] > CHANGE_CLASS_RANK[input.expected_change_class]) {
    findings.push({ code: 'CHANGE_CLASS_ESCALATION', detail: `${input.expected_change_class} -> ${input.candidate_change_class}` });
  }
  const outside = (input.candidate_surfaces || []).filter((candidate) => !isExpectedSurface(candidate, input.expected_surfaces || []));
  if (outside.length > 0) findings.push({ code: 'OUTSIDE_EXPECTED_SURFACE', detail: outside });
  if ((input.new_abstractions || []).length > 0) findings.push({ code: 'NEW_ABSTRACTION', detail: input.new_abstractions });
  if ((input.new_contracts || []).length > 0) findings.push({ code: 'NEW_CONTRACT', detail: input.new_contracts });
  if (CHANGE_CLASS_RANK[input.candidate_change_class] >= CHANGE_CLASS_RANK.L2 && !input.simpler_alternative?.trim()) {
    findings.push({ code: 'SIMPLER_ALTERNATIVE_MISSING', detail: 'Name the smallest viable alternative before keeping an L2/L3 solution.' });
  }
  return findings;
}

function isExpectedSurface(candidate: string, expected: string[]): boolean {
  if (expected.length === 0) return true;
  return expected.some((surface) => candidate === surface || candidate.startsWith(`${surface}/`));
}

function renderReflectionPrompt(proposal: Record<string, unknown>): string {
  const findings = Array.isArray(proposal.findings) ? proposal.findings : [];
  return [
    'Review this commitment as if another agent proposed it. Your job is to remove unsupported scope, not improve or expand the design.',
    'Compare only the original request, expected change envelope, must-preserve constraints, non-goals, and candidate.',
    'For every candidate part ask: is it required now, does an existing primitive already solve it, did it raise the change class, and can it be deleted?',
    'Do not launch agents, re-run repository discovery, add future-proofing, or propose adjacent refactors.',
    `Detected pressure points: ${findings.length > 0 ? JSON.stringify(findings) : 'none'}.`,
    'Choose exactly one decision: KEEP, SHRINK, ASK, or REPLAN, then call workflow_plan_commitment_confirm.',
  ].join('\n');
}

function validateConfirmation(input: CommitmentConfirmationInput, proposal: Record<string, unknown>): void {
  if (!input.rationale.trim()) throw new Error('Commitment confirmation requires a rationale.');
  if ((input.decision === 'SHRINK' || input.decision === 'REPLAN') && !input.revised_summary?.trim()) {
    throw new Error(`${input.decision} requires revised_summary.`);
  }
  if (input.decision === 'ASK' && !input.user_question?.trim()) {
    throw new Error('ASK requires user_question.');
  }
  const findings = Array.isArray(proposal.findings) ? proposal.findings : [];
  const needsJustification = findings.some((finding) => {
    const code = asRecord(finding)?.code;
    return code === 'CHANGE_CLASS_ESCALATION' || code === 'NEW_ABSTRACTION' || code === 'NEW_CONTRACT';
  });
  if (input.decision === 'KEEP' && needsJustification && (input.justifications || []).length === 0) {
    throw new Error('KEEP requires explicit justifications for change-class escalation, new abstractions, or new contracts.');
  }
}

function nextAction(status: string): string {
  if (status === 'awaiting_user') return 'Ask the recorded material question and stop without executing.';
  if (status === 'replan_required') return 'Replace the candidate, then propose and review the revised commitment again.';
  return 'Update the plan to match the reviewed commitment before execution.';
}

function resolvePlan(workspaceRootInput?: string, runInput?: string) {
  const workspaceRoot = resolveWorkspaceRoot(workspaceRootInput);
  const root = workflowRoot(workspaceRoot);
  const active = readRootState(workspaceRoot).active_plan;
  const value = runInput || active;
  if (!value) throw new Error('No active plan run. Pass plan_run or create a plan first.');
  const run = value.startsWith('plans/') ? value : `plans/${value}`;
  return { workspaceRoot, run, runDir: resolveSafeRelative(root, run) };
}

function readPlanState(statePath: string): Record<string, unknown> {
  const value = readJsonFile<unknown>(statePath, null);
  const state = asRecord(value);
  if (!state) throw new Error(`Expected plan state at ${statePath}`);
  return state;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
