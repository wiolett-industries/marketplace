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
- a `SessionStart` context hook that loads active `.workflow/` state plus installed companion plugin hints, and a `PostToolUse` Bash output filter that trims noisy command output to save tokens
- a bundled workflow MCP server that exposes deterministic `.workflow/` plan/audit artifact tools

Workflow artifacts are filesystem-first. Use workflow MCP to create, update, complete, inspect, and normalize plan/audit artifacts whenever tools are available; manual `.workflow/` writes are fallback only. This version does not use a workflow RAG layer.

## Hooks

Workflow is the only Wiolett plugin that registers hooks. It registers two:

**`SessionStart`** (startup, resume, clear, and after compaction) loads context and detects installed sibling plugins:

- with `agent-memory`, SessionStart includes memory setup/read/write reminders
- with `merge-request-review`, SessionStart includes merge request review hints

**`PostToolUse` on `Bash`** (`hooks/output-filter.cjs`) trims noisy command output before it enters the model context, to reduce token usage. It is conservative by design:

- `stderr` and exit codes are never touched, so error signal is preserved
- real ANSI/terminal control is stripped (bracketed text like `[main abc]`, `[x]`, `[INFO]` is never touched), carriage-return progress bars are collapsed, and long runs of identical lines are deduplicated
- output larger than the threshold is elided to head + tail, with error/warning lines from the elided middle preserved
- on any parsing uncertainty or oversize replacement, it passes the original output through unchanged

Behavior is driven by `~/.agents/.wiolett/output.json` (see `hooks/output.example.json` for the schema). Set `"enabled": false` to disable trimming entirely; add `rules` to tune per-command handling (`passthrough`, or `tail` with `keepLines`). When the file is absent, conservative defaults apply.

Companion plugins keep their skills, subagents, and MCP servers, but they do not register separate hooks.

Subagents are launched at the model's discretion whenever delegation helps; no explicit user authorization is required. The decision to delegate or run locally is recorded in plan artifacts when a plan-run exists.

## Subagents

The `workflow_*` subagents are native Claude Code subagents defined as Markdown files under `agents/`. Claude Code loads them automatically when the plugin is installed; there is no separate sync step. Each subagent pins its own model tier and tool access in its frontmatter. The implementer ships in three complexity tiers so the orchestrator can match model to task: `workflow_implementer` (haiku, fully-specified mechanical edits), `workflow_implementer_standard` (sonnet, scoped work needing some local reasoning), and `workflow_implementer_complex` (opus, complex or design-bearing work within a bounded scope). Reviewers use `sonnet`/`opus`.

`workflow_explorer` (sonnet, read-only) is the token-isolation agent: the orchestrator delegates broad multi-file exploration and "where/how does this work" sweeps to it, so large file reads and command output stay in the subagent's context window and only a compact findings report returns to the orchestrator.

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
