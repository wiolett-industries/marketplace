# Workflow

Modular workflow framework for Codex and Claude Code: intent checks, context discovery, audits, frontend UI contracts, durable plans, subagent execution, and review/fix finalization.

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
- consolidated platform hooks for workflow startup/subagent contracts plus installed companion plugin hints/checks
- a bundled workflow MCP server that syncs `workflow_*` custom agents globally at startup and exposes deterministic `.workflow/` plan/audit artifact tools

Workflow artifacts are filesystem-first. Use workflow MCP to create, update, complete, inspect, and normalize plan/audit artifacts whenever tools are available; manual `.workflow/` writes are fallback only. This version does not use a workflow RAG layer.

## Hook Consolidation

Workflow is the only Wiolett plugin that registers platform hooks. Its hook detects installed sibling plugins and adapts context:

- with `agent-memory`, SessionStart includes memory setup/read/write reminders
- with `merge-request-review`, merge_request_* subagents get MR review prompts and output validation

Companion plugins keep their skills and MCP servers, but they do not register separate hooks.

Subagents are automatic only after the user explicitly authorizes agent/delegation use for the current task, plan, or session. If authorization is absent, the workflow asks once before the first subagent launch and records the decision in plan artifacts when available.

## Custom Agents

The workflow custom agents are committed in platform-native formats:

- Codex TOML agents are shipped by the bundled `@wiolett/workflow` MCP package.
- Claude Code markdown agents live under `plugins/workflow/agents/`.

Codex loads custom agents from `.codex/agents/` or `~/.codex/agents/`. The workflow MCP syncs its packaged agent definitions into the correct Codex agents directory at startup and validates that the loaded versions match the package source.

Workflow skills should use the named `workflow_*` custom agents directly. Missing workflow agents are a setup problem, not a reason to silently use generic built-in agents.

The Codex sync target is global only: `~/.codex/agents/`. Project-scoped `.codex/agents/` sync is intentionally not used. For other CLI compatibility, the workflow MCP also creates best-effort links under `~/.agents/agents/`.

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
