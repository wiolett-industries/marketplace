---
name: using-agent-memory
description: Use at conversation start, after compaction or context recovery, and before Agent Memory reads or writes to decide whether durable global or project knowledge can materially change the task. Keep startup reads focused, and do not mutate memory during read-only or no-edits work unless the user explicitly asks to remember something.
---

# Using Agent Memory

Agent Memory is the MCP-backed durable memory system. It is separate from Codex built-in memory, chat history, and `.workflow/` artifacts. Use Codex built-in memory only as background; use Agent Memory MCP for durable repo facts and reusable workflows when its tools are available.

## Retrieval Gate

At conversation start, after compaction, or before non-trivial repository work, decide whether durable knowledge can change the answer or execution path. Do not wait for the user to explicitly ask for memory.

- For non-trivial repository work, run one memory read after the repo root is known whenever prior decisions, conventions, failures, setup, architecture, or user preferences could affect the result.
- Use `memory_recap` when the task needs broad recovery across several memories; use `memory_query` for a focused question; use `memory_recall` only with a non-empty `memory_id` already returned by query/list/recap or named explicitly by the user. Never use `memory_recall` as the first semantic search or startup recall.
- Query `global` only when a cross-project user preference or stable work habit could matter.
- Skip the MCP read only for self-contained facts, trivial formatting, translation, or work whose outcome cannot reasonably depend on durable context.
- Escalate to `memory_recall`, `memory_list`, or `memory_inspect` only when the focused query identifies a relevant entry, the index appears stale, or memory health itself is under investigation.

Pass the absolute `workspace_root` for project reads and writes whenever server cwd may differ from the repo. When the user explicitly asks about another project or names its path, keep `scope: project` and pass that other project's absolute root to `memory_query` (focused) or `memory_recap` (broad); this reads only that project's store and never initializes it. Do not scan sibling projects or write to another root unless the user explicitly authorizes that operation. An empty project result is not proof that memory is absent until the root and index/deep view have been checked.

For recurring repository work, work resumed after compaction, or work that depends on several related memories, call `memory_reconciliation_status` once after the task-appropriate read. Check `global` only when global memory is relevant. If an initialized scope is `due`, briefly offer the user a project or global reconciliation; do not interrupt small work, automatically reconcile, or record it merely because it is overdue. Use `memory_reconciliation_record` only after the user-approved reconciliation was actually completed.

## Action Boundary

Memory reads are read-only. Memory writes are durable state changes.

- If the user says read-only, no edits, without changes, or equivalent, do not call `memory_save`, `memory_update`, `memory_reconciliation_record`, or other mutation tools unless the same request explicitly asks to remember, correct, or reconcile memory.
- Before the final response for completed non-trivial work, run one mandatory memory completion latch: inspect the finished outcome for a reusable preference, workflow, convention, root cause, fix pattern, setup gotcha, or verification sequence. Deliberately consider both scopes. Prefer `global` whenever the durable lesson can guide future work in more than one repository; use `project` for knowledge whose useful meaning depends on this repository. If a reusable lesson exists, save or update it without waiting for an explicit "remember this" request; if none exists, do not write.
- Planning discussion, speculative direction, raw progress, and one-off edits normally produce no memory write.
- Other skills may point to this decision but must not restate or expand it.

## What To Save

Prefer `global` for durable guidance reusable across projects: user preferences, communication habits, tool choices, model-behavior requirements, general workflows, root-cause and fix patterns, and verification practices. A lesson does not become project-only because it was learned during repository work, mentions the originating project as an example, or could also help that project. Use `project` for durable setup, build, release, architecture, integration, decisions, and operational facts whose useful meaning depends on this repository.

Use a practical portability test: if the memory can improve future work in another repository without requiring that repository to share this one's code or state, choose `global`. When both scopes have distinct durable value, save the reusable rule globally and the repository-specific details in project memory. Do not duplicate the same undistilled content in both scopes.

Never save secrets, credentials, private webhook values, raw session summaries, obvious code facts, temporary progress, speculative plans, or project facts in global memory. Preserve negation and ownership exactly when updating constraints.

Prefer `memory_update` when an existing canonical memory covers the same decision or workflow. Use `memory_save` only for a genuinely new durable fact. The selected scope is authoritative: the memory gate may allow, surgically rewrite, or reject content, but it must not reroute a write between `global` and `project`.

## Project Memory Git Contract

Treat project `.memory/` as repository-owned team knowledge, not as a generated cache directory.

- Commit every authorized change under `.memory/memories/`, `.memory/index/`, `.memory/embeddings/`, `.memory/graph/`, and `.memory/maintenance/`, including newly created files. Embeddings, graph edges, and reconciliation metadata are canonical project artifacts, not disposable build output.
- Never add `.memory/`, `.memory/**`, or any canonical subdirectory above to `.gitignore`. Never discard or omit those files merely because Agent Memory generated them.
- Ignore only the SQLite cache and its sidecars via `.memory/memory.db*`; this covers `memory.db`, `memory.db-shm`, and `memory.db-wal`.
- Before commit or handoff after a project-memory mutation, check `git status --short .memory` and ensure canonical `.memory/` changes are included in the intended repository diff. If `git check-ignore -v` reports a canonical file, remove the offending broad ignore rule instead of ignoring the artifact.

## Recovery And Completion

After compaction, recover durable preferences from Agent Memory and active execution state from `.workflow/`; do not reconstruct either from chat when authoritative artifacts exist.

Stop after the single task-appropriate read or justified completion write. Do not perform graph maintenance, broad listing, or repeated recall as routine finalization.

Read [references/operations.md](references/operations.md) only when diagnosing empty/stale memory, choosing lower-level tools, performing graph/maintenance work, or handling project `.memory/` files.
