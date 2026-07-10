# Execution State And Delegation Reference

Read this reference only for durable task/chunk updates, complex recovery, or delegated write work.

## Task State

```json
{
  "id": "T1",
  "title": "Short title",
  "status": "pending | in_progress | blocked | review | complete",
  "owner": "main | agent:<id>",
  "work_class": "mechanical | structured | standard | complex | critical",
  "agent_role": "workflow_implementer | workflow_implementer_standard | workflow_implementer_complex | null",
  "delegation_reason": "Why delegation is useful and safe",
  "worktree": null,
  "allowed_scope": ["paths or modules"],
  "verification": []
}
```

Use `upsert_task` for task changes and `complete_task` with `task_id` for completion. Do not invent short operations such as `set_task_status`.

## Chunk State

Root state tracks `active_chunk` and `chunks[]`. Use `set_active_chunk`, `clear_active_chunk`, `wait_chunk`, `complete_chunk`, `cancel_chunk`, or `set_chunk_status`; reserve `upsert_chunk` for metadata. Update both chunk and root state at lifecycle boundaries.

## Bounded Worker Prompt

```text
Goal:
Allowed files/modules:
Chosen approach:
Exact edits:
Non-goals:
Context budget: assigned context and files only.
Stop if unclear: report NEEDS_CONTEXT instead of guessing.
Verification:
Report format:
```

Every write agent also receives the no-revert rule, lint/file-boundary constraints, worktree path, and required report shape.

## Merge Gate

Before merging delegated work, confirm output exists, inspect the scoped diff, check scope boundaries, review the worker's fresh verification, and run only missing integration evidence. A detailed second local review is required only when another reviewer is not justified but material risk remains.
