---
name: Review High-Risk Change
description: Use for breaking changes, migrations, risky refactors, and codebase-wide verification that need two parallel reviewer perspectives
---

# Review High-Risk Change

Use this skill when one reviewer is not enough.

**Goal:** run two different reviewer perspectives in parallel and keep looping until both come back clean twice in a row.

## When to Use

Use this skill for:
- breaking changes
- migrations
- authentication, billing, data, or infra changes
- risky refactors
- full-codebase or system-level verification

## Review Roles

Run both in parallel:

- `workflow-code-reviewer`
  Focus: correctness, requirements alignment, regressions, tests, maintainability

- `workflow-risk-reviewer`
  Focus: blast radius, compatibility, migration hazards, operational risk, system-level consequences

## Workflow

1. Define the review scope clearly.

2. Dispatch both reviewers in parallel with fresh context.

3. Consolidate findings.

4. Fix all `Critical` and all `Important` from both reviewers.

5. Re-run both reviewers with fresh context.

6. Track a clean streak.
   A round is clean only if both reviewers report:
   - no `Critical`
   - no `Important`

7. Stop only after **two clean rounds in a row**.

## Clean-Streak Rules

- any code change resets the streak to zero
- any `Critical` or `Important` in either review resets the streak to zero
- each round must use fresh reviewers, not follow-up messages to the same agent

## Why Two Clean Rounds

One clean round proves the current code survived one pass.
Two clean rounds reduce the chance that a risky issue slipped through due to prompt framing or reviewer blind spots.

## Integration

- use instead of `Review Completed Feature` for high-risk work
- use before merge discussion for breaking or codebase-wide changes
