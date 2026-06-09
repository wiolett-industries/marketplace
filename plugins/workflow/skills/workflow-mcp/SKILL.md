---
name: Workflow MCP
description: Use when creating, updating, inspecting, or resuming workflow plan/audit artifacts through the bundled workflow MCP tools
---

# Workflow MCP

Use MCP for deterministic `.workflow/` filesystem operations whenever tools are available. This is the normal path, not a preference. MCP does not generate substantive plan/audit/review text, launch agents, merge worktrees, or replace judgment. If tools are unavailable, write the same layout/state manually and state that MCP fallback was used.

Before creating artifacts in a git repo, ensure `.workflow/` is ignored unless explicitly versioned.

## Workspace Root

All tools accept optional `workspace_root`. Default: explicit `workspace_root`, else process cwd, then nearest git root if present. Pass `workspace_root` when the task is in a child project or cwd may be a parent workspace.

## Active Runs

Root state:

```json
{
  "active_plan": "plans/MM-DD-YY-slug",
  "active_audit": "audits/MM-DD-YY-slug",
  "updated_at": "ISO-8601"
}
```

`workflow_plan_create` sets `active_plan`; `workflow_audit_create` sets `active_audit`. Omitted `plan_run`/`audit_run` means active run. Use `workflow_status` at workflow start/resume, after compaction, before finalization, and whenever active run state is uncertain.

`workflow_plan_complete` marks a plan run complete and clears `active_plan` only when the active pointer references that run. `workflow_audit_complete` does the same for audits and `active_audit`. When implementation and final verification/review are done, always use the complete tool; do not leave a completed run active by only writing `state.phase = complete`.

Create vs update guard: new workflow work gets `workflow_plan_create` or `workflow_audit_create`. Existing unfinished work gets `workflow_plan_update` or `workflow_audit_update`. Do not reopen or update an old completed run unless the user explicitly asks to continue that exact run.

## Plan Tools

`workflow_plan_create` creates:

```text
.workflow/plans/MM-DD-YY-slug/
  plan.md
  manifest.json
  state.json
  context.md
  questions.md
  decisions.md
  artifacts/
  chunks/
  handoffs/
```

Required: `title`, `complexity: simple | medium | complex | very_complex`.
Optional: `slug`, `workspace_root`, `plan_markdown`, `context_markdown`, `questions_markdown`, `decisions_markdown`, `tasks`, `chunks`.

Plan state includes `active_chunk: string | null`. Keep it inside the plan run, not root workflow state, because chunk activity belongs to one plan.

`workflow_plan_update` operations: `set_phase`, `set_complexity`, `set_review_round`, `set_clean_streak`, `set_open_findings`, `upsert_task`, `complete_task`, `set_active_chunk`, `clear_active_chunk`, `upsert_chunk`, `set_chunk_status`, `complete_chunk`, `cancel_chunk`, `wait_chunk`, `merge`.

Task status changes use `upsert_task` with a full task object containing `id` and `status`. Task completion can use `complete_task` with `task_id`. Do not invent short operations such as `set_task_status`.

Chunk status changes use the chunk lifecycle operations:

- active: `{"type":"set_active_chunk","chunk_id":"C1"}`
- waiting: `{"type":"wait_chunk","chunk_id":"C1"}`
- complete: `{"type":"complete_chunk","chunk_id":"C1"}`
- cancelled: `{"type":"cancel_chunk","chunk_id":"C1"}`
- arbitrary status: `{"type":"set_chunk_status","chunk_id":"C1","status":"blocked"}`

Use `upsert_chunk` only for chunk metadata such as title, path, scope, dependencies, owner, or verification. `complete_chunk`, `cancel_chunk`, and `wait_chunk` clear `active_chunk` when they act on the active chunk.

`workflow_plan_complete` required input: none when completing the active plan; optional `workspace_root`, `plan_run` for an explicit run. Use this after finalization passes. It updates `state.json`, syncs `manifest.json`, and clears root `active_plan` if it points to that run.

`workflow_plan_artifact_write` allowed paths: `plan.md`, `context.md`, `questions.md`, `decisions.md`, `ui-contract.md`, `manifest.json`, `state.json`, `artifacts/**`, `chunks/**`, `handoffs/**`.

## Audit Tools

`workflow_audit_create` creates:

```text
.workflow/audits/MM-DD-YY-slug/
  audit.md
  manifest.json
  state.json
  scope.md
  prompts/
  reviews/
  sanity/
  master-audit.md
  findings.json
  planning-input.md
  handoffs/
```

Required: `title`, `depth: simple | standard | deep | exhaustive`, `target: project | subsystem | diff | plan`.
Optional: `slug`, `workspace_root`, `audit_markdown`, `scope_markdown`, `planning_input_markdown`, `findings`.

`workflow_audit_update` operations: `set_phase`, `set_depth`, `set_open_findings`, `upsert_reviewer`, `upsert_sanity_check`, `merge`.

`workflow_audit_complete` required input: none when completing the active audit; optional `workspace_root`, `audit_run` for an explicit run. Use this after the master audit/review output is accepted. It updates `state.json`, syncs `manifest.json`, and clears root `active_audit` if it points to that run.

`workflow_audit_artifact_write` allowed paths: `audit.md`, `scope.md`, `master-audit.md`, `findings.json`, `planning-input.md`, `manifest.json`, `state.json`, `prompts/**`, `reviews/**`, `sanity/**`, `handoffs/**`.

## Handoff

`workflow_handoff_write` writes `handoffs/<id>.json` and `handoffs/<id>.md`, then updates `state.handoffs` and `state.latest_handoff`.

Required: `kind: plan | audit`, `from_module`, `to_module`, `summary`.
Optional: `run`, `id`, `status: ready | partial | blocked | complete`, `artifacts`, `decisions`, `open_questions`, `risks`, `next_actions`, `payload`.

Do not invent a separate markdown handoff when this tool is available.

## Findings And Writes

Use `workflow_findings_normalize` before writing review/audit findings into state or `findings.json`. Severities: `BLOCKING`, `HIGH`, `MEDIUM`, `LOW`, `INFO`.

Artifact write tools require exactly one payload: `content` or `json`. Never pass both or neither. Absolute/path-escape paths are rejected; still keep paths simple and run-relative. Prefer `json` for structured data.

`state.json` is operational truth. `manifest.json` is discovery index. MCP syncs plan `phase`/`complexity` and audit `phase`/`depth`/`target` from state; manual edits must keep them aligned.

## Operation Error Recovery

If a Workflow MCP call fails with an unsupported operation, schema, payload, or validation error, treat that as a tool-call formatting bug, not as a reason to abandon Workflow MCP.

Read the error text, use the nearest supported operation or hint it provides, and immediately retry the same MCP tool with the corrected payload. Example: replace `set_task_status` with `upsert_task` and pass `{"task":{"id":"T1","status":"in_progress"}}`, or use `complete_task` with `task_id` when marking completion.

Do not switch to manual `.workflow/` edits while the matching MCP tool is available.

Use MCP for creating/status/updating/completing runs, writing artifacts, normalizing findings, and structured handoffs. Do not bypass it with manual `.workflow/` writes when the matching MCP tool is available. Do not use it for plan content generation, audit judgment, review judgment, subagent launch, worktree merges, git operations, or verification commands.
