---
name: Using Workflow
description: ALWAYS use at conversation start and after every compaction or context reset to route work through the modular workflow state machine
---

# Using Workflow

Use this skill as the workflow router.

Full flow:

```text
intent-gate -> context-discovery -> writing-plans -> executing-plans -> finalizing-plan
```

For substantial frontend/UI work, add `ui-contract` as a support gate:

```text
intent-gate -> context-discovery -> ui-contract(define) -> writing-plans -> executing-plans -> ui-contract(review) -> finalizing-plan
```

Partial flows are valid:

- `intent-gate -> audit-flow` for standalone audits
- `intent-gate -> audit-flow -> writing-plans` when audit findings should become an implementation plan
- `intent-gate -> ui-contract` for standalone frontend contract definition or UI review
- `intent-gate -> finalizing-plan` for review-only work
- `intent-gate -> writing-plans` for planning without execution
- `executing-plans -> finalizing-plan` for an approved existing plan
- `finalizing-plan` alone when the user asks for final review of current changes

## Session Start

At conversation start, after compaction, or after context uncertainty:

1. Read the user request and current repo state.
2. If `.workflow/plans/*/state.json` exists and the user is continuing work, restore the active plan from `manifest.json`, `state.json`, and `plan.md`.
3. Select the earliest needed module.
4. Do not skip `Intent Gate` for non-trivial work unless the user explicitly asks for a narrow mechanical operation.

## Module Selection

Use `Intent Gate` when:

- the task is non-trivial
- the user asks to plan, execute, review, debug, refactor, or design
- the visible request may hide a different desired outcome
- scope, risk, or success criteria are not obvious

Use `Context Discovery` when:

- requirements, architecture, product direction, or tradeoffs need clarification
- the model needs more context before writing a plan
- the correct solution is not clear from repo inspection

Use `Writing Plans` when:

- the direction is approved or clear enough to encode
- a multi-step implementation needs a durable artifact
- execution may span compaction or subagents

Use `Audit Flow` when:

- the user asks to audit, inspect, assess, analyze, or review a project/subsystem without immediately fixing it
- the goal is to understand project health, architecture, risks, security, quality, or technical debt
- findings should be gathered before deciding what to plan
- a large project needs multiple independent read-only review agents

Use `UI Contract` when:

- the task includes substantial frontend or UI work
- the layout, hierarchy, copy, or interaction direction is not already locked
- a frontend plan needs visible acceptance criteria
- implemented UI needs a structured review before completion
- browser or screenshot verification should be part of the evidence

Use `Executing Plans` when:

- there is an approved `.workflow/plans/<date-slug>/plan.md`
- the user asks to implement an existing plan
- work should be broken into tracked tasks or delegated agents

Use `Finalizing Plan` when:

- implementation is complete enough to review
- the user asks for review-only work
- subagent changes need a merge gate
- success claims, commits, PRs, or handoff are next

Use `Workflow MCP` alongside any module that creates, updates, inspects, or resumes `.workflow/` plan/audit artifacts through MCP tools.

## Always-On Rules

- File artifacts are the source of truth, not chat history.
- Workflow artifacts live under `.workflow/plans/<MM-DD-YY-slug>/`.
- Audit artifacts live under `.workflow/audits/<MM-DD-YY-slug>/`.
- UI contract artifacts live inside the relevant plan-run as `ui-contract.md` and `artifacts/ui-review/`.
- Workflow artifacts are local operational state. When inside a git repo, make sure `.workflow/` is ignored where possible before creating artifacts.
- Prefer workflow MCP tools for creating, updating, inspecting, and normalizing workflow artifacts when available.
- Do not rely on RAG for workflow state in this version.
- For code work, verify the git repository boundary before edits.
- All non-read-only subagent work must happen in a worktree.
- The main thread coordinates, performs minimal sanity checks, and delegates detailed review to agents.
- If a requested model is unavailable, use the nearest available model that is not weaker for the task class.

## Engineering Constraints

These constraints apply to all workflow coding work:

