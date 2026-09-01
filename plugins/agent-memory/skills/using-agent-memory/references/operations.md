# Agent Memory Operations Reference

Read this reference only for lower-level memory operations, troubleshooting, maintenance, or project artifact handling.

## Model

Scopes:

- `global`: durable cross-project user preferences and reusable environment/workflow facts
- `project`: durable repository-specific conventions, commands, decisions, and gotchas

Layers:

- `deep`: canonical memory text, embeddings when configured, and graph links
- `lite`: lightweight index or pointer layer used for discovery

Canonical tools: `memory_setup`, `memory_list`, `memory_query`, `memory_recap`, `memory_recall`, `memory_reconciliation_status`, `memory_reconciliation_record`, `memory_project_registry`, `memory_save`, `memory_update`, `memory_inspect`, `memory_delete`, `memory_link`, `memory_unlink`, `memory_graph`, `memory_path`, `memory_graph_prune`, and `memory_graph_maintain`. Use compatibility aliases only when canonical tools are unavailable.

## Focused Reads

- `memory_query`: search and compile an answer; graph expansion may add related candidates.
- `memory_recap`: synthesize several current memories for broad task startup, compaction recovery, or handoff; add `topic` when the recap should stay focused.
- `memory_recall`: recover a known memory plus useful relations. It requires a non-empty `memory_id`; obtain that id from query/list/recap output or an explicit user reference. It is never a substitute for semantic search.
- `memory_list({ index_only: true })`: inspect only the lite index/pointer layer.
- Omit `index_only` when debugging whether deep memories exist but the index is empty or stale.
- `memory_inspect({ view: "all" })`: inspect raw deep/lite state.
- `memory_inspect({ view: "health" })`: inspect graph health.

When project results are unexpectedly empty, retry with the absolute `workspace_root`. Project reads use the MCP server cwd when the root is omitted. When the user asks for a different project, do not switch to global memory or scan directories: call `memory_query` or `memory_recap` with `scope: "project"` and the explicitly requested project's absolute `workspace_root`. Those reads stay isolated to that root and do not create `.memory/` there.

## Writes And Maintenance

Use `memory_setup` only to initialize or repair a known project memory root. Use `memory_delete`, `memory_link`, `memory_unlink`, `memory_graph_prune`, and `memory_graph_maintain` only for explicit maintenance or corrective work. Both graph tools are dry-run by default. `memory_graph_prune` never removes manual edges; `memory_graph_maintain` deterministically deletes dead index pointers, orphan graph files, and structurally impossible edges before rebuilding AUTO links. It preserves every structurally valid manual edge.

Before a new save, check whether an existing canonical memory should be updated. `memory_update` preserves the memory id and graph relations. Store the distilled lesson, not the transcript that produced it.

## Reconciliation Cadence

- `memory_reconciliation_status`: read the stored reconciliation timestamp for one initialized scope and report whether the 30-day cadence is due. It does not create a memory store.
- `memory_reconciliation_record`: persist the current timestamp plus a concise secret-free outcome report only after an explicit, user-approved reconciliation was completed. Include each durable change and unresolved conflict so callers can show a reliable result; it is a durable mutation, not an acknowledgement button.
- Use the `reconciling-memory` skill for the bounded project/global process. Do not perform graph pruning, delete memories, or record a reconciliation just because the status is due.

## Project Artifacts

Resolve the configured project-memory root first; the default is `.memory/`. When the root is inside the repository, commit every authorized creation, update, or deletion under its `memories/`, `index/`, `embeddings/`, `graph/`, and `maintenance/` directories; embeddings, graph edges, and reconciliation metadata are canonical source data. Never ignore that root wholesale or any canonical subdirectory. Ignore only `<configured-root>/memory.db*`, covering the SQLite cache and its `-shm`/`-wal` sidecars. Before commit or handoff after a mutation, inspect `git status --short -- <configured-root>` and remove any broad ignore rule reported by `git check-ignore -v` for a canonical artifact. If the root is outside the repository, report that its files cannot be included in the repository diff.
