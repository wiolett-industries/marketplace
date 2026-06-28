---
name: Using Workflow
description: ALWAYS use at conversation start and after every compaction or context reset to route work through the modular workflow state machine
---

# Using Workflow

Default router for non-trivial engineering work.

Full flow:

```text
intent-gate -> context-discovery -> writing-plans -> executing-plans -> finalizing-plan
```

UI flow adds `ui-contract` before planning and during final review. Audit-only flow is `intent-gate -> audit-flow`; review-only flow is `intent-gate -> finalizing-plan`. Partial flows are valid.

## Start Or Resume

1. Read the request and current repo state.
2. For any non-trivial plan/execute/review/debug/refactor/design request, run `Intent Gate` first. Skip only when the request is obviously mechanical, single-step, and low-risk.
3. If `.workflow/` state exists, call `workflow_status` when available, then restore from artifacts, not chat:
   - plans: `manifest.json`, `state.json`, `plan.md`
   - audits: `manifest.json`, `state.json`, prompts/reviews/sanity/master artifacts
4. Select the earliest needed module and say which module is active.
5. Use Workflow MCP tools for workflow state/artifact operations whenever available. Manual `.workflow/` writes are fallback only when MCP tools are unavailable.

## Module Router

- `Intent Gate`: non-trivial plan/execute/review/debug/refactor/design, hidden intent risk, unclear scope.
- `Context Discovery`: requirements, product intent, architecture, constraints, or tradeoffs are still open.
- `Writing Plans`: direction is approved/clear and needs durable execution artifacts.
- `Audit Flow`: understand project/subsystem/diff/plan health before deciding fixes.
- `UI Contract`: substantial visible UI needs definition or review.
- `Executing Plans`: approved `.workflow/plans/<run>/plan.md` should be executed.
- `Finalizing Plan`: review-only work, completion claims, commits, PRs, handoff, or merge gates.
- `Workflow MCP`: required path for mechanical `.workflow/` create/update/complete/status/artifact/findings/handoff operations when tools are available.

## Shared Rules

- File artifacts are source of truth; chat history is not.
- Plans live under `.workflow/plans/<MM-DD-YY-slug>/`; audits under `.workflow/audits/<MM-DD-YY-slug>/`.
- Keep `.workflow/` ignored in git unless the user explicitly wants artifacts versioned.
- Use workflow MCP tools when available for `.workflow/` status, create, update, complete, artifact, findings, and handoff operations. Manual writes must be explicitly treated as fallback and must preserve the same layout/state semantics.
- Verify git boundary before code edits. If not in a repo, `git init` only in a real project root, never in a container folder with multiple projects; switch to the single matching child project or ask when several match.
- Non-read-only subagent edits must happen in worktrees.
- Main thread coordinates, does minimal diff sanity, runs verification commands, and delegates detailed review to agents.
- If a requested model is unavailable, use the nearest available model that is not weaker for the task class.
- Before final response, handoff, commit, PR, or approval after non-trivial work, make an Agent Memory MCP decision when Agent Memory MCP is available: save/update durable preferences, repo gotchas, root-cause fixes, verification sequences, or workflow lessons; skip one-off progress and raw session recap. Do not substitute Codex built-in memory for this decision.

## Engineering Rules

- Linter is source of truth. Do not disable, weaken, suppress, or bypass lint/test rules.
- Treat lint warnings as work.
- Find relevant lint command/config before planning or coding when one exists.
- Keep code files focused and below 500 lines; split first if a touched file would reach that limit.
- Avoid unrelated refactors and "while here" changes.
- Do not shrink approved scope, add placeholders, or create unwired artifacts.
- Do not claim fixed/complete/ready without fresh verification evidence.
- Before drafting PR/MR title or description, inspect existing project PRs/MRs/templates when available and match local style.

## User-Testing Loop

When the user is actively testing and sends small fixes:

- make the small correction quickly
- avoid full build/test/review after each tiny change
- run only cheap targeted checks when relevant
- run `Finalizing Plan` and fresh verification before handoff, commit, PR, or completion claims

## Subagents

Workflow may use subagents automatically only after explicit user authorization for the task/session. Treat authorization as present when the user asks for subagents, agents, delegation, parallel agents, agentic review, automatic workflow agents, running the workflow with agents, or when AGENTS.md/developer/session settings grant standing authorization.

If needed and not yet authorized, ask once:

```text
This workflow works best with automatic subagents for intent checks, implementation, and review. Do you authorize me to launch subagents automatically for this task/session according to the workflow rules?
```

Record yes/no in plan `decisions.md` or `state.json` when a plan-run exists. If no, run locally and report unavailable guarantees.

## Custom Agents

The `@wiolett/workflow` MCP syncs canonical `workflow_*` TOML agents into Codex agent dirs at startup. When a module asks for a named `workflow_*` agent:

1. Use that exact `agent_type`.
2. Do not substitute generic agents.
3. If unavailable, stop the affected agentic step and report stale/missing workflow agent sync.
4. Record the agent type in workflow artifacts.

## MCP Short Rule

Use MCP for deterministic filesystem operations whenever the tools are available:

- `workflow_status`
- `workflow_plan_create`, `workflow_plan_update`, `workflow_plan_complete`, `workflow_plan_artifact_write`
- `workflow_audit_create`, `workflow_audit_update`, `workflow_audit_complete`, `workflow_audit_artifact_write`
- `workflow_handoff_write`
- `workflow_findings_normalize`

Do not hand-write `.workflow/` state, manifests, findings, completion state, or handoffs when the matching MCP tool is available.

When a plan is implemented and final verification/review is done, always finish the workflow run with `workflow_plan_complete`. Do not leave completed plans active with only `state.phase = complete`, because active root state controls resume/status context. For completed audits, use `workflow_audit_complete`.

If an MCP call fails because the operation name, schema, or payload shape is wrong, fix the call from the error text and retry it. Unsupported operation errors include a nearest supported operation; use it instead of abandoning Workflow MCP or switching to manual `.workflow/` writes.

MCP does not write the substantive plan/audit/review content, launch agents, merge worktrees, or replace agent judgment.
