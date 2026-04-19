---
name: Ask Questions
description: Use when a request is materially ambiguous and different reasonable interpretations would lead to different work
---

# Ask Questions

## Goal

Ask the smallest useful set of questions needed to avoid doing the wrong work.

This skill prevents two opposite mistakes:

- starting implementation while the request is still materially ambiguous
- bothering the user with questions that could have been answered by a quick low-risk check

## Use This Skill When

Use this skill when one or more of these are still unclear after a quick sanity check:

- the actual outcome the user wants
- what is in scope and out of scope
- what “done” means
- which constraints are mandatory
- what level of risk is acceptable

If two or more reasonable interpretations would cause meaningfully different implementation work, use this skill.

## Do Not Use This Skill When

Do not use this skill when:

- the request is already specific enough to act on safely
- a quick low-risk read of local context can resolve the uncertainty
- the missing detail does not affect the direction, scope, or safety of the work

## Material Ambiguity

Treat ambiguity as material only if the missing answer would change at least one of:

- implementation approach
- affected files or systems
- user-visible behavior
- compatibility target
- rollout or data-safety handling
- whether the work should happen at all

If it would not change any of those, do not block on it.

## Workflow

### 1. Try the cheap safe check first

Before asking anything, see whether the missing detail can be answered by a quick low-risk read.

Examples:
- reading the touched file to see the local pattern
- checking AGENTS.md for constraints
- checking versions already declared in the repo

Do not ask the user for facts you can verify safely yourself.

### 2. Identify the minimum blocking unknowns

Only ask questions that actually choose the direction of the work.

Good candidates:
- scope boundaries
- expected behavior
- compatibility requirements
- risk constraints
- whether to prefer minimal change or broader cleanup

Bad candidates:
- speculative preferences that do not affect implementation
- non-blocking nice-to-haves
- facts already available locally

### 3. Ask a compact first pass

Ask 1-3 questions in the first pass.

Good questions are:
- short
- concrete
- easy to answer
- designed to eliminate whole branches of work

Prefer:
- yes/no
- either/or
- short enumerated options

When useful, include a recommended default.

Example:

```text
Before I start, I need two decisions:

1. Scope:
   a) Minimal targeted change (recommended)
   b) Broader cleanup in the same area

2. Compatibility:
   a) Current project defaults only (recommended)
   b) Preserve older compatibility too
```

### 4. Do not commit to a direction before answers

Until the blocking questions are answered:

- do not edit files
- do not present a detailed implementation plan built on an unconfirmed assumption
- do not behave as if one interpretation has already been chosen

You may continue with clearly safe discovery work if it does not lock in a direction.

### 5. If the user wants speed over clarification

If the user tells you to proceed anyway:

1. state the assumptions you will use
2. keep them short and explicit
3. proceed only once those assumptions are accepted or corrected

Example:

```text
I can proceed on these assumptions:
1. minimal change, not a refactor
2. target current project defaults only
3. no data migration or rollback requirements
```

### 6. Confirm the interpretation briefly

Once clarified, restate the task in 1-3 sentences before moving into planning or implementation.

Include:
- chosen scope
- key constraints
- what success looks like

## Anti-Patterns

- asking broad open-ended questions when a constrained question would do
- asking five questions when one would choose the direction
- asking for repo facts you could have checked yourself
- continuing as if the answer is obvious when multiple real interpretations exist
- treating every uncertainty as blocking even when a safe default exists
