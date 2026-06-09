# Workflow

Modular workflow framework for Claude Code: intent checks, context discovery, audits, frontend UI contracts, durable plans, subagent execution, and review/fix finalization.

Full flow:

```text
intent-gate -> context-discovery -> writing-plans -> executing-plans -> finalizing-plan
```

Audit flow can run independently or feed planning:

```text
intent-gate -> audit-flow
intent-gate -> audit-flow -> writing-plans
```

Each module can also be used independently.

This plugin ships:

- `Using Workflow` as the router after conversation start or compaction
- `Intent Gate` to verify real user intent before acting
- `Context Discovery` to ask as many material questions as needed
- `UI Contract` to define frontend/UI acceptance rules and review delivered interfaces
- `Audit Flow` to create `.workflow/audits/<date-slug>/` review artifacts and planning input
- `Writing Plans` to create `.workflow/plans/<date-slug>/` artifacts
- `Executing Plans` to execute plan tasks with state recovery and worktree-isolated subagents
- `Finalizing Plan` to run complexity-based review/fix loops
- `Workflow MCP` to describe bundled MCP tool contracts for plan/audit artifact state
- `workflow_*` reviewer/implementer subagents under `agents/`, loaded automatically by Claude Code
- a `SessionStart` context hook that loads active `.workflow/` state plus installed companion plugin hints
- a bundled workflow MCP server that exposes deterministic `.workflow/` plan/audit artifact tools

Workflow artifacts are filesystem-first. Use workflow MCP to create, update, complete, inspect, and normalize plan/audit artifacts whenever tools are available; manual `.workflow/` writes are fallback only. This version does not use a workflow RAG layer.

## Hook

Workflow is the only Wiolett plugin that registers a hook. It runs on `SessionStart` (startup, resume, clear, and after compaction) to load context, and detects installed sibling plugins:

- with `agent-memory`, SessionStart includes memory setup/read/write reminders
- with `merge-request-review`, SessionStart includes merge request review hints

Companion plugins keep their skills, subagents, and MCP servers, but they do not register separate hooks.

Subagents are launched at the model's discretion whenever delegation helps; no explicit user authorization is required. The decision to delegate or run locally is recorded in plan artifacts when a plan-run exists.

## Subagents

The `workflow_*` subagents are native Claude Code subagents defined as Markdown files under `agents/`. Claude Code loads them automatically when the plugin is installed; there is no separate sync step. Each subagent pins its own model tier (`haiku` for the bounded implementer, `sonnet`/`opus` for reviewers) and tool access in its frontmatter.

Each reviewer/implementer self-enforces its output contract: its prompt requires it to end every reply with the exact `Status:` / `Verdict:` block its caller expects. Workflow skills dispatch these subagents by name through the Task tool. Missing workflow subagents are a setup problem, not a reason to silently fall back to a generic agent.

## MCP Tools

The MCP tools are state helpers only. They do not generate plan text, audit text, or launch subagents.

Unknown state update operations return a nearest supported operation and payload hint; agents should use that hint to retry the MCP call.

Plan state tracks `active_chunk` and `chunks[]`. Use chunk lifecycle operations for active/waiting/complete/cancelled state and `upsert_chunk` for metadata.

- `workflow_status`
- `workflow_plan_create`
- `workflow_plan_update`
- `workflow_plan_complete`
- `workflow_plan_artifact_write`
- `workflow_audit_create`
- `workflow_audit_update`
- `workflow_audit_complete`
- `workflow_audit_artifact_write`
- `workflow_handoff_write`
- `workflow_findings_normalize`
