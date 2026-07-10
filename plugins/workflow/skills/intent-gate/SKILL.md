---
name: intent-gate
description: Use as a brief local routing step before non-trivial planning, execution, review, refactoring, debugging, or design when a shallow reading could change scope, risk, or user-visible behavior. Keep it silent when intent is clear; it does not imply an artifact or subagent.
---

# Intent Gate

Determine what the user actually wants, whether the obvious reading is safe, and which primary path and assurance profile fit. This is a brief local routing decision, not optional ceremony and not an automatic subagent step.

## Gate

1. State the intended outcome internally in one sentence.
2. Identify only misreads that could materially change scope, safety, or user-visible behavior.
3. Inspect cheap repository facts that can resolve them.
4. Choose complexity (`simple`, `medium`, `complex`, `very_complex`) for execution shape and assurance (`fast`, `standard`, `assurance`, explicit audit) for risk.
5. Choose the next module or direct path.
6. Ask only when remaining ambiguity is material and a reasonable assumption would be costly, irreversible, or behavior-changing.

When confidence is high, continue without printing a gate report. When a decision must be exposed, report only intent, assumption/question, assurance, and next path.

## Independent Intent Review

Use read-only `workflow_intent_reviewer` only when all are true:

- assurance risk applies;
- material ambiguity remains after cheap inspection;
- independent interpretation could prevent a high-impact misread;
- the task-wide agent budget permits it.

Routine implementation, bounded reading, clear corrections, and multiple applicable skills never justify this reviewer. If unavailable, continue locally unless the user explicitly requires independent intent review.

Stop the gate as soon as the workflow path is safe to choose.
