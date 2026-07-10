---
name: using-workflow
description: Use at conversation start, after context recovery, and for non-trivial engineering work to select exactly one primary workflow path plus one task-wide assurance and verification budget. Loading this router does not create artifacts, launch agents, or activate every workflow module.
---

# Using Workflow

Route work through the smallest workflow that can prove the requested outcome. Workflow modules are alternative phases or supporting concerns, not additive checklists.

## Choose One Primary Path

- `direct`: clear, localized, reversible work; execute locally and verify once.
- `plan-execute`: durable multi-step work; use `writing-plans` -> `executing-plans` -> `finalizing-plan` as needed.
- `audit`: explicit quality/risk/readiness investigation; use `audit-flow` and stop unless fixes are requested.
- `gitlab-review`: ready GitLab MR review; use `review-merge-request`, never `finalizing-plan` for the same review.

`intent-gate` and `context-discovery` are brief routing helpers. `ui-contract`, `workflow-mcp`, and `using-agent-memory` are supporting skills; they do not allocate separate agents, reviews, or budgets.

A skill trigger never implies an artifact, subagent, plan, or verification step by itself.

## Start Or Resume

1. Read the request and cheap repository facts.
2. Run a local `intent-gate` for non-trivial work; keep it silent when intent is clear.
3. If `.workflow/` exists or context was compacted, call `workflow_status` once and resume an active run from its state. Do not reopen an old completed run without an explicit request.
4. Select one primary path and one assurance profile.
5. Load only the module needed for the current phase.

## Action Boundary

- Answer, explain, diagnose, review, or discussion requests authorize inspection and reporting, not code, `.workflow/`, memory, or external writes.
- An explicit request for a durable plan/audit authorizes its scoped `.workflow/` artifacts.
- Change, build, or fix requests authorize in-scope local edits and relevant non-destructive validation.
- Read-only, no-edits, without changes, or equivalent blocks code, workflow-state, memory, and external mutations unless the same request explicitly authorizes one of them.
- Ask before destructive actions, external writes, purchases, or material scope expansion.

State this boundary once. Do not repeat approval warnings in every module.

## Assurance And Agent Budget

Assurance is about consequence, not implementation difficulty.

- `fast`: clear, localized, reversible; 0 subagents; no durable plan or agentic final review.
- `standard`: moderate scope or uncertainty; at most 1 subagent total, used only at the task's real bottleneck.
- `assurance`: auth/security/permissions/payments, destructive data or migrations, infra/deploy, concurrency, public contracts, broad blast radius, or equivalent risk; declare a task-wide budget, default 3 total, with at most 2 reviewers in one round.
- explicit audit: use the bounded audit budget selected by `audit-flow`.

The budget is a ceiling, never a quota. Parent Max/Ultra does not raise it. Multiple skills, files, checklist items, or workflow phases do not create independent launch budgets.

Launch a subagent only for concrete parallel speedup, noisy-context isolation, or independent high-risk judgment. Authorization is permission, not activation. Prefer local execution for tightly coupled, short, critical-path work. Reuse an existing agent for focused follow-up instead of launching another phase-specific agent.

Skills and plans route by semantic `work_class` and `agent_role`. Exact model and reasoning settings live in canonical agent TOMLs. If a named role is unavailable, continue locally unless independent review was explicitly required; do not silently upgrade models or add agents.

## Verification And Stop Contract

- `fast`: one targeted verification bundle plus minimal diff/scope sanity.
- `standard`: one targeted bundle; add one integration check only when the change crosses a real boundary.
- `assurance`: risk-specific checks plus required integration evidence.

Do not rerun the same check while the diff and relevant environment are unchanged. Repeat only after relevant edits, inconclusive evidence, or a changed external state. During active user testing, batch small corrections and verify once before completion, commit, PR, or handoff.

Stop when all scoped acceptance criteria pass, required verification is green, and no material blocker remains. `LOW`, cosmetic, speculative, or out-of-scope polish does not extend the task unless requested.

## Shared Engineering Constraints

- Never disable, weaken, suppress, or bypass lint/test rules; treat lint warnings as work.
- Avoid unrelated refactors, placeholders, unwired artifacts, and silent scope shrink.
- Keep touched code files focused and below 500 lines unless an explicit approved exception applies.
- Do not claim fixed, complete, or ready without fresh relevant evidence.
- Before drafting a PR/MR, inspect local templates or recent examples when available.

Use `workflow-mcp` only when `.workflow/` state or artifacts are actually needed. Use `using-agent-memory` for the single final durable-memory decision; other workflow modules must not duplicate its policy.