- Treat the project linter as source of truth when one exists.
- Do not disable, weaken, remove, suppress, or bypass lint rules to make work pass.
- Treat lint warnings as real work, not noise.
- Find the relevant lint command/config before planning or coding when the project has one.
- Keep code files focused on one responsibility.
- Do not mix unrelated UI, data access, orchestration, parsing, infrastructure, and business logic in one file.
- Keep code files below 500 lines.
- If a change would push a file to or beyond 500 lines, split the touched responsibility first.
- Do not make unrelated refactors or "while here" improvements.
- Do not silently shrink approved scope or add fake staging such as placeholders, basic versions, or wire-later behavior.
- Do not claim work is complete, fixed, passing, reviewed, or ready without fresh verification evidence.

## Interactive User-Testing Loop

When the user is actively testing changes and sends small inline fixes, prioritize fast iteration:

- make the requested small correction
- avoid running full build, full test suite, or full review loop after every tiny fix
- run only targeted checks when they are cheap and directly relevant
- wait for the user's next observation before doing heavy verification

Before handoff, commit, PR, or completion claims, run `Finalizing Plan` and fresh verification. Mid-loop user testing does not replace final verification.

## Subagent Authorization

Workflow is designed to use subagents automatically, but only after explicit user authorization exists for the current task, plan, or session.

Treat authorization as present when the user explicitly asks for any of:

- subagents
- agents
- delegation
- parallel agents
- agentic review
- automatic workflow agents
- running the workflow with agents

If authorization is not already explicit and the selected workflow path needs subagents, ask once before the first spawn:

```text
This workflow works best with automatic subagents for intent checks, implementation, and review. Do you authorize me to launch subagents automatically for this task/session according to the workflow rules?
```

If the user says yes, continue without asking again for each subagent in that task/session. Record the authorization in the plan `decisions.md` or `state.json` when a plan-run exists.

If the user says no, run the same workflow locally where possible and clearly report which review/delegation guarantees are unavailable.

## Workflow Custom Agents

The bundled `@wiolett/workflow` MCP entrypoint is the canonical source for Codex workflow custom-agent definitions.

Codex only loads custom agents after those TOML files are installed into `.codex/agents/` for the current project or `~/.codex/agents/` globally. The workflow MCP entrypoint is expected to sync and validate them at startup.

When a workflow module asks for a named `workflow_*` agent:

1. Use that exact `agent_type`.
2. Do not substitute generic built-in agents for workflow roles.
3. If the named agent is unavailable, stop the affected agentic step and report that workflow agent sync/setup is missing or stale.
4. Record the agent type used in workflow artifacts.

The workflow MCP owns installing, validating, and updating these TOML files in the correct Codex agents directory.

## Workflow MCP

Use the `Workflow MCP` support skill for detailed MCP tool contracts, payload rules, active-run behavior, and manual fallback behavior.

Short rule: when available, use the workflow MCP for mechanical artifact operations:

- `workflow_status` before resuming a plan or audit
- `workflow_plan_create` when opening a new plan-run
- `workflow_plan_update` when task, phase, chunk, clean-streak, or finding state changes
- `workflow_plan_artifact_write` for plan-run review/fix/chunk artifacts
- `workflow_audit_create` when opening a new audit-run
- `workflow_audit_update` when audit phase, reviewer, sanity, or finding state changes
- `workflow_audit_artifact_write` for audit prompts, reviews, sanity output, master audit, findings, and planning input
- `workflow_handoff_write` when one workflow module hands off to another
- `workflow_findings_normalize` before writing review or audit findings into state files

The MCP does not generate plan/audit content, launch agents, merge worktrees, or run verification.

If MCP tools are unavailable, perform the same filesystem writes manually and preserve the same layout and state semantics.

## Git Boundary Rules

If already inside a git repository, use that repository and inspect `git status --short`.

Before creating `.workflow/` artifacts in a git repository:

- run or reason about `git check-ignore .workflow/`
- if `.workflow/` is not ignored and `.gitignore` exists or can be created at the repo root, add `.workflow/`
- do not add `.workflow/` to ignore rules if the user explicitly wants workflow artifacts versioned
- if ignore setup is not possible, continue but report that `.workflow/` may appear in git status

If not inside a git repository:

- run `git init` only when the current directory has a real top-level project marker such as `package.json`, `pnpm-workspace.yaml`, `pyproject.toml`, `Cargo.toml`, or `go.mod`
- do not initialize git in a container folder that merely holds multiple project folders
- if exactly one child project clearly matches the request, switch into it
- if several child projects could match, ask the user to choose
