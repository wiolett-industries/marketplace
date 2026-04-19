---
name: Using Workflow
description: ALWAYS use at conversation start and after every compaction or context reset to decide which workflow skills should guide the current task
---

# Using Workflow

Load this skill at the start of every conversation and again after every compaction, context reset, or loss of working context.

Do not wait for the user to mention workflow explicitly. Re-evaluate the task through the workflow lens before normal execution.

## Purpose

This is the entry skill for the `workflow` plugin.

Use it to decide which workflow skills should shape the current session, especially:

- `Brainstorming`
- `Feature Development`
- `Writing Plans`
- `Executing Plans`
- `Systematic Debugging`
- `Review Change`
- `Verification Before Completion`
- `Using Git Worktrees`

Also consider related plugins when they clearly fit the task:

- `Ask Questions` when the request is still ambiguous or may be larger than it first appears
- `Scan Existing Codebase` when repo context is cold or the task needs grounded architecture context
- `Using UI Contract Review` for substantial frontend work
- `Spike Investigation` when feasibility or approach is still uncertain
- `Using Multi-Agent Workflows` when the work should be parallelized or executed through per-task subagents
- `Using Agent Memory` when durable user preferences or repo-specific operational knowledge are likely to matter

## Session-Start Rule

At the beginning of every conversation, and again after compaction:

1. Identify whether the task is discovery, planning, execution, debugging, review, or verification.
2. Load the most relevant workflow skill before continuing.
3. If a related plugin clearly fits, activate it alongside the workflow skill instead of forcing workflow to cover everything itself.
4. If more than one workflow stage applies, use the earliest blocking stage first.

Examples:

- unclear feature request -> `Brainstorming`
- approved multi-step task -> `Writing Plans`
- existing plan to carry out -> `Executing Plans`
- bug or failing test -> `Systematic Debugging`
- finished task or feature -> one of the review skills
- about to claim success -> `Verification Before Completion`

## Hard Rule

Do not jump straight into implementation, review, or “done” claims if a workflow skill should clearly be active first.

If the task looks non-trivial, assume a workflow skill is needed and choose it explicitly.

## Compaction Rule

After compaction or context loss, treat the session like a fresh start:

- reload this skill
- identify the current workflow stage again
- re-activate the appropriate workflow skill before continuing
