---
name: Executing Plans
description: Use to execute a durable .workflow plan with todo tracking, compaction recovery, worktree-isolated subagents, and review-gated merges
---

# Executing Plans

Execute an approved `.workflow/plans/<run>/plan.md`. Artifacts are authoritative; chat is not. Inherit `Using Workflow` shared rules. Prefer `workflow_status`, `workflow_plan_update`, and `workflow_plan_artifact_write` when available.

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

For each chunk: read chunk manifest/state/plan/context/decisions, verify dependencies in root state, execute like a normal plan-run, keep artifacts inside the chunk, update chunk and root state, finalize chunk before marking it complete.

Do not create nested chunks. Do not edit outside chunk scope unless root `decisions.md` and `state.json` are updated. After all chunks complete, run root integration and `Finalizing Plan`.

## State

Represent every task in `state.json`:

```json
{
  "id": "T1",
  "title": "Short title",
  "status": "pending | in_progress | blocked | review | complete",
  "owner": "main | agent:<id>",
  "worktree": null,
  "allowed_scope": ["paths or modules"],
  "verification": []
}
```

For chunks, root state also tracks `chunks[]` with `id`, `path`, `status`, `depends_on`, and `scope`.

## Delegation

Use subagents aggressively only when work is independent and authorization is explicit.

Model defaults:

- mechanical implementation: `gpt-5.3-codex-spark medium`
- moderate reasoning: `gpt-5.5 medium`
- heavy reasoning/architecture/review: `gpt-5.5 high` or `gpt-5.5 xhigh`

Delegate independent implementation slices, mechanical edits with clear ownership, parallel verification, and focused investigations.

Keep local: critical-path blockers, tightly coupled integration decisions, final coordination, and merge decisions.

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
