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

## Always-On Coding Discipline

These rules apply to every code-writing task handled through the workflow plugin:

- If the project has a linter, respect it as a source of truth. Do not disable, suppress, remove, or work around lint rules to make the output look clean.
- Treat lint warnings as work to fix, not noise to ignore. If a linter reports warnings or minor findings, address them.
- Before coding, identify the relevant lint command or lint configuration when it exists. Carry that command into planning, execution, review, and final verification.
- Keep files focused on one clear responsibility. Avoid mixing unrelated domains, UI, data access, orchestration, parsing, and infrastructure in one file.
- Keep code files under 500 lines. Treat 500 lines as a hard limit; crossing it is strongly discouraged and should trigger decomposition into smaller files.
- If a change would push an existing file toward or past the limit, split the touched responsibility instead of adding more mixed-purpose code.

## Compaction Rule

After compaction or context loss, treat the session like a fresh start:

- reload this skill
- identify the current workflow stage again
- re-activate the appropriate workflow skill before continuing
