---
name: executing-plans
description: Use to execute an approved active .workflow plan with milestone state updates, scoped task ownership, compaction recovery, selective worktree delegation, and one integration path. Do not use for direct fast-path work without a durable plan.
---

# Executing Plans

Execute the active plan as written. Plan artifacts are authoritative; chat is not. Inherit the primary path, assurance profile, task-wide agent budget, and verification budget from `using-workflow`.

## Start Or Resume

1. Call `workflow_status` once when active state is unknown or context was recovered.
2. Read `manifest.json`, `state.json`, `plan.md`, and the current task's referenced context/decisions.
3. Read `ui-contract.md`, chunk state, or older artifacts only when the current task depends on them.
4. Inspect `git status --short` and preserve unrelated user changes.
5. Continue from the first non-complete task; do not replay completed work.

Use `workflow_plan_update`, `workflow_plan_artifact_write`, and `workflow_plan_complete` when available; manual state/artifact writes are fallback only.

Read [references/execution-state.md](references/execution-state.md) only when updating task/chunk state, delegating a write task, or recovering a complex run.

## Execution Cadence

- Update state at meaningful milestones: task start, material block, review handoff, and task completion.
- Do not write workflow state after every tool call or tiny edit.
- Execute tasks within their allowed scope and record any approved scope change before editing outside it.
- Do not perform opportunistic refactors. A new API/schema/protocol/shared abstraction/layer or a higher change class requires an approved plan update and a renewed commitment reflection before implementation continues.
- For a small user correction, inspect and edit only the touched surface plus directly affected tests; do not restart repository discovery.
- For chunks, root owns dependency order and integration. Never create nested chunks.

## Semantic Work Routing

Exact model and reasoning effort live only in canonical custom-agent TOML files.

- `mechanical`: tiny fully specified transformation; `workflow_implementer`.
- `structured`: bounded implementation with locked approach; `workflow_implementer`.
- `standard`: moderate scoped reasoning; `workflow_implementer_standard`.
- `complex`: architecture or broad implementation inside a defined boundary; `workflow_implementer_complex`.
- `critical`: parent retains final decisions; use an independent risk role only within assurance budget.

Do not launch analysis to restate a decision-complete plan.

## Delegation Gate

Authorization is permission, not activation. Delegate only when independent execution can materially reduce wall time, isolate noisy context, or provide necessary high-risk independence. Never fan out by file count, checklist length, number of chunks, or number of applicable skills.

All delegated write work uses a worktree. The worker receives goal, chosen approach, allowed scope, exact edits, non-goals, verification, stop-if-unclear behavior, and report format. If a required named role is unavailable, execute locally unless that independent role was explicitly required.

The agent budget is global across planning, execution, and finalization. Reuse a running agent for focused follow-up. A launch used for exploration cannot be replaced by a fresh implementation or review quota.

## Evidence Ownership

The worker runs scoped checks for its assigned change. The parent verifies output exists, performs minimal diff/scope sanity, and runs only integration or acceptance evidence not already proven by an unchanged worker result. Do not rerun the same command solely because ownership returned to the parent.

After relevant edits, rerun the strongest affected check once. Merge delegated work only after the applicable gate passes.

If implementation materially diverges from the reviewed commitment, call `workflow_plan_commitment_propose` with the new candidate and confirm a revised decision before handoff. Hook enforcement is optional and must not be awaited or treated as a dependency.

## Completion

During active user testing, batch small corrections and avoid full verification after each one. When implementation tasks are complete, set phase to `finalizing`.

- `fast` work should not be in this module.
- `standard` and `assurance` continue to `finalizing-plan` with the remaining task-wide budget.
- After final verification/review succeeds, close the run with `workflow_plan_complete`; `set_phase: complete` alone is insufficient.

Stop execution when all planned tasks are complete or a material unresolved decision requires the user. Do not add polish or new scope during handoff.
