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

Read the request and cheap repository facts; run a local `intent-gate` for non-trivial work. After compaction or when `.workflow/` exists, call `workflow_status` once and resume only an active run. Select one primary path and profile, then load only its current phase. Read this router once per task; same-task follow-ups do not restart routing.

## Context Discipline

Plans/compaction never reset discovery. Use named surfaces; no inventory, hypotheticals, future-proofing, or unrelated refactors. Expand only for required behavior, observed failure, or normal-path risk. UI requires a pre-edit receipt: target, shared path/export, analogous layout, decision, and structural check. A named reuse instruction is an architecture acceptance criterion; visual equivalence fails. custom primitives need explicit user approval and evidence no candidate fits. At cap, proceed only if uncertainty cannot change acceptance; otherwise ask/`NEEDS_CONTEXT`.

## Action Boundary

Discussion, diagnosis, and review authorize inspection/reporting, not writes. Change/build/fix authorizes scoped edits and non-destructive validation; an explicit durable plan/audit authorizes its artifacts. Read-only, no-edits, without changes, or equivalent blocks code, workflow-state, memory, and external mutations unless separately authorized. Ask before destructive actions, external writes, purchases, or material scope expansion.

## Assurance And Agent Budget

Assurance is about consequence, not implementation difficulty.

- `fast`: clear, localized, reversible; 0 subagents; no durable plan or agentic final review.
- `standard`: moderate scope or uncertainty; budget 1 subagent by default and use it at the most valuable independent investigation, review, or implementation boundary. A second is allowed only when it has a disjoint role and a concrete payoff.
- `assurance`: auth/security/permissions/payments, destructive data or migrations, infra/deploy, concurrency, public contracts, broad blast radius, or equivalent risk; declare a task-wide budget, default 3 total, with at most 2 reviewers in one round.
- explicit audit: use the bounded audit budget selected by `audit-flow`.

The budget is a ceiling, never a quota. Parent Max/Ultra does not raise it. Multiple skills, files, checklist items, or workflow phases do not create independent launch budgets.

Authorization is permission, not activation or an explicit request; it is also not a reason to default every nontrivial task to local work. Consider one focused agent only after a bounded local lookup identifies an exact unanswered question and a compact report will replace parent reads. This may apply to diagnosis with an unclear causal chain, repository exploration spanning several surfaces, and code/plan review where independent reading can find a real regression or scope gap. An unfamiliar repository, a fresh plan, or “need more context” is not enough; use `workflow_explorer` only for a named question across specific surfaces, never for generic orientation or a project inventory.

Keep work local only when the answer is contained in a small known surface, the causal path is already clear, or the coordination cost is greater than the likely new evidence. Do not fan out merely by file count, checklist length, or applicable skills. Reuse an agent for focused follow-up instead of launching another phase-specific agent.

## Separate Task Chats

Read [delegation-and-task-chats.md](references/delegation-and-task-chats.md) before delegating or creating a user-visible task/chat. A task/chat is different from an internal subagent and does not consume its budget.

Skills and plans route by semantic `work_class` and `agent_role`. Exact model and reasoning settings live in canonical agent TOMLs. If a named role is unavailable, continue locally unless independent review was explicitly required; do not silently upgrade models or add agents.

## Verification And Stop Contract

Use one targeted verification bundle for `fast`/`standard` (plus integration only across a real boundary), and risk-specific evidence for `assurance`. Do not repeat unchanged checks. Stop when scoped acceptance and verification pass; low, cosmetic, or out-of-scope polish does not extend the task.

Before final output, close every realized active run: call `workflow_plan_complete` for an active completed plan or `workflow_audit_complete` for an active completed audit. A phase update is not completion and does not clear the root active pointer. Leave a run active only when it is genuinely blocked or intentionally awaiting more work, and report that state explicitly.

Use `workflow-mcp` only when `.workflow/` state or artifacts are actually needed. Use `using-agent-memory` for the final memory completion latch; other workflow modules must not duplicate its policy.
