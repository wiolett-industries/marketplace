---
name: Plan Review
description: Use after writing or revising an implementation plan, before coding begins, to verify requirement coverage, dependency sanity, wiring completeness, and to catch hidden scope reduction
---

# Plan Review

Review the plan as if execution has not started yet and you are trying to stop avoidable rework.

The goal is not to praise the plan. The goal is to find the missing requirement, broken dependency, unwired artifact, or softened scope before implementation burns time.

## When to Use

Use this skill when:
- a new implementation plan was just written
- a plan was heavily revised after feedback
- the task is large, risky, or cross-cutting
- execution would be expensive enough that catching plan flaws early matters

## Review Standard

Check the plan against the approved direction, not against whether it merely looks detailed.

Review these dimensions:

1. Requirement coverage
   Every approved requirement, decision, and success criterion should map to one or more concrete tasks.

2. Decision fidelity
   Locked user decisions must be implemented as approved.
   Flag any hidden reinterpretation, simplification, or downgrade.

3. Wiring completeness
   Plans must wire artifacts together, not just create them.
   Components need consumers.
   APIs need callers.
   Models need read/write paths.
   State needs display paths.

4. Dependency correctness
   Task ordering should make sense.
   Later tasks should not depend on outputs the plan never creates.
   Parallelizable work should be truly independent.

5. Verification quality
   Tasks should include meaningful verification, not vague "run tests" filler.
   The plan should prove delivery, not just file creation.

6. Scope sanity
   If a plan is too large or too tangled to execute reliably, split it.
   Do not let oversized plans pass just because they are ambitious.

## Scope Reduction Red Flags

Treat these as blockers unless the user explicitly approved the reduction:

- "v1"
- "basic version"
- "placeholder"
- "stub"
- "for now"
- "wire later"
- "future enhancement"
- "minimal implementation"
- "static for now"

If the plan uses those phrases to reduce an approved requirement, the right fix is to revise or split the plan.

## Output

Return one of:

- `PLAN_PASS`
- `PLAN_REVISE`

When revisions are needed, list findings in descending severity:

- `Blocker`
- `Important`
- `Minor`

Each finding should include:
- what is wrong
- where it appears in the plan
- why it matters
- how to fix it

## Decision Rule

Do not pass a plan that:
- drops approved scope
- contradicts approved decisions
- creates artifacts without their required wiring
- lacks meaningful verification
- is too large to execute reliably as written
