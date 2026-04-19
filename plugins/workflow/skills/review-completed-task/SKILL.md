---
name: Review Completed Task
description: Use after a task or plan section is finished to run a focused review loop before moving on
---

# Review Completed Task

Use this skill after a meaningful task, subtask batch, or plan section is complete.

**Goal:** catch problems while the change is still small.

## When to Use

Use this skill when:
- a task from a plan is done
- a subagent finished a chunk of work
- a feature section is complete and you want a fast checkpoint

Do not use this skill for:
- tiny edits where the diff is trivial
- final review of a large or risky change

## Workflow

1. Define the review scope.
   Include the exact task, diff range, and requirement or plan reference.

2. Dispatch `workflow-code-reviewer`.

3. Review the findings.
   - fix all `Critical`
   - fix all `Important`
   - optionally defer `Minor`

4. If code changed, rerun the same review once with fresh reviewer context.

5. Move on only when the review comes back with no `Critical` and no `Important`.

## Output Expectations

Treat the review as a gate, not a suggestion dump.

- `Critical` or `Important` findings block moving to the next task
- `Minor` findings can be deferred if the user accepts that tradeoff

## Integration

- default review checkpoint for `subagent-driven-development` when the `multi-agent-workflows` plugin is installed
- good batch checkpoint for `executing-plans`
- should happen before claiming a task is really done
