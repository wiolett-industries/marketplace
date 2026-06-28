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
  "model_class": "spark_tiny | spark_mechanical | gpt54_implementation | gpt54_analysis | gpt54_risk_review",
  "delegation_reason": "Why this model class is safe",
  "worktree": null,
  "allowed_scope": ["paths or modules"],
  "verification": []
}
```

For chunks, root state also tracks `active_chunk: string | null` and `chunks[]` with `id`, `path`, `status`, `depends_on`, and `scope`.

Use `workflow_plan_update` for state changes. Task status changes use `upsert_task` with `task.id` and `task.status`; task completion uses `complete_task` with `task_id`. Chunk lifecycle uses `set_active_chunk`, `clear_active_chunk`, `complete_chunk`, `cancel_chunk`, and `wait_chunk`; use `upsert_chunk` only for metadata. If a state update call fails because the operation is unsupported or the payload shape is wrong, read the nearest suggestion in the error, correct the payload, and retry the MCP call.

## Delegation

Use subagents aggressively only when work is independent and authorization is explicit. Explicit authorization may come from the current user request, AGENTS.md, developer instructions, or session settings. If standing authorization is present, do not ask again.

## Model Routing

For `complex`/`very_complex` work, start with read-only analysis by `gpt-5.4 high` or `gpt-5.4 xhigh` when scope, architecture, risk, or decomposition is not already clear. Then split the work into the smallest safe implementation chunks.

For `medium` work, still try to split independent code changes into bounded chunks when that reduces wall-clock time and does not create integration risk.

Model defaults:

- tiny mechanical implementation: `gpt-5.3-codex-spark low`
- small/medium mechanical implementation: `gpt-5.3-codex-spark medium`
- broad implementation, larger code generation, or code that still needs local reasoning: `gpt-5.4 low | medium | high` by complexity
- additional analysis, architecture, decomposition, or risk review: `gpt-5.4 high` or `gpt-5.4 xhigh`

Spark has a smaller context budget. Treat it as a patch worker, not an analyst: give it a detailed prompt, exact files/modules, the chosen approach, expected edits, non-goals, and verification commands. Do not give Spark open-ended discovery, architecture, cross-repo analysis, broad refactors, or large code-generation tasks. If a task needs analysis before coding, run a `gpt-5.4 high/xhigh` analysis agent first or keep the task local; if it needs both analysis and substantial coding, consider `gpt-5.4`.

Spark prompt template:

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

Delegate independent implementation slices, mechanical edits with clear ownership, parallel verification, and focused investigations. Keep analysis and coding separate unless using a model appropriate for both.

Keep local: critical-path blockers, tightly coupled integration decisions, final coordination, and merge decisions.

Parallelism cap: normally run at most 2 write agents at once for `medium`, 3 for `complex`, and 4 for `very_complex`. Lower the cap when tasks touch adjacent files, share integration points, or review/merge overhead would exceed the speedup. Read-only analysis/review agents can be wider when independent.

Preferred write agent: `workflow_implementer`. If unavailable, stop delegated implementation. If authorization is missing, ask once; if denied, execute locally and record that delegation was unavailable.

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
