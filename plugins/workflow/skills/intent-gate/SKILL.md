---
name: Intent Gate
description: Use before non-trivial planning, execution, or review to verify the user's real intent and avoid shallow interpretation
---

# Intent Gate

Use this skill before choosing a workflow path for non-trivial work.

The goal is to answer: what does the user actually want, and is the obvious reading safe?

## Trigger

Use when the user asks for:

- planning
- implementation
- refactoring
- review
- architecture or product decisions
- multi-step repo work
- anything where the wrong interpretation would change files, scope, or risk

Skip only when the request is clearly mechanical and low risk.

## Process

1. Restate the surface request in one sentence.
2. Identify possible hidden intent or misreads.
3. Inspect cheap repo facts that can disambiguate the request.
4. Estimate complexity: `simple`, `medium`, `complex`, or `very_complex`.
5. Decide whether context discovery is needed.
6. If material ambiguity remains, ask the user before planning or editing.

## Subagent Rule

For serious tasks, run a read-only intent agent when the environment supports subagents and subagent authorization is explicit.

Preferred model: `gpt-5.5 xhigh`.

Preferred custom agent: `workflow_intent_reviewer`.

If `workflow_intent_reviewer` is unavailable, stop the agentic intent step and report that workflow agent sync/setup is missing.

The agent prompt should ask for:

- likely user intent
- dangerous shallow interpretations
- missing constraints
- recommended workflow path
- complexity estimate

Do not let the intent agent edit files.

If authorization is not explicit, ask for workflow subagent authorization before spawning the intent agent. If the user does not authorize subagents, perform the intent gate locally and mark confidence lower when appropriate.

## Output Contract

Produce this before moving on:

```text
Intent: <what the user wants>
Confidence: high | medium | low
Possible misreads: <short list>
Questions needed: yes | no
Complexity: simple | medium | complex | very_complex
Next module: context-discovery | writing-plans | executing-plans | finalizing-plan | direct mechanical action
```

If `Questions needed` is `yes`, use interactive questions when available.
