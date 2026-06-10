---
name: Executing Plans
description: Use to execute a durable .workflow plan with todo tracking, compaction recovery, worktree-isolated subagents, and review-gated merges
---

# Executing Plans

Execute an approved `.workflow/plans/<run>/plan.md`. Artifacts are authoritative; chat is not. Inherit `Using Workflow` shared rules. Use `workflow_status`, `workflow_plan_update`, `workflow_plan_complete`, and `workflow_plan_artifact_write` when available; manual state/artifact writes are fallback only.

## Start Or Resume

Read:

1. active run from `workflow_status` or `.workflow/state.json`
2. `manifest.json`, `state.json`, `plan.md`
3. `context.md`, `decisions.md`, `ui-contract.md` when present
4. latest relevant artifacts and `handoffs/*.json`
5. chunk index when `chunks/` exists
6. `git status --short`

Rebuild todo from `state.json` and `plan.md`; continue from `state.phase` and the first non-complete task. After compaction, repeat this process.

## Chunks

If root plan has chunks, root orchestrates and chunks execute.

For each chunk: read chunk manifest/state/plan/context/decisions, verify dependencies in root state, mark it active in root plan state, execute like a normal plan-run, keep artifacts inside the chunk, update chunk and root state, finalize chunk before marking it complete.

Do not create nested chunks. Do not edit outside chunk scope unless root `decisions.md` and `state.json` are updated. After all chunks complete, run root integration and `Finalizing Plan`.

## State

Represent every task in `state.json`:

```json
{
  "id": "T1",
  "title": "Short title",
  "status": "pending | in_progress | blocked | review | complete",
  "owner": "main | agent:<id>",
  "delegation_reason": "Why delegating this task is safe",
  "worktree": null,
  "allowed_scope": ["paths or modules"],
  "verification": []
}
```

For chunks, root state also tracks `active_chunk: string | null` and `chunks[]` with `id`, `path`, `status`, `depends_on`, and `scope`.

Use `workflow_plan_update` for state changes. Task status changes use `upsert_task` with `task.id` and `task.status`; task completion uses `complete_task` with `task_id`. Chunk lifecycle uses `set_active_chunk`, `clear_active_chunk`, `complete_chunk`, `cancel_chunk`, and `wait_chunk`; use `upsert_chunk` only for metadata. If a state update call fails because the operation is unsupported or the payload shape is wrong, read the nearest suggestion in the error, correct the payload, and retry the MCP call.

## Delegation

Use subagents aggressively when work is independent.

## Decomposition And Routing

For `complex`/`very_complex` work, start with a read-only analysis agent when scope, architecture, risk, or decomposition is not already clear; use `workflow_explorer` when that first step is mainly locating and mapping code. Then split the work into the smallest safe implementation chunks.

For `medium` work, still try to split independent code changes into bounded chunks when that reduces wall-clock time and does not create integration risk.

Routing defaults — pick the implementer tier by task complexity:

- trivial/mechanical, fully-specified bounded edits: `workflow_implementer` (haiku, lightweight)
- moderately complex scoped work that needs some local reasoning: `workflow_implementer_standard` (sonnet)
- complex, tightly-coupled, or design-bearing work within a bounded scope: `workflow_implementer_complex` (opus)
- broad read-only exploration, file/symbol discovery, or "where/how does this work" sweeps: `workflow_explorer` (sonnet, read-only) — keeps large reads out of the orchestrator context
- additional analysis, architecture, decomposition, or risk review (read-only): dispatch a review agent

Match the tier to the task: the lighter the tier, the more fully decided the approach must already be. Reserve `workflow_implementer_complex` for work that genuinely needs reasoning; do not default everything to it.

Always give the chosen implementer a detailed prompt: exact files/modules, the chosen approach (or its boundary), expected edits, non-goals, and verification commands. The lightweight `workflow_implementer` must receive a fully decided approach and must not get open-ended discovery, architecture, cross-repo analysis, or broad code-generation. The standard and complex tiers may reason within the assigned boundary, but none of them may expand scope, investigate cross-repo, or redefine the task. If a task needs broad analysis first, run a read-only analysis agent or keep that part local, then hand a bounded task to the right tier.

Implementer prompt template:

```text
Goal:
Allowed files/modules:
Chosen approach:
Exact edits:
Non-goals:
Context budget: use only the supplied context plus assigned files; do not analyze the wider project.
Stop if unclear: report NEEDS_CONTEXT instead of guessing.
Verification:
Report format:
```

Delegate independent implementation slices, mechanical edits with clear ownership, parallel verification, and focused investigations. Keep analysis and coding separate for the lightweight tier; `workflow_implementer_complex` may combine them within its task boundary.

Keep local: critical-path blockers, tightly coupled integration decisions, final coordination, and merge decisions.

Parallelism cap: normally run at most 2 write agents at once for `medium`, 3 for `complex`, and 4 for `very_complex`. Lower the cap when tasks touch adjacent files, share integration points, or review/merge overhead would exceed the speedup. Read-only analysis/review agents can be wider when independent.

Pick the implementer tier by task complexity (see routing). If the chosen tier is unavailable, fall back to a higher tier or execute locally and record that delegation was limited.

## Worktrees And Merge Gate

All non-read-only subagent edits happen in worktrees. Each write agent receives task id, allowed scope, non-goals, lint/file-boundary constraints, verification commands, no-revert instruction, and required report shape.

Main thread:

1. verifies agent output exists
2. performs minimal diff sanity
3. runs review agents via `Finalizing Plan`
4. merges only after review gate passes

Detailed correctness/scope/code-quality review belongs to agents, not the main thread.

## User Testing And UI

During active user-testing loops, make small fixes quickly and avoid full build/test/review after every tiny correction. Keep state updated; run `Finalizing Plan` before handoff/completion/commit/PR.

For UI work, treat `ui-contract.md` as acceptance source. Update `decisions.md` before deviating. Put browser/screenshot evidence under `artifacts/ui-review/` or chunk artifacts.

## Completion

When tasks are complete, set `state.phase` to `finalizing` and invoke `Finalizing Plan`.

After final verification/review passes, the plan must be closed with `workflow_plan_complete`. Do not leave implemented work as an active plan, and do not rely on `set_phase: complete` alone because that does not clear root active status.
