---
name: Review Completed Feature
description: Use when a large completed task or feature needs a deeper reviewer loop before handoff or merge discussion
---

# Review Completed Feature

Use this skill for a large finished change that needs a serious review pass before you treat it as done.

**Goal:** keep running a strong single-reviewer loop until the implementation is clean enough to hand off.

## When to Use

Use this skill when:
- a large feature is complete
- multiple tasks have accumulated into one meaningful deliverable
- the change is bigger than a simple task review but does not need dual review

## Workflow

1. Define review scope.
   Include:
   - what was implemented
   - relevant plan or requirements
   - diff range or file set

2. Dispatch `workflow-code-reviewer`.

3. Fix all `Critical`.

4. Fix all `Important` unless the user explicitly chooses to defer them.

5. Re-run the review with a fresh reviewer after each fix round.

6. Continue until the reviewer returns:
   - no `Critical`
   - and, by default, no `Important`

If the user explicitly wants to defer remaining `Important` items, present that clearly instead of silently treating the review as clean.

## Rules

- each review round must use fresh context
- any code change resets the review state
- do not claim the change is fully reviewed while `Critical` or unresolved `Important` items remain

## Integration

- use near the end of `feature-development`
- use after all tasks finish in `executing-plans`
- use as the final review stage in `subagent-driven-development` for non-risky changes when the `multi-agent-workflows` plugin is installed
