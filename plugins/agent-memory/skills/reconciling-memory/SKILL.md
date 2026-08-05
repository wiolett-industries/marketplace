---
name: reconciling-memory
description: Reconcile stale or conflicting Agent Memory for one project or the global scope after the user approves the maintenance work. Use when the user asks to consolidate memory or accepts an overdue reconciliation offer.
---

# Reconciling Agent Memory

Use this skill only for an explicit user request or an accepted overdue-reconciliation offer. It is a bounded maintenance pass, not routine startup work.

## Scope And Consent

1. Read `memory_reconciliation_status` for the requested scope. Use `project` with the absolute `workspace_root`; include `global` only if the user asked for it or the work is genuinely cross-project.
2. State which scope will be reconciled and what will be checked. If the user has not approved the maintenance pass, offer it and stop; a due timestamp is not authorization to mutate memory.
3. Respect read-only/no-edits requests. `memory_reconciliation_record`, `memory_save`, and `memory_update` are durable writes.

## Bounded Pass

1. Run one `memory_recap` for broad recovery. Use a focused `memory_query` only for a concrete suspected conflict or workflow.
2. Inspect the candidates for stale, duplicated, contradictory, overly broad, secret-bearing, or wrongly scoped content. Preserve ownership, negation, uncertainty, and project/global boundaries.
3. Update an existing canonical memory when it can absorb the correction. Save only a truly new reusable lesson. Never invent facts from chat history or a recap.
4. For an ordinary reconciliation, do not delete memories, prune graph edges, or re-embed content unless the user explicitly asks for that extra maintenance. Explain unresolved conflicts rather than silently choosing a side.
5. After the scoped work is complete, call `memory_reconciliation_record` for each reconciled scope with a concise secret-free `summary`, `reviewed` count when known, `changes` entries for every durable action, and `unresolved` conflicts/follow-ups. Use empty arrays when there were none. For project memory, include the resulting `.memory/maintenance/` change in the intended repository diff.

## Full Maintenance

An explicit request for full maintenance, or the `agent-memory consolidate` confirmation that names full maintenance, authorizes this additional bounded cleanup for the selected scope:

1. Inspect all durable records and graph health before editing. Consolidate duplicate, stale, contradictory, overly broad, and wrongly scoped facts into the best canonical record. Preserve ownership, negation, modality, uncertainty, and provenance.
2. Create a new canonical memory when splitting mixed facts, preserving a distinct fact before a deletion, or extracting a stable pattern supported by several memories. Do not create a memory for a one-off observation or an inference that lacks evidence.
3. Delete a canonical memory only when it is proven redundant, superseded, stale, wrongly scoped, or secret-bearing and its still-valid durable value has already been preserved. Never delete an ambiguous memory merely to reduce the count.
4. Call `memory_graph_maintain(dry_run=false)` for deterministic cleanup: remove dead index pointers, orphan graph files, and structurally impossible edges, then rebuild AUTO links. It preserves structurally valid manual edges and canonical memories. Inspect graph health afterwards; independent orphan memories are allowed, but semantic merge/split/create/delete decisions still require evidence-backed model reasoning.
5. Record every content creation/update/deletion and each grouped structural repair in `changes` using `saved`, `updated`, `deleted`, or `repaired`. Do not declare success while a safe authorized repair was merely reported and skipped.

## Completion

Report the scope, the memory changes made, unresolved conflicts, and the recorded status. Do not claim that global memory was reconciled when only project memory was reviewed.
