---
name: Intent Gate
description: Use before non-trivial planning, execution, or review to verify the user's real intent and avoid shallow interpretation
---

# Intent Gate

Use before choosing a workflow path for non-trivial work. This is the default entry gate, not optional ceremony. Answer: what does the user actually want, and is the obvious reading safe?

Trigger for planning, implementation, refactoring, review, architecture/product decisions, multi-step repo work, workflow/MCP changes, or any request where misread scope would change files or risk. Skip only for clearly mechanical low-risk requests.

## Process

1. Restate surface request in one sentence.
2. Identify hidden intent or dangerous misreads.
3. Inspect cheap repo facts that disambiguate.
4. Estimate complexity: `simple`, `medium`, `complex`, `very_complex`.
5. Decide whether `Context Discovery` is needed.
6. Ask before planning/editing if material ambiguity remains.
7. Decide whether Workflow MCP state/artifact tools are needed; for `.workflow/` state or artifacts, use them when available.
8. If the task may save/update Agent Memory MCP project memory, enforce portability: memory content must use repo-relative paths or logical placeholders, never machine-local absolute filesystem paths. Treat `.memory/memories/`, `.memory/index/`, `.memory/embeddings/`, and `.memory/graph/` as commit-worthy shared memory artifacts, not local junk.

## Subagent

For serious tasks, use read-only `workflow_intent_reviewer` (`gpt-5.4 xhigh`) when subagents are authorized. If unavailable, stop the agentic intent step. If authorization is missing, ask once; if denied, run locally and lower confidence when appropriate.

Agent asks for likely intent, shallow misreads, missing constraints, recommended workflow path, and complexity. It must not edit files.

## Output

```text
Intent: <what the user wants>
Confidence: high | medium | low
Possible misreads: <short list>
Questions needed: yes | no
Complexity: simple | medium | complex | very_complex
Next module: context-discovery | writing-plans | executing-plans | finalizing-plan | direct mechanical action
```

If questions are needed, use interactive questions when available.
