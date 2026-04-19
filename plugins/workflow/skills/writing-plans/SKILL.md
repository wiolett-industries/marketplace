---
name: Writing Plans
description: ALWAYS use when approved requirements or an approved implementation direction need to become a complete implementation plan, including codebase exploration, draft planning, self-review, and final plan creation in plan mode
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree (created by brainstorming skill).

**Save plans to:** `docs/workflow/plans/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)

## Required Workflow

Follow this exact sequence:

1. Explore the codebase broadly enough to understand the repo shape and patterns
2. Deeply explore the parts directly related to the request
3. Write a comprehensive implementation plan draft
4. Self-review that draft and harden it
5. Switch to plan mode and create the complete implementation plan, then present it to the user

Do not skip the exploration or the review stage.

Do not jump straight into plan mode with shallow context.

If the request is still materially ambiguous before planning starts, activate `Ask Questions` first.

If repository context is still cold, use `Scan Existing Codebase` before writing the draft.

If durable repo knowledge or persistent user instructions may affect the plan, activate `Using Agent Memory` before finalizing direction.

## Scope Check

If the approved direction covers multiple independent subsystems, it should have been broken into sub-project plans during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## Decision Fidelity

Approved decisions are part of the contract, not suggestions.

- Treat approved user constraints and design decisions as locked.
- Do not quietly reinterpret them into something easier, smaller, or more generic.
- Do not write fake staging language such as "v1", "placeholder", "basic version", "static for now", "wire later", or "future enhancement" unless the user explicitly approved that reduction.
- If the approved scope does not fit into a clean plan, split the work. Do not shrink it silently.

When a request is too large for one plan:
- propose the split explicitly
- preserve the original requirements across the smaller plans
- make clear what each plan will fully deliver

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` by default, or `subagent-driven-development` when the `multi-agent-workflows` plugin is installed and you want same-session multi-agent execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Remember
- Exact file paths always
- Complete code in every step — if a step changes code, show the code
- Exact commands with expected output
- DRY, YAGNI, TDD, frequent commits

## Draft Review Standard

After writing the draft plan, review it as if execution has not started yet and you are trying to stop avoidable rework.

This is a self-review checklist, not a separate skill dispatch.

**1. Requirements coverage:** Skim each approved requirement or design decision. Can you point to a task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

**4. Wiring completeness:** Are you only creating artifacts, or are you also wiring them together? Components need imports and consumers. Routes need callers. Data models need read/write paths. State needs rendering. A plan that creates pieces without their connections is incomplete.

**5. Dependency correctness:** Task ordering should make sense. Later tasks should not depend on outputs the plan never creates. If work can run independently, that independence should be explicit and real.

**6. Scope reduction scan:** Check for any language that silently reduces what was approved:
- "simple version"
- "basic version"
- "placeholder"
- "stub"
- "wire later"
- "future enhancement"
- "for now"

If any of that language appears without explicit user approval, rewrite the plan or split the work.

**7. Verification quality:** Tasks should include meaningful verification, not vague "run tests" filler. The plan should prove delivery, not just file creation.

**8. Size sanity:** Keep each plan and task small enough to execute cleanly.
- Prefer 2-3 meaningful tasks per plan section
- Prefer focused file sets over huge cross-cutting batches
- If a task touches too many files or concerns, split it before execution

If you find issues, fix them inline. If you find a requirement with no task, add the task before switching to plan mode.

## Finalization

After the draft is reviewed and fixed:

1. Switch into plan mode, if your environment supports it
2. Create the complete implementation plan in its final form
3. Save it to `docs/workflow/plans/...`
4. Present the complete implementation plan to the user

The user should see the final plan after it has already gone through the full draft review standard.

## Execution Handoff

After saving the plan:

- if the `multi-agent-workflows` plugin is installed, offer execution choice:

  **"Plan complete and saved to `docs/workflow/plans/<filename>.md`. Two execution options:**

  **1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

  **2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

  **Which approach?"**

  **If Subagent-Driven chosen:**
  - **REQUIRED SUB-SKILL:** Use `subagent-driven-development`
  - Fresh subagent per task + spec review + task review loops

  **If Inline Execution chosen:**
  - **REQUIRED SUB-SKILL:** Use `executing-plans`
  - Batch execution with checkpoints for review

- if the `multi-agent-workflows` plugin is not installed:
  - report that the plan is complete and saved
  - recommend `executing-plans` as the default execution path
  - do not ask the user to choose between unavailable workflows
