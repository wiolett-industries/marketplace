# Workflow

Lean, risk-budgeted workflow framework for Codex and Claude Code. One primary path owns each task; supporting skills do not add agents, artifacts, or review loops by themselves.

Durable implementation path:

```text
intent-gate -> context-discovery -> writing-plans -> executing-plans -> finalizing-plan
```

Alternative primary paths:

```text
intent-gate -> audit-flow
intent-gate -> audit-flow -> writing-plans
```

GitLab MR review is owned by the companion `review-merge-request` skill and is mutually exclusive with `finalizing-plan` for the same review.

Clear, reversible work uses a fast path instead of the full module chain:

```text
local intent check -> direct execution -> targeted verification -> handoff
```

This plugin ships these lowercase skill entrypoints:

- `using-workflow` selects one primary path and the task-wide assurance/verification budget
- `intent-gate` performs a brief local intent/risk routing check
- `context-discovery` asks only questions that can change implementation or risk
- `ui-contract` supports substantial production UI; bounded mockups use one local visual pass
- `audit-flow` defaults to a quick chat-only audit and creates durable artifacts only when needed
- `writing-plans` creates authorized decision-complete `.workflow/plans/` artifacts
- `executing-plans` executes active plan tasks with milestone state updates and selective delegation
- `finalizing-plan` runs one bounded standard/assurance completion path
- `workflow-mcp` documents deterministic state operations without authorizing artifacts
- consolidated platform hooks for workflow startup/subagent contracts, Codex commitment enforcement, and installed companion plugin hints/checks
- a bundled workflow MCP server that syncs `workflow_*` custom agents globally at startup and exposes deterministic `.workflow/` plan/audit and commitment tools

Workflow artifacts are filesystem-first and live under `.workflow/` by default. The MCP and consolidated hook read optional artifact paths from `$AGENTS_HOME/.wiolett/config/mcp-config.yml`; only Agent Memory generates or migrates that file. Use Workflow MCP to create, update, complete, inspect, and normalize an authorized plan/audit run whenever tools are available; manual writes are fallback only. Fast work and read-only discussion do not create artifacts. This version does not use a workflow RAG layer.

## Hook Consolidation

Workflow is the only Wiolett plugin that registers platform hooks. Its hook detects installed sibling plugins and adapts context:

- with `agent-memory`, SessionStart includes memory setup/read/write reminders
- with `merge-request-review`, merge_request_* subagents get MR review prompts and output validation

Companion plugins keep their skills and MCP servers, but they do not register separate hooks.

Material plans use a portable same-model commitment reflection before execution: compare the original request with the expected change class and surfaces, try to remove unsupported abstractions/contracts, then record `KEEP`, `SHRINK`, `ASK`, or `REPLAN`. Codex has a Stop hook that blocks a missing reflection once and respects `stop_hook_active`; Claude Code intentionally has no matching Stop hook in this version. The shared skills and MCP contract are complete without either hook, so clients must never search for or wait on one.

Subagent authorization is permission, not a launch trigger. Agents run only when independent parallel work, noisy-context isolation, independent high-risk judgment, or an explicit requested split provides concrete benefit. The selected task-wide profile caps launches across every module: `fast` uses 0 agents, `standard` at most 1 total, and `assurance` a declared total (default 3) with at most 2 reviewers per round. Parent Max/Ultra does not increase these budgets. Verification also has one task-wide budget: unchanged checks are not rerun, and completion stops once scoped acceptance, evidence, and material-risk gates pass.

## Custom Agents

The workflow custom agents are committed in platform-native formats:

- Codex TOML agents are shipped by the bundled `@wiolett/workflow` MCP package.
- Claude Code markdown agents live under `plugins/workflow/agents/`.

Codex loads custom agents from `.codex/agents/` or `~/.codex/agents/`. The workflow MCP syncs its packaged agent definitions into the correct Codex agents directory at startup and validates that the loaded versions match the package source.

Workflow skills should use the named `workflow_*` custom agents directly. Missing workflow agents are a setup problem, not a reason to silently use generic built-in agents.

Codex agent models are routed by role in the canonical TOML definitions:

- GPT-5.6 Luna for clear mechanical/structured work
- GPT-5.6 Terra for everyday implementation, exploration, synthesis, and primary review
- GPT-5.6 Sol for complex implementation and high-assurance risk review

Skills and plan artifacts use semantic `work_class` and `agent_role` values rather than embedding model versions. No agent is statically pinned above `high` reasoning effort.

The Codex sync target is global only: `~/.codex/agents/`. Project-scoped `.codex/agents/` sync is intentionally not used. For other CLI compatibility, the workflow MCP also creates best-effort links under `~/.agents/agents/`.

## MCP Tools

The MCP tools are state helpers only. They do not generate plan text, audit text, or launch subagents.

Unknown state update operations return a nearest supported operation and payload hint; agents should use that hint to retry the MCP call.

Plan state tracks `active_chunk` and `chunks[]`. Use chunk lifecycle operations for active/waiting/complete/cancelled state and `upsert_chunk` for metadata.

Plan and audit update tools share one operation handler in the MCP runtime. The skill docs list the intended operation subset for each run type so agents keep state meaningful, but the registered source tool contract is the full shared handler.

- `workflow_status`
- `workflow_plan_create`
- `workflow_plan_update`
- `workflow_plan_commitment_propose`
- `workflow_plan_commitment_confirm`
- `workflow_plan_complete`
- `workflow_plan_artifact_write`
- `workflow_audit_create`
- `workflow_audit_update`
- `workflow_audit_complete`
- `workflow_audit_artifact_write`
- `workflow_handoff_write`
- `workflow_findings_normalize`

If a live installation launched via `@wiolett/workflow@latest` is missing a source-registered tool such as a completion helper, check the installed/published package version before treating the docs as stale.
