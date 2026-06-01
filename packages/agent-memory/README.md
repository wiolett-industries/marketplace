# Agent Memory

Persistent memory for Codex with separate global and project scopes.

`agent-memory` helps Codex retain durable knowledge without turning every session into prompt archaeology. It gives the model a structured way to store and retrieve:

- user preferences and long-lived behavior rules
- cross-project coding patterns
- repository-specific workflows and conventions
- deployment notes, credentials, setup steps, and operational gotchas

This package backs the standalone Agent Memory plugin.

## Highlights

- global memory stored under `~/.agents/agent-memory/`
- project memory stored under `<repo>/.memory/`
- deep canonical memories plus a separate lightweight index layer
- semantic and keyword search
- meaningful memory filenames
- weighted graph links between deep memories and standalone lite memories
- automatic graph-link suggestions on save/update without touching manual links
- sanity-gated saves and stable in-place memory updates
- compiled recall/query answers with source references
- automatic project-memory setup on write/mutation use; reads stay no-op when project memory is absent

## Memory Scopes

### Global Memory

Global memory is for information that should follow the user across repositories:

- response style preferences
- coding habits and tool choices
- cross-project requirements for model behavior
- reusable personal workflows

Global memory is always available through `global_memory_*` tools.

### Project Memory

Project memory is for repository-specific knowledge:

- setup and bootstrap steps
- deployment and release workflows
- project conventions
- undocumented dependencies
- credentials and environment-specific instructions

Project memory auto-initializes on write/mutation use in a repository. Read tools do not create `.memory/` when project memory is absent; they return empty results instead.

## Storage Model

Global memory:

```text
~/.agents/agent-memory/
  memories/
  index/
  embeddings/
  graph/
  memory.db
```

Project memory:

```text
.memory/
  memories/
  index/
  embeddings/
  graph/
  memory.db
  memory.db-shm
  memory.db-wal
```

Canonical markdown memory files, index files, embedding arrays, and graph files are the source of truth. SQLite is used as local cache for fast lookup.

## Tool Surface

Canonical tools:

- `memory_save`
- `memory_update`
- `memory_recall`
- `memory_query`
- `memory_list`
- `memory_inspect`
- `memory_delete`
- `memory_link`
- `memory_unlink`
- `memory_graph`
- `memory_setup`

Every canonical tool except `memory_setup` accepts an optional `scope` of `project` or `global`; project is the default. `memory_setup` initializes or repairs project memory for the current repo.

Compatibility aliases remain available until the bundled skills move to the new names:

- `memory_write` / `global_memory_write`
- `memory_get` / `global_memory_get`
- `memory_search` / `global_memory_search`
- `memory_read_lite` / `global_memory_read_lite`
- `memory_read_all` / `global_memory_read_all`
- `memory_neighbors` / `global_memory_neighbors`
- `memory_subgraph` / `global_memory_subgraph`

Normal reads should use:

- `memory_recall` for one compiled memory context
- `memory_query` for a compiled answer from search results
- `memory_list` for lightweight index browsing

`memory_inspect` is intentionally raw and meant for maintenance/debugging.

## Install

Register the Wiolett marketplace in Codex:

```bash
codex plugin marketplace add wiolett-industries/marketplace
```

Then install `agent-memory` from that marketplace in Codex.

Model access uses Agent Memory's built-in OpenAI-compatible auth resolver. Configure it with:

```bash
npx -y @wiolett/agent-memory@latest init
```

The init command writes:

```text
~/.agents/.wiolett/auth-config.json
```

You can also provide `OPENAI_API_KEY` directly. The config may contain:

```json
{
  "openAIKey": "sk-proj-...",
  "endpoint": "https://api.openai.com/v1",
  "embeddingModel": "text-embedding-3-small"
}
```

Without an API key, model-gated writes and semantic search are disabled. Memory still falls back to keyword/FTS plus graph relations where possible.

## Usage

At conversation start, the bundled skill tells Codex to read global lite memory first:

```text
global_memory_read_lite()
```

When a repository should use project memory, save or mutate project memory normally. The first write/mutation call initializes the local `.memory/` store automatically. Read calls against a repo with no project memory return empty results and leave the repo untouched.

From there, use memory tools to store and retrieve reusable knowledge as needed.

Example canonical calls:

```text
memory_save(content="Project releases use pnpm build before publish.", tags=["release", "pnpm"])
memory_query(query="How do releases work?")
memory_recall(memory_id="abc123xy")
memory_inspect(view="all")
```

## Development

Requirements:

- Node.js 22.5+
- optional `OPENAI_API_KEY` or `~/.agents/.wiolett/auth-config.json` for model-gated writes, semantic search, and AI-generated memory slugs

Useful commands:

```bash
pnpm typecheck
pnpm build
pnpm test
```
