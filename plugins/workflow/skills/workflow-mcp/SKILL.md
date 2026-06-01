---
name: Workflow MCP
description: Use when creating, updating, inspecting, or resuming workflow plan/audit artifacts through the bundled workflow MCP tools
---

# Workflow MCP

Use the workflow MCP for deterministic filesystem operations around `.workflow/` runs.

The MCP is not a planner, auditor, reviewer, or agent launcher. The model writes the actual plan text, audit text, prompts, findings, and decisions. MCP tools only create directories, write files, update state, normalize findings, and report status.

If MCP tools are unavailable, perform the same filesystem operations manually and preserve the same layout and state semantics.

Before creating workflow artifacts in a git repository, ensure `.workflow/` is ignored where possible. Prefer adding `.workflow/` to the repository root `.gitignore` when it is missing. Skip this only when the user explicitly wants workflow artifacts versioned.

## Startup Behavior

The `@wiolett/workflow` MCP entrypoint syncs canonical `workflow_*` custom-agent TOML definitions into `~/.codex/agents/` at server startup.

It also creates best-effort compatibility links or managed copies under `~/.agents/agents/`.

Agent sync is automatic. Do not look for or call a model-visible sync tool.

## Workspace Root

All tools accept optional `workspace_root`.

Default behavior:

1. Resolve from `workspace_root` when provided, otherwise process cwd.
2. If a `.git` directory exists upward, use that git root.
3. Otherwise use the resolved cwd.

Use `workspace_root` explicitly when the active task is inside a child project or when the current process cwd may be a parent workspace.

## Active Runs

The root workflow state lives at:

```text
.workflow/state.json
```

It contains:

```json
{
  "active_plan": "plans/MM-DD-YY-slug",
  "active_audit": "audits/MM-DD-YY-slug",
  "updated_at": "ISO-8601"
}
```

`workflow_plan_create` sets `active_plan`.

`workflow_audit_create` sets `active_audit`.

When update/write tools omit `plan_run` or `audit_run`, they operate on the matching active run.

Use `workflow_status` before resuming after compaction, context loss, or uncertainty.

## Plan Tools

Use `workflow_plan_create` to create:

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

Before calling `workflow_plan_create`, ensure `.workflow/` is ignored where possible when the workspace is a git repo.

Required inputs:

- `title`
- `complexity`: `simple | medium | complex | very_complex`

Optional inputs:

- `slug`
- `workspace_root`
- `plan_markdown`
- `context_markdown`
- `questions_markdown`
- `decisions_markdown`
- `tasks`
- `chunks`

Use `workflow_plan_update` for state operations:

- `set_phase`
- `set_complexity`
- `set_review_round`
- `set_clean_streak`
- `set_open_findings`
- `upsert_task`
- `complete_task`
- `upsert_chunk`
- `merge`

Use `workflow_plan_artifact_write` only for:

- `plan.md`
- `context.md`
- `questions.md`
- `decisions.md`
- `ui-contract.md`
- `manifest.json`
- `state.json`
- `artifacts/**`
- `chunks/**`
- `handoffs/**`

## Audit Tools

Use `workflow_audit_create` to create:

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

Before calling `workflow_audit_create`, ensure `.workflow/` is ignored where possible when the workspace is a git repo.

Required inputs:

- `title`
- `depth`: `simple | standard | deep | exhaustive`
- `target`: `project | subsystem | diff | plan`

Optional inputs:

- `slug`
- `workspace_root`
- `audit_markdown`
- `scope_markdown`
- `planning_input_markdown`
- `findings`

Use `workflow_audit_update` for state operations:

- `set_phase`
- `set_depth`
- `set_open_findings`
- `upsert_reviewer`
- `upsert_sanity_check`
- `merge`

Use `workflow_audit_artifact_write` only for:

- `audit.md`
- `scope.md`
- `master-audit.md`
- `findings.json`
- `planning-input.md`
- `manifest.json`
- `state.json`
- `prompts/**`
- `reviews/**`
- `sanity/**`
- `handoffs/**`

## Handoff Tool

Use `workflow_handoff_write` when one workflow module hands off to another.

It writes structured handoff files under:

```text
handoffs/<id>.json
handoffs/<id>.md
```

It also updates `state.json`:

- `handoffs`
- `latest_handoff`

Required inputs:

- `kind`: `plan | audit`
- `from_module`
- `to_module`
- `summary`

Optional inputs:

- `run`
- `id`
- `status`: `ready | partial | blocked | complete`
- `artifacts`
- `decisions`
- `open_questions`
- `risks`
- `next_actions`
- `payload`

Do not invent a separate markdown handoff convention when this tool is available.

## Findings

Use `workflow_findings_normalize` before writing review or audit findings into state files or `findings.json`.

Normalized findings are severity sorted and use these severities:

- `BLOCKING`
- `HIGH`
- `MEDIUM`
- `LOW`
- `INFO`

## Artifact Writes

Artifact write tools require exactly one of:

- `content`
- `json`

Never call an artifact write tool without payload. Never pass both payload forms.

Path escape and absolute paths are rejected. Still keep paths simple and relative to the run directory.

Prefer writing structured JSON artifacts through `json` so formatting is stable.

## Manifest And State

`state.json` is the operational source of truth.

`manifest.json` is the index for quick resume and discovery.

The MCP keeps indexed manifest fields synchronized from state for:

- plan `phase`
- plan `complexity`
- audit `phase`
- audit `depth`
- audit `target`

When manually editing files without MCP, keep these fields synchronized yourself.

## Tool Choice

Use MCP tools for:

- opening a new plan or audit run
- resuming active run status
- state transitions
- task/chunk/reviewer/sanity tracking
- structured module handoffs
- findings normalization
- review/fix/audit artifact writes

Do not use MCP tools for:

- deciding scope
- generating plans
- evaluating findings
- launching subagents
- merging worktrees
- running verification commands
