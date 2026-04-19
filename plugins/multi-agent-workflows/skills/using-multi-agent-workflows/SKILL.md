---
name: Using Multi-Agent Workflows
description: ALWAYS use when work can be accelerated by parallel independent agents or when a substantial implementation plan should be executed through fresh per-task subagents and review loops
---

# Using Multi-Agent Workflows

This is the single coordination skill for the `multi-agent-workflows` plugin.

It covers two modes:

- `parallel` for independent investigations or bounded tasks
- `subagent-driven` for executing a substantial implementation plan in the current session

## Activation Rule

Always use this skill when either of these is true:

- there are 2 or more independent tasks, failures, or investigations that can proceed without shared state
- you have a substantial implementation plan and the work can be broken into task-sized units that benefit from fresh subagent context and review loops

If one of those is clearly true, do not default back to serial handling or manual in-session execution.

## Modes

### `parallel`

Use when:
- multiple failures have independent root causes
- several bounded investigations can run without depending on each other
- one task naturally decomposes into multiple read-only or non-overlapping subproblems

Core rule:
- dispatch one agent per independent problem domain
- let them work concurrently
- review and integrate the results after they return

Use this for:
- independent test failures
- bounded read-only investigations
- several disjoint codebase questions
- non-overlapping implementation tasks when the write scopes are clearly separate

Do not use `parallel` when failures are tightly related or the agents would interfere with each other.

### `subagent-driven`

Use when:
- you already have a real implementation plan
- tasks are substantial enough to deserve isolated execution
- the work is not so tightly coupled that every task must happen manually in one stream

Core rule:
- fresh implementer subagent per task
- spec compliance review first
- task review after each meaningful unit
- final review at the end

This is the default execution mode for substantial planned work in the current session when the tasks are not tightly coupled.

Prefer this over manual in-session execution when the plan is real and the work is not tightly coupled.

## Agent Roles

Use these plugin agents directly for the subagent-driven path:

- `multi-agent-implementer`
  - implements one scoped task
  - asks questions early
  - reports `DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, or `NEEDS_CONTEXT`

- `multi-agent-spec-reviewer`
  - verifies the implementation matches the task or plan exactly
  - checks for missing or extra work

- `multi-agent-task-reviewer`
  - runs the task-level quality review after spec compliance passes
  - returns the standard workflow review structure

## `parallel` Workflow

1. Identify independent domains.
   Group failures or investigations by root problem domain, not by superficial similarity.

2. Create focused agent tasks.
   Each agent should get:
   - one clear scope
   - one clear goal
   - constraints that prevent scope drift
   - a concrete expected output

3. Dispatch in parallel.
   Parallelism is only good when the tasks truly do not depend on each other.

4. Review and integrate.
   After the agents return:
   - read each summary
   - check for conflicts
   - run the relevant verification
   - integrate the results

## `subagent-driven` Workflow

1. Start from a real implementation plan.
2. Extract the task text and the exact context the implementer needs.
3. Dispatch `multi-agent-implementer` for one task.
4. Handle implementer questions or blockers before forcing progress.
5. Run spec compliance review with `multi-agent-spec-reviewer`.
6. Fix spec gaps.
7. Run task review with `multi-agent-task-reviewer`.
8. Fix blocking findings.
9. Mark the task complete only when the review gate is clear.
10. After all tasks, run the final review stage.

## Model Selection

Use the least powerful model that can reliably do the role:

- mechanical isolated implementation -> cheaper model
- integration or debugging -> standard model
- architecture or review -> strongest available model

Do not waste the strongest reviewer on trivial mechanical tasks if a smaller model can do them cleanly.

## Implementer Status Handling

Treat implementer status seriously:

- `DONE` -> proceed to review
- `DONE_WITH_CONCERNS` -> read concerns before review
- `NEEDS_CONTEXT` -> provide the missing context and re-dispatch
- `BLOCKED` -> change something: more context, a stronger model, or smaller task scope

Do not keep retrying unchanged when the implementer already told you it is blocked.

## Hard Rules

- do not make agents work in parallel on overlapping write scopes
- do not use subagent-driven execution without a real plan
- do not skip the review loops in subagent-driven mode
- do not collapse clearly parallel work into serial work out of habit
- do not dispatch multiple implementers in parallel against overlapping files
- do not make a subagent read a whole plan file when you can provide the exact task text and context

## Anti-Patterns

- "fix everything" prompts with no scoped task boundary
- parallelizing related failures that should be understood together first
- using subagent-driven mode for tightly coupled work with no real task boundaries
- skipping spec review because the implementer said it looked fine
