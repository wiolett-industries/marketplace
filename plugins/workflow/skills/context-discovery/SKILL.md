---
name: Context Discovery
description: Use when requirements, product intent, architecture, constraints, or tradeoffs need to be discovered before planning or execution
---

# Context Discovery

Use this skill to gather enough context to make a decision-complete plan or a confident execution decision.

Do not optimize for asking fewer questions. Optimize for not building the wrong thing.

## Trigger

Use after `Intent Gate` when any of these remain unclear:

- real goal and success criteria
- in scope and out of scope
- target audience or operator
- architecture direction
- data, API, CLI, UI, or compatibility contract
- quality bar, risk tolerance, or review depth
- whether to plan, spike, review, or implement directly

Skip this skill only for narrow mechanical tasks where repo inspection and the user request already determine the safe action.

## Discovery Order

1. Inspect repo facts first: manifests, existing docs, related files, tests, and recent patterns.
2. Ask every material question that remains.
3. Prefer interactive questions when the environment supports them.
4. Use free-form chat only when the question cannot be expressed as meaningful choices.
5. For high-impact ambiguity, keep asking until the answer would no longer change the plan.

## Question Policy

Ask questions that choose between real branches:

- scope boundary
- user-visible behavior
- compatibility or migration strategy
- data ownership and persistence
- review/verification rigor
- whether to split a large request
- preferred tradeoff when there are multiple viable designs

Do not ask for discoverable facts. Look them up.

## Spike Mode

If feasibility is materially uncertain, run a bounded spike before planning:

1. State the concrete uncertainty.
2. Run 1-3 disposable experiments or read-only investigations.
3. Record evidence and recommendation in `.workflow/plans/<date-slug>/artifacts/` if a plan-run already exists, otherwise summarize in chat.
4. Do not turn a spike into production implementation.

## Output Contract

Before moving to planning or execution, produce or confirm:

- approved goal
- success criteria
- in-scope work
- non-goals
- constraints
- risks
- complexity: `simple`, `medium`, `complex`, or `very_complex`
- recommended next workflow module

If the user already supplied enough detail, state the captured context and continue.
