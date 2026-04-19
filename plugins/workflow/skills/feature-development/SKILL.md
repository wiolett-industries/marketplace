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
   Clarify the request, scope boundaries, and success criteria.

2. Codebase Exploration
   Use the specialist workflow agents to understand the relevant code and patterns. If the codebase is unfamiliar and the `codebase-scan` plugin is installed, run `Scan Existing Codebase` first.

3. Clarifying Questions
   Resolve the material unknowns before choosing a direction.

4. Architecture Direction
   Choose one implementation approach that fits the codebase and the user's constraints. If feasibility is uncertain and the `spike-investigation` plugin is installed, use `Spike Investigation` before committing to a build direction.

5. Implementation
   Build only after the direction is approved or clearly confirmed. If the work is frontend-heavy and the `ui-contract-review` plugin is installed, use `Define UI Contract` before locking the implementation plan.

6. Quality Review
   Use `Review Completed Task`, `Review Completed Feature`, or `Review High-Risk Change` depending on change size and risk.

7. Summary
   Explain what was built, what was decided, and what remains.

## Execution Notes

- Use plan tracking throughout.
- Read the files returned by exploration before making architecture claims.
- Do not start implementation without explicit approval.
- Use `workflow-code-reviewer` for primary review and `workflow-risk-reviewer` when the change is risky enough to justify dual review.
