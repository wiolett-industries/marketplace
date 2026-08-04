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
4. Do not delete memories, prune graph edges, or re-embed content unless the user explicitly asks for that extra maintenance. Explain unresolved conflicts rather than silently choosing a side.
5. After the scoped work is complete, call `memory_reconciliation_record` for each reconciled scope. For project memory, include the resulting `.memory/maintenance/` change in the intended repository diff.

## Completion

Report the scope, the memory changes made, unresolved conflicts, and the recorded status. Do not claim that global memory was reconciled when only project memory was reviewed.
