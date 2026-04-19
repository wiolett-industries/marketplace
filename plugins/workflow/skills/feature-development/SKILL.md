---
name: Feature Development
description: Use when implementing a new feature or a substantial product change that needs discovery, codebase exploration, architecture decisions, staged implementation, and review
---

# Feature Development

Use this skill when the change is large enough that skipping discovery and design would likely create rework.

The goal is to move from request to implementation with:
- clarified scope
- grounded codebase context
- one explicit implementation direction
- review before completion

## When to Use

Use this skill when:
- the user wants to add a new feature
- the request touches multiple files or subsystems
- the right design is not obvious yet
- the change needs deliberate review before it is treated as done

Do not use this skill for:
- tiny one-file fixes
- isolated bugfixes with obvious root cause
- pure brainstorming with no codebase work yet

## Workflow

Follow this sequence:

1. Discovery
   Clarify the request, scope boundaries, and success criteria. If the request is still ambiguous or may be larger than it first appears, use `Ask Questions` before choosing a direction.

2. Codebase Exploration
   Use the specialist workflow agents to understand the relevant code and patterns. If the codebase is unfamiliar and the `codebase-scan` plugin is installed, run `Scan Existing Codebase` first.

3. Clarifying Questions
   Resolve the material unknowns before choosing a direction.

4. Architecture Direction
   Choose one implementation approach that fits the codebase and the user's constraints. If feasibility is uncertain and the `spike-investigation` plugin is installed, use `Spike Investigation` before committing to a build direction.

5. Implementation
   Build only after the direction is approved or clearly confirmed. If the work is frontend-heavy and the `ui-contract-review` plugin is installed, use `Using UI Contract Review` in `define` mode before locking the implementation plan.

6. Quality Review
   Use `Review Change` with the appropriate review mode depending on change size and risk.

7. Summary
   Explain what was built, what was decided, and what remains.

## Execution Notes

- Use plan tracking throughout.
- Read the files returned by exploration before making architecture claims.
- Do not start implementation without explicit approval.
- Use `workflow-code-reviewer` for primary review and `workflow-risk-reviewer` when the change is risky enough to justify dual review.
- If the work benefits from per-task subagents or parallel execution and the `multi-agent-workflows` plugin is installed, route execution through `Using Multi-Agent Workflows`.
- If durable user preferences or repo-specific operational knowledge are likely to matter, activate `Using Agent Memory`.
