---
name: writing-plans
description: Use when an authorized, sufficiently clear change needs a durable decision-complete plan under .workflow because execution is multi-step, risky, resumable, or explicitly requested. Do not create a plan for fast local work or read-only discussion.
---

# Writing Plans

Create a durable plan only when it materially improves execution or recovery. Plans are source-of-truth artifacts, not mandatory ceremony.

## Plan Threshold

Use this module when at least one is true:

- the user explicitly requests a durable implementation plan;
- execution has several dependent steps or independent subsystems;
- risk, migration, coordination, or compaction recovery requires locked decisions;
- another agent must execute without product or architecture guesswork.

Fast localized work and chat-only planning skip `.workflow/`. An explicit no-edits/read-only boundary blocks plan artifacts unless the user separately authorizes a durable plan.

## Create Or Resume

Use `workflow_plan_create`, `workflow_plan_update`, `workflow_plan_artifact_write`, and `workflow_handoff_write` when available. Manual `.workflow/` writes are fallback only. Resume an unfinished matching run; do not reopen completed work by default.

Read [references/plan-schema.md](references/plan-schema.md) when creating a run, defining chunks/tasks, or writing a plan handoff. Do not load it for a chat-only plan.

## Plan Contract

The plan must lock decisions that execution cannot safely infer:

- exact goal, success criteria, scope, and non-goals;
- expected change class (`L0`-`L3`), expected surfaces, must-preserve constraints, and the smallest behavior-complete approach;
- repository facts, constraints, and accepted decisions;
- implementation approach and dependency order;
- tasks with allowed scope, ownership, and expected files/artifacts;
- verification commands and acceptance checks;
- UI contract reference when substantial production UI is in scope;
- assurance profile, one task-wide agent budget, and finalization requirements.

For delegated work, record semantic `work_class`, `agent_role`, and `delegation_reason`; exact models and reasoning effort belong only in canonical agent TOMLs. A mechanical or structured worker receives the chosen approach, exact scope, non-goals, and checks instead of rediscovering architecture.

Never use `TBD`, `TODO`, vague placeholders, fake staging, silent scope shrink, or unwired "basic version" language unless explicitly accepted.

New APIs, schemas, protocols, shared abstractions, or platform layers must either fit the approved envelope or name the simpler alternative and why it is insufficient now. Do not justify them with hypothetical future use alone.

## Chunk Only When Useful

Chunk when a single pass would be unreliable: complex/very-complex work, more than seven meaningful tasks, independent subsystems, disjoint agent ownership, or difficult recovery. Keep one chunk level. Root owns shared decisions, dependencies, integration, and finalization; chunks own bounded disjoint scopes and local checks.

For medium and larger work, separate analysis/decision tasks from small implementation tasks. Do not split by file count or create chunks whose coordination costs exceed their execution.

## Plan Review

- For every material plan, call `workflow_plan_commitment_propose`, perform the returned same-model shrink-first reflection from existing context, then call `workflow_plan_commitment_confirm` with `KEEP`, `SHRINK`, `ASK`, or `REPLAN` before execution. This is a local second look, not an agent review or another discovery pass.
- After `SHRINK`, rewrite the durable plan and affected tasks to match the confirmed narrower commitment before handoff or execution. Confirmation alone does not modify plan text.
- `standard`: local self-check; no plan reviewer unless a specific ambiguity or integration risk would materially benefit from independence.
- `assurance`: use at most one plan reviewer for the dominant unresolved risk. Add a second only for a distinct high-impact risk and within the existing task-wide budget.

Fix only blocking plan gaps. `LOW` polish never delays execution readiness.

Hooks may transparently enforce this checkpoint on a platform that supports it. Never invoke, wait for, search for, or depend on a hook. When the commitment MCP tools are unavailable, perform the same local envelope/class/simpler-alternative check in the plan and continue; hook absence is never a blocker. These semantics must remain valid in both Codex and Claude Code.

Stop when another capable agent can execute the plan without new product or architecture decisions. Record readiness and hand off to `executing-plans`; do not start a separate review budget.
