# Agent Memory Operations Reference

Read this reference only for lower-level memory operations, troubleshooting, maintenance, or project artifact handling.

## Model

Scopes:

- `global`: durable cross-project user preferences and reusable environment/workflow facts
- `project`: durable repository-specific conventions, commands, decisions, and gotchas

Layers:

- `deep`: canonical memory text, embeddings when configured, and graph links
- `lite`: lightweight index or pointer layer used for discovery

Canonical tools: `memory_setup`, `memory_list`, `memory_query`, `memory_recap`, `memory_recall`, `memory_save`, `memory_update`, `memory_inspect`, `memory_delete`, `memory_link`, `memory_unlink`, `memory_graph`, `memory_path`, and `memory_graph_prune`. Use compatibility aliases only when canonical tools are unavailable.

## Focused Reads

- `memory_query`: search and compile an answer; graph expansion may add related candidates.
- `memory_recap`: synthesize several current memories for broad task startup, compaction recovery, or handoff; add `topic` when the recap should stay focused.
- `memory_recall`: recover a known memory plus useful relations.
- `memory_list({ index_only: true })`: inspect only the lite index/pointer layer.
- Omit `index_only` when debugging whether deep memories exist but the index is empty or stale.
- `memory_inspect({ view: "all" })`: inspect raw deep/lite state.
- `memory_inspect({ view: "health" })`: inspect graph health.

When project results are unexpectedly empty, retry with the absolute `workspace_root`. Project reads use the MCP server cwd when the root is omitted.

## Writes And Maintenance

Use `memory_setup` only to initialize or repair a known project memory root. Use `memory_delete`, `memory_link`, `memory_unlink`, and `memory_graph_prune` only for explicit maintenance or corrective work. `memory_graph_prune` is dry-run by default and never removes manual edges.

Before a new save, check whether an existing canonical memory should be updated. `memory_update` preserves the memory id and graph relations. Store the distilled lesson, not the transcript that produced it.

## Project Artifacts

Project `.memory/` files are team knowledge artifacts. Commit canonical files under `.memory/memories/`, `.memory/index/`, `.memory/embeddings/`, and `.memory/graph/` when they are created or updated as part of authorized repository work. Only `.memory/memory.db*` is generated cache and should remain ignored.
