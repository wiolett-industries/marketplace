---
name: Workflow MCP
description: Use when creating, updating, inspecting, or resuming workflow plan/audit artifacts through the bundled workflow MCP tools
---

# Workflow MCP

Use MCP for deterministic `.workflow/` filesystem operations whenever tools are available. This is the normal path, not a preference. MCP does not generate substantive plan/audit/review text, launch agents, merge worktrees, or replace judgment. If tools are unavailable, write the same layout/state manually and state that MCP fallback was used.

Before creating artifacts in a git repo, ensure `.workflow/` is ignored unless explicitly versioned.

## Startup

`@wiolett/workflow` syncs canonical `workflow_*` agents into `~/.codex/agents/` at MCP startup and creates best-effort `~/.agents/agents/` compatibility links/copies. Sync is automatic; there is no model-visible sync tool.

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

`workflow_plan_update` operations: `set_phase`, `set_complexity`, `set_review_round`, `set_clean_streak`, `set_open_findings`, `upsert_task`, `complete_task`, `upsert_chunk`, `merge`.

Task status changes use `upsert_task` with a full task object containing `id` and `status`. Task completion can use `complete_task` with `task_id`. Do not invent short operations such as `set_task_status`.

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

Use MCP for creating/status/updating runs, writing artifacts, normalizing findings, and structured handoffs. Do not bypass it with manual `.workflow/` writes when the matching MCP tool is available. Do not use it for plan content generation, audit judgment, review judgment, subagent launch, worktree merges, git operations, or verification commands.
