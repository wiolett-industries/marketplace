# Code Quality Reviewer Prompt Template

Use this template when dispatching the primary reviewer during a task-level review loop.

**Purpose:** Verify the implementation is correct, maintainable, and aligned with the task after spec compliance passes.

```
Codex review agent (`workflow-code-reviewer`)

Scope:
- WHAT_WAS_IMPLEMENTED: [from implementer's report]
- PLAN_OR_REQUIREMENTS: Task N from [plan-file]
- BASE_SHA: [commit before task]
- HEAD_SHA: [current commit]
- DESCRIPTION: [task summary]

Extra focus:
- file responsibility and boundary clarity
- decomposition and testability
- conformance to the intended task structure
- large file growth introduced by this change
```

The reviewer should return the standard workflow review structure:
- Critical
- Important
- Minor
- Notes
- Verdict
- Review Summary
