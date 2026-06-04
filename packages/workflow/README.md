# Workflow

MCP runtime for the Workflow Codex plugin.

On server startup it validates the packaged `workflow_*.toml` custom-agent definitions and syncs them globally into `~/.codex/agents/`.

It also creates best-effort compatibility links in `~/.agents/agents/` that point to the synced Codex agent files. If symlinks are unavailable, it falls back to managed copies. Locally modified or unmanaged compatibility files are not overwritten.

Agent sync is a startup invariant, not a model-visible action, so the server does not expose sync tools.

The Workflow plugin is also the consolidated hook owner for Wiolett plugins. Its hook can detect sibling `agent-memory` and `merge-request-review` plugin installs and add the relevant startup context or merge_request_* reviewer validation without those plugins registering separate hooks.

## Tools

The MCP tools are deterministic filesystem helpers for `.workflow/` artifacts. Use them whenever available for workflow status, run creation, state updates, artifact writes, findings normalization, and structured handoffs; manual `.workflow/` writes are fallback only. They do not generate plans, run agents, or make architecture decisions.

State update tools reject unknown operations with a nearest supported operation and a payload hint. Agents should correct the operation shape and retry the MCP call instead of falling back to manual `.workflow/` writes.

- `workflow_status`: read active plan/audit state and latest workflow runs.
- `workflow_plan_create`: create `.workflow/plans/<slug>/` with `plan.md`, `manifest.json`, `state.json`, context/questions/decisions files, `artifacts/`, and `chunks/`.
- `workflow_plan_update`: apply structured state operations to the active or named plan run.
- `workflow_plan_artifact_write`: write allowed plan-run files without path escape.
- `workflow_audit_create`: create `.workflow/audits/<slug>/` with audit state, prompt/review/sanity folders, findings, and master audit files.
- `workflow_audit_update`: apply structured state operations to the active or named audit run.
- `workflow_audit_artifact_write`: write allowed audit-run files without path escape.
- `workflow_handoff_write`: write structured module handoffs into active plan/audit state.
- `workflow_findings_normalize`: normalize findings into stable severity-sorted workflow findings.
