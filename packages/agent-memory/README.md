# Agent Memory

Persistent, searchable agent memory with separate project and global scopes for Codex and other MCP-capable agents.

Project memories live inside the current repo under `.memory/`. Global memories live under `~/.agents/agent-memory/`. In both cases, memories live as Markdown files, embeddings live separately, and a local SQLite cache is rebuilt from those files at server startup for fast search.

## Requirements

- Node.js 22.5+
- Codex or another MCP-capable host
- Optional `OPENAI_API_KEY` for semantic ranking

## Install Through Codex

1. Point Codex at this repo's `.agents/plugins/marketplace.json`.
2. Install `agent-memory`.
3. Global memory is available immediately through `global_memory_*` tools.
4. In the repo where you want project memory enabled, ask Codex to call:

```text
memory_setup()
```

The setup tool:

- initializes `.memory/`
- creates `.memory/memories/`
- creates `.memory/embeddings/`
- creates `.memory/graph/`
- ensures the SQLite cache exists
- updates `.gitignore` so `.memory/memory.db*` stays ignored

Repeat that tool call in each project where you want project memory enabled.

Legacy project-memory layouts are migrated automatically by the MCP server on the first project-memory tool call after enablement or first use.

## Storage Model

```text
~/.agents/agent-memory/
  memories/
    <hash>_<meaningful_name>.md
  embeddings/
    <hash>_<meaningful_name>.embeddings
  graph/
    <hash>_<meaningful_name>.edges.json
  memory.db

.memory/
  memories/
    <hash>_<meaningful_name>.md
  embeddings/
    <hash>_<meaningful_name>.embeddings
  graph/
    <hash>_<meaningful_name>.edges.json
  memory.db
  memory.db-shm
  memory.db-wal
```

- project `memories/`, `embeddings/`, and `graph/` are the source of truth and should be committed
- `memory.db*` is local cache state and should stay ignored
- global memory under `~/.agents/agent-memory/` is persistent local state and is not part of the repo

## MCP Tools

- Project tools:
  - `memory_setup`
  - `memory_write`
  - `memory_get`
  - `memory_read_lite`
  - `memory_search`
  - `memory_delete`
  - `memory_link`
  - `memory_unlink`
  - `memory_neighbors`
  - `memory_subgraph`
  - `memory_read_all`
- Global tools:
  - `global_memory_write`
  - `global_memory_get`
  - `global_memory_read_lite`
  - `global_memory_search`
  - `global_memory_delete`
  - `global_memory_link`
  - `global_memory_unlink`
  - `global_memory_neighbors`
  - `global_memory_subgraph`
  - `global_memory_read_all`

Both `memory_write` and `global_memory_write` default to `deep` and auto-create the lite pointer. Use `layer="lite"` only for short standalone facts that should always be cheap to load.

## Codex Integration

This plugin is intentionally Codex-native and avoids unsupported hook behavior. The plugin exposes one global MCP server plus a skill. Global memory is always available, and project-local setup happens through the `memory_setup` MCP tool instead of plugin commands or shell scripts.
