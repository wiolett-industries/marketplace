---
name: Review Change
description: ALWAYS use after meaningful implementation work is completed and before handoff, with strict gates for task review, feature review, and high-risk dual review depending on change size and risk
---

# Review Change

This is the single review skill for the `workflow` plugin.

Use it as a hard gate, not as a suggestion pass.

For frontend changes where real in-browser behavior matters, especially auth/session flows or delayed client-side redirects, combine this review with `Using Live Browser Debug` instead of relying only on code inspection.

## Activation Rule

Always use this skill when meaningful implementation work is finished and you are about to:

- move to the next task
- hand off a completed feature
- discuss merge or PR options
- claim the change is properly reviewed

Choose the strongest review mode that matches the actual risk.

If review should clearly happen, do not skip it just because the change "looks fine."

## Review Modes

### `task`

Use when:
- a task from a plan is done
- a subagent finished a chunk of work
- a feature section is complete and you want a fast checkpoint

Gate:
- no `Critical`
- no `Important`

Use this to catch problems while the change is still small and cheap to correct.

### `feature`

Use when:
- a large feature is complete
- multiple tasks have accumulated into one deliverable
- the change is bigger than a task review but does not need dual review

Gate:
- no `Critical`
- and by default no `Important`

This is the default final review for larger non-risky changes.

### `high-risk`

Use when:
- the change is breaking
- the work touches auth, billing, infra, migrations, or data handling
- the refactor has broad blast radius
- the user wants codebase-wide verification

Gate:
- run `workflow-code-reviewer` and `workflow-risk-reviewer` in parallel
- no `Critical`
- no `Important`
- two clean rounds in a row

This is for changes where one reviewer perspective is not enough.

## Reviewer Roles

For `task` and `feature`, use:

- `workflow-code-reviewer`
  Focus:
  - correctness
  - requirements alignment
  - regression risk
  - verification quality
  - maintainability

For `high-risk`, use both:

- `workflow-code-reviewer`
  Focus:
  - correctness
  - requirements alignment
  - regressions
  - tests
  - maintainability

- `workflow-risk-reviewer`
  Focus:
  - blast radius
  - compatibility
  - migration hazards
  - operational risk
  - codebase-wide consequences

## Workflow

1. Define the review scope.
   Include:
   - what was implemented
   - the relevant task, plan, or requirement reference
   - the diff range or file set
   - the selected review mode: `task`, `feature`, or `high-risk`

2. Dispatch the correct reviewer set.
   - `task` or `feature`: `workflow-code-reviewer`
   - `high-risk`: `workflow-code-reviewer` and `workflow-risk-reviewer`

3. Fix blocking findings.
   Always fix:
   - all `Critical`
   - all `Important`

   `Minor` findings may be deferred only if doing so is an explicit choice, not silent drift.

4. Re-review with fresh context if code changed.
   - do not keep replying to the same reviewer thread as if that were a clean new pass
   - rerun the selected review mode with fresh reviewer context

5. Stop only when the gate for the selected mode is satisfied.

### Additional `high-risk` rule

For `high-risk`, track a clean streak.

A round is clean only if both reviewers report:
- no `Critical`
- no `Important`

Stop only after two clean rounds in a row.

Any code change resets the streak to zero.

## Practical Mode Selection

Choose `task` when:
- you just finished one planned task
- the changed surface is still narrow
- you want to prevent issues from compounding into later tasks

Choose `feature` when:
- multiple tasks now form one meaningful deliverable
- the code should be treated as one reviewed unit before handoff

Choose `high-risk` when:
- the change can affect data, auth, migrations, infra, billing, or cross-cutting behavior
- the user explicitly asks for full-codebase verification
- you would be uncomfortable relying on only one reviewer perspective

## Hard Rules

- `task` review is the default checkpoint after meaningful task completion
- `feature` review is the default final review for larger non-risky changes
- `high-risk` review replaces `feature` review when the blast radius is real
- do not downgrade a risky change into a lighter review mode to save time
- do not claim a change is reviewed while blocking findings remain
- do not treat review as optional if the next step depends on correctness
- do not move on to the next task while the current review mode still has blocking findings

## Output Expectation

Treat review output as structured gate information:

- `Critical` and `Important` block progress
- `Minor` can be consciously deferred
- verdict should tell you whether the selected review mode is actually satisfied

## Anti-Patterns

- using `task` review for a migration just because it is faster
- running one review pass and treating it as final after code changed
- accepting unresolved `Important` issues without stating that tradeoff explicitly
- calling a risky change "reviewed" after only one reviewer perspective

## Integration

- use after each meaningful task or batch in `executing-plans`
- use after each task in `subagent-driven-development` when that plugin is installed
- use near the end of `feature-development`
