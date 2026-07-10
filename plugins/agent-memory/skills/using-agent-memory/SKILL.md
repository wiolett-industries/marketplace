---
name: using-agent-memory
description: Use at conversation start, after compaction or context recovery, and before Agent Memory reads or writes to decide whether durable global or project knowledge can materially change the task. Keep startup reads focused, and do not mutate memory during read-only or no-edits work unless the user explicitly asks to remember something.
---

# Using Agent Memory

Agent Memory is the MCP-backed durable memory system. It is separate from Codex built-in memory, chat history, and `.workflow/` artifacts. Use Codex built-in memory only as background; use Agent Memory MCP for durable repo facts and reusable workflows when its tools are available.

## Startup Gate

At conversation start or after compaction, decide whether durable knowledge can change the answer or execution path.

- For repo workflow, setup, architecture, recurring failures, prior decisions, or ambiguous non-trivial work, run one focused `memory_query` after the repo root is known.
- Query `global` only when a cross-project user preference or stable work habit could matter.
- Skip the MCP read for self-contained facts, trivial formatting, translation, or work whose outcome cannot depend on prior context.
- Escalate to `memory_recall`, `memory_list`, or `memory_inspect` only when the focused query identifies a relevant entry, the index appears stale, or memory health itself is under investigation.

Pass the absolute `workspace_root` for project reads and writes whenever server cwd may differ from the repo. An empty project result is not proof that memory is absent until the root and index/deep view have been checked.

## Action Boundary

Memory reads are read-only. Memory writes are durable state changes.

- If the user says read-only, no edits, without changes, or equivalent, do not call `memory_save`, `memory_update`, or other mutation tools unless the same request explicitly asks to remember or correct memory.
- Before the final response for completed non-trivial work, make one local memory decision. Call a write tool only when a durable reusable lesson actually exists.
- Planning discussion, speculative direction, raw progress, and one-off edits normally produce no memory write.
- Other skills may point to this decision but must not restate or expand it.

## What To Save

Use `global` only for durable cross-project preferences, communication habits, tool choices, and model-behavior requirements. Use `project` only for durable repo-specific setup, build, release, architecture, integration, root-cause, or verification knowledge.

Never save secrets, credentials, private webhook values, raw session summaries, obvious code facts, temporary progress, speculative plans, or project facts in global memory. Preserve negation and ownership exactly when updating constraints.

Prefer `memory_update` when an existing canonical memory covers the same decision or workflow. Use `memory_save` only for a genuinely new durable fact. The memory gate remains authoritative; do not bypass it.

## Recovery And Completion

After compaction, recover durable preferences from Agent Memory and active execution state from `.workflow/`; do not reconstruct either from chat when authoritative artifacts exist.

Stop after the focused read or single justified write. Do not perform graph maintenance, broad listing, or repeated recall as routine finalization.

Read [references/operations.md](references/operations.md) only when diagnosing empty/stale memory, choosing lower-level tools, performing graph/maintenance work, or handling project `.memory/` files.
