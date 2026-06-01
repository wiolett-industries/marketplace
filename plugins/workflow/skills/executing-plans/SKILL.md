---
name: Executing Plans
description: Use to execute a durable .workflow plan with todo tracking, compaction recovery, worktree-isolated subagents, and review-gated merges
---

# Executing Plans

Execute an approved plan-run from `.workflow/plans/<MM-DD-YY-slug>/`.

The file artifacts are authoritative. Chat history is not.

When workflow MCP tools are available, use `workflow_status` to locate the active run and `workflow_plan_update` / `workflow_plan_artifact_write` to update task, chunk, phase, review, and artifact state. If MCP is unavailable, make equivalent filesystem edits manually.

## Start Or Resume

1. Locate the active plan-run.
2. Read `manifest.json`, `state.json`, and `plan.md`.
3. Read `context.md`, `decisions.md`, `ui-contract.md` when present, and the latest relevant artifacts.
4. Read `state.latest_handoff` and `handoffs/*.json` when present.
5. Inspect `git status --short`.
6. Rebuild the todo list from `state.json` and `plan.md`.
7. If the plan has `chunks/`, read the root chunk index and continue from the first executable pending chunk.
8. Continue from `state.phase` and the first non-complete task.

After compaction, do the same. Never rely on remembered chat state.

## Chunk Execution

If a root plan has chunks, treat the root as orchestration and each chunk as the executable unit.

For each chunk:

1. Read the chunk `manifest.json`, `state.json`, `plan.md`, `context.md`, and `decisions.md`.
2. Read the root `ui-contract.md` and any chunk-local UI notes when the chunk touches UI.
3. Verify its dependencies are complete in the root `state.json`.
4. Execute the chunk like a normal plan-run.
5. Keep chunk artifacts inside that chunk directory.
6. Update both chunk `state.json` and root `state.json`.
7. Finalize the chunk before marking it complete.

Do not edit outside a chunk's allowed scope unless the root plan is updated first.

Do not create nested chunks.

When all chunks are complete, run root-level integration work and then `Finalizing Plan` for the root.

## Todo State

Represent every plan task in `state.json`:

```json
{
  "id": "T1",
  "title": "Short title",
  "status": "pending",
  "owner": "main | agent:<id>",
  "worktree": null,
  "allowed_scope": ["paths or modules"],
  "verification": []
}
```

Update state when tasks start, finish, block, or move to review.

Prefer `workflow_plan_update` for these state transitions when MCP is available.

For root plans with chunks, also track:

```json
{
  "chunks": [
    {
      "id": "chunk-01",
      "path": "chunks/MM-DD-YY-slug-chunk-01",
      "status": "pending",
      "depends_on": [],
      "scope": ["path/or/module"]
    }
  ]
}
```

## Delegation Policy

Use subagents aggressively when they can work independently and subagent authorization is explicit for the current task/session.

Task model defaults:

- straightforward mechanical implementation: `gpt-5.3-codex-spark medium`
- moderate reasoning: `gpt-5.5 medium`
- heavy reasoning, architecture, or review: `gpt-5.5 high` or `gpt-5.5 xhigh`

If a requested model is unavailable, choose the nearest available model that is not weaker for the task.

Delegate:

- independent implementation slices
- mechanical edits with clear ownership
- verification that can run in parallel
- focused bug investigations

Preferred custom agent for scoped write tasks: `workflow_implementer`.

If `workflow_implementer` is unavailable, stop delegated implementation and report that workflow agent sync/setup is missing.

Keep local:

- immediate blockers on the critical path
- tightly coupled integration decisions
- final coordination and merge decisions

If authorization is not explicit, ask once before delegating. If the user does not authorize subagents, execute locally where possible and record that delegated execution was not authorized.

## Worktree Rule

All non-read-only subagent edits must happen in a worktree.

Before any code edits, verify the git boundary:

- if inside a git repo, use it
- if not in a repo but the current directory is a real project root, run `git init`
- if the directory is a container for multiple projects, do not initialize it; select the correct child project or ask

Each write agent receives:

- task id
- allowed files/modules
- explicit non-goals
- lint and file-boundary constraints
- verification command(s)
- instruction not to revert or overwrite unrelated changes
- instruction to report changed files and evidence

The main thread:

1. Checks the agent output exists.
2. Performs minimal diff sanity.
3. Runs the appropriate review agents.
4. Merges only after the review gate passes.

## Main Thread Boundaries

The main thread coordinates. It should not perform detailed review itself.

Allowed local checks:

- `git status --short`
- confirming expected files changed
- checking for obvious scope violations
- running planned verification commands
- reading small diffs needed to integrate safely

Detailed correctness, scope, and code-quality review belongs to agents through `Finalizing Plan`.

## Interactive User-Testing Loop

When the user is actively testing and reports small issues:

- apply the small fix directly or through the assigned agent
- do not run the full build, full test suite, or full review loop after each small correction
- run targeted checks only when they are cheap and relevant to the correction
- keep state updated so finalization can run later

When the user indicates the interactive loop is done, or before handoff/completion claims, run `Finalizing Plan` and fresh verification.

## UI Execution

When a task touches visible UI:

- Treat `ui-contract.md` as an acceptance source.
- Preserve approved hierarchy, copy, interaction states, density, responsive behavior, and non-goals.
- If the implementation needs to deviate from the UI contract, update `decisions.md` before making the change.
- Keep browser/screenshot evidence under `artifacts/ui-review/` or the relevant chunk's artifacts when verification happens during execution.
- During active inline user testing, keep fixes fast and targeted. Do not run full build, full test, or full UI review after every small visual correction.

## Completion

When all tasks are complete, update `state.phase` to `finalizing` and invoke `Finalizing Plan`.
