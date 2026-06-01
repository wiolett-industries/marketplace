# Workflow

Modular Codex workflow framework for intent checks, context discovery, audits, frontend UI contracts, durable plans, subagent execution, and review/fix finalization.

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
- a bundled workflow MCP server that syncs `workflow_*` custom agents globally at startup and exposes deterministic `.workflow/` plan/audit artifact tools

Workflow artifacts are filesystem-first. The workflow MCP may be used to create, update, inspect, and normalize plan/audit artifacts, but this version does not use a workflow RAG layer.

Subagents are automatic only after the user explicitly authorizes agent/delegation use for the current task, plan, or session. If authorization is absent, the workflow asks once before the first subagent launch and records the decision in plan artifacts when available.

## Custom Agents

The workflow custom agents use Codex's custom-agent schema (`name`, `description`, `developer_instructions`, and optional model/sandbox settings). They are shipped by the bundled `@wiolett/workflow` MCP package.

Codex loads custom agents from `.codex/agents/` or `~/.codex/agents/`. The workflow MCP syncs its packaged agent definitions into the correct Codex agents directory at startup and validates that the loaded versions match the package source.

Workflow skills should use the named `workflow_*` custom agents directly. Missing workflow agents are a setup problem, not a reason to silently use generic built-in agents.

The sync target is global only: `~/.codex/agents/`. Project-scoped `.codex/agents/` sync is intentionally not used. For other CLI compatibility, the workflow MCP also creates best-effort links under `~/.agents/agents/`.

## MCP Tools

The MCP tools are state helpers only. They do not generate plan text, audit text, or launch subagents.

- `workflow_status`
- `workflow_plan_create`
- `workflow_plan_update`
- `workflow_plan_artifact_write`
- `workflow_audit_create`
- `workflow_audit_update`
- `workflow_audit_artifact_write`
- `workflow_handoff_write`
- `workflow_findings_normalize`
