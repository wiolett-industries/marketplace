---
name: Context Discovery
description: Use when requirements, product intent, architecture, constraints, or tradeoffs need to be discovered before planning or execution
---

# Context Discovery

Gather enough context for a decision-complete plan or confident execution decision. Do not optimize for fewer questions; optimize for not building the wrong thing.

Use after `Intent Gate` when goal, scope, audience/operator, architecture, data/API/CLI/UI contracts, quality bar, risk, review depth, or next module remains unclear. Skip only for narrow mechanical tasks where repo inspection and user request already determine the safe action.

## Process

1. Inspect discoverable repo facts first: manifests, docs, related files, tests, recent patterns. For broad or multi-file exploration, delegate to `workflow_explorer` so large reads stay in its context and the orchestrator gets only a compact findings report.
2. Ask every material remaining question; prefer interactive questions when supported.
3. Ask questions that choose real branches: scope, user-visible behavior, compatibility/migration, ownership/persistence, verification rigor, split strategy, design tradeoff.
4. Do not ask for discoverable facts; look them up.
5. For high-impact ambiguity, keep asking until answers would no longer change the plan.

## Spike Mode

If feasibility is uncertain, run a bounded spike:

1. State the uncertainty.
2. Run 1-3 disposable experiments or read-only investigations.
3. Record evidence/recommendation in plan artifacts when a plan-run exists; otherwise summarize in chat.
4. Do not turn a spike into production implementation.

## Output

Before planning/execution, produce or confirm: approved goal, success criteria, scope, non-goals, constraints, risks, complexity (`simple`/`medium`/`complex`/`very_complex`), and recommended next module. If enough detail already exists, state captured context and continue.
