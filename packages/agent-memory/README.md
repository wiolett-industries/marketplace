# Agent Memory

Persistent memory for agent platforms with separate global and project scopes.

`agent-memory` helps Codex and Claude Code retain durable knowledge without turning every session into prompt archaeology. It gives the model a structured way to store and retrieve:

- user preferences and long-lived behavior rules
- cross-project coding patterns
- repository-specific workflows and conventions
- deployment notes, redacted credential locations/processes, setup steps, and operational gotchas

This package backs the standalone Agent Memory plugin.

## Highlights

- global memory stored under `~/.agents/.wiolett/global-memory/` by default
- project memory stored under `<repo>/.memory/`
- deep canonical memories plus a separate lightweight index layer
- semantic and keyword search
- meaningful memory filenames
- weighted, typed graph links between deep memories and standalone lite memories
- automatic graph-link suggestions on save/update without touching manual links
- graph-expanded `memory_query`: surfaces edge-connected memories the query text missed
- supersede/duplicate detection on save: contradicting memories get a `supersedes` edge and are downranked (never deleted)
- pathfinding between two memories and read-only graph health metrics + auto-edge pruning
- sanity-gated saves and stable in-place memory updates
- compiled recall/query answers and broad multi-memory recaps with source references
- automatic project-memory setup on write/mutation use; reads stay no-op when project memory is absent

## Memory Scopes

### Global Memory

Global memory is for information that should follow the user across repositories:

- response style preferences
- coding habits and tool choices
- cross-project requirements for model behavior
- reusable personal workflows

Global memory is available through canonical tools with `scope: "global"`. Some compatibility helpers and graph maintenance helpers also use `global_memory_*` names.

### Project Memory

Project memory is for repository-specific knowledge:

- setup and bootstrap steps
- deployment and release workflows
- project conventions
- undocumented dependencies
- redacted credential locations/processes and environment-specific instructions

Project memory auto-initializes on write/mutation use in a repository. Read tools do not create `.memory/` when project memory is absent; they return empty results instead.

## Storage Model

Global memory:

```text
~/.agents/.wiolett/global-memory/
  memories/
  index/
  embeddings/
  graph/
  maintenance/
  memory.db
```

Project memory:

```text
.memory/
  memories/
  index/
  embeddings/
  graph/
  maintenance/
  memory.db
  memory.db-shm
  memory.db-wal
```

Canonical files under `.memory/memories/`, `.memory/index/`, `.memory/embeddings/`, `.memory/graph/`, and `.memory/maintenance/` are the repository source of truth and **must be committed** for project/team memory. This includes embedding arrays, graph edges, and reconciliation metadata. Never ignore `.memory/` wholesale or discard these files as generated output. SQLite is only a local lookup cache, so `.memory/memory.db*` is the sole Agent Memory pattern that belongs in `.gitignore`; it covers `memory.db`, `memory.db-shm`, and `memory.db-wal`.

## Tool Surface

Canonical tools:

- `memory_save`
- `memory_update`
- `memory_recall`
- `memory_query`
- `memory_recap`
- `memory_reconciliation_status`
- `memory_reconciliation_record`
- `memory_list`
- `memory_inspect`
- `memory_delete`
- `memory_link`
- `memory_unlink`
- `memory_graph`
- `memory_path`
- `memory_graph_prune`
- `memory_setup`

Every canonical tool except `memory_setup` accepts an optional `scope` of `project` or `global`; project is the default. Project-scoped canonical tools and project compatibility aliases also accept an absolute `workspace_root` so callers can target a repo when the MCP server cwd differs from the workspace. `memory_setup` initializes or repairs project memory for the current repo or supplied `workspace_root`.

Graph tools:

- `memory_graph` reads neighbors or a bounded subgraph for one memory
- `memory_path` finds a path between two memories (`strategy: shortest | strongest`)
- `memory_inspect` with `view: "health"` returns graph metrics (orphans, dangling edges, hubs, relation distribution, weight histogram, dead pointers)
- `memory_graph_prune` removes unhealthy auto edges (dangling and/or below a weight floor); manual edges are never touched and it defaults to a dry run

`memory_path` and `memory_graph_prune` also have `global_`-prefixed variants bound to global scope.

Compatibility aliases remain available until the bundled skills move to the new names:

- `memory_write` / `global_memory_write`
- `memory_get` / `global_memory_get`
- `memory_search` / `global_memory_search`
- `memory_read_lite` / `global_memory_read_lite`
- `memory_read_all` / `global_memory_read_all`
- `global_memory_delete`
- `global_memory_link`
- `global_memory_unlink`
- `memory_neighbors` / `global_memory_neighbors`
- `memory_subgraph` / `global_memory_subgraph`

Normal reads should use:

- `memory_recall` for one compiled known-memory context; it requires a non-empty `memory_id` obtained from query/list/recap output or an explicit user reference
- `memory_query` for a query-aware answer synthesized from several ranked search results
- `memory_recap` for broad task startup or compaction recovery across several current memories
- `memory_list({ index_only: true })` for lightweight index browsing; omit `index_only` to include deep memories as well

`memory_inspect` is intentionally raw and meant for maintenance/debugging.

## Install

Register the Wiolett marketplace in Codex or Claude Code:

```bash
codex plugin marketplace add wiolett-industries/marketplace
```

```text
/plugin marketplace add wiolett-industries/marketplace
```

Then install `agent-memory` from that marketplace in your agent platform.

Model access uses Agent Memory's built-in OpenAI-compatible auth resolver. Configure it with:

```bash
npx -y @wiolett/agent-memory@latest init
```

For a guided configuration UI, including multiple providers and independent
model routes, run:

```bash
npx -y @wiolett/agent-memory@latest config
```

`config` uses an interactive terminal flow to add or edit OpenAI and
OpenAI-compatible providers, set their base URL, credential, default models,
and timeout, then independently route **Gate**, **Synthesis**, and
**Embeddings**. It can also update the shared Agent Memory, Workflow, and MR
review storage paths. Changes are shown for confirmation before they are
written; status screens show only whether a credential is configured, never
its value. Use `agent-memory config --config-dir <path>` to target a different
configuration directory. For Gate and Synthesis, the UI loads the selected
provider's authenticated `/models` catalog before saving a route, so only
available models can be selected. Gateway-style catalogs that advertise
`supported_reasoning_levels` also offer the matching reasoning level; ordinary
OpenAI-compatible catalogs that do not expose those capabilities offer a
clearly-labelled manual override: `low`, `medium`, `high`, or a custom value
such as `xhigh`. The provider validates an unadvertised override when the
route is used.

The init command creates English-commented YAML under:

```text
~/.agents/.wiolett/config/ai-providers.yml
~/.agents/.wiolett/config/mcp-config.yml
```

Agent Memory is the only writer and migrator for these files. Workflow and
Merge Request Review read their artifact paths from `mcp-config.yml` and use
their built-in defaults when it is absent. A provider entry looks like:

```yaml
version: 1
providers:
  openai:
    driver: openai
    base_url: https://api.openai.com/v1
    auth:
      api_key: sk-proj-...
    apis:
      responses:
        path: /responses
        store: false
      chat_completions:
        path: /chat/completions
      embeddings:
        path: /embeddings
```

Text roles may use either Responses or Chat Completions. Embeddings, the write
gate, and synthesis can route to different named providers and models in
`mcp-config.yml`. The provider file is written with `0600` permissions.

On either MCP startup or `agent-memory init`, the same locked idempotent
bootstrap migrates the legacy `auth-config.json` and moves
`~/.agents/agent-memory` to the configured global path. The legacy memory path
becomes a compatibility symlink and the original directory is retained as a
timestamped backup.

Without an API key, model-gated writes and semantic search are disabled. Memory still falls back to keyword/FTS plus graph relations where possible.

## Usage

In a normal terminal, `agent-memory` opens one interactive menu. It includes
configuration, recent model usage, and, when eligible, memory consolidation. When the same binary is
started with stdin/stdout pipes, it preserves MCP stdio-server behavior. The
older entry points remain direct shortcuts:

```bash
agent-memory                 # interactive terminal menu
agent-memory config          # configuration shortcut
agent-memory consolidate     # consolidation shortcut
agent-memory usage           # model usage shortcut
agent-memory mcp             # force MCP stdio server mode
```

Successful model and embedding responses that include a `usage` object are
recorded locally in `~/.agents/.wiolett/usage.jsonl` (or under the configured
`PROJECT_MEMORY_AGENTS_HOME`). Each record contains only timestamp, provider,
model, role, token counts, and a provider-reported USD cost when present—never
prompts, model outputs, credentials, or project memory. `agent-memory usage`
shows a 30-day token/cost summary grouped by provider and model plus a compact
14-day calls graph. Cost remains unavailable unless the provider includes it in
its response; Agent Memory does not guess prices from a model name.

Consolidation is shown only when the local `codex` executable advertises
`gpt-5.6-terra` with `high` reasoning through `codex debug models`, and an
initialized project or global memory scope has not been reconciled in the last
24 hours. It asks for scope when both are eligible, starts a bounded local
Codex reconciliation under a spinner, and accepts success only after the
Codex run records a fresh reconciliation timestamp.

At conversation start or before non-trivial repository work, the bundled skill first decides whether durable context can change the task. It uses one focused query for a specific question or a recap for broader recovery:

```text
memory_query(scope="project", workspace_root="/path/to/repo", query="What prior decisions affect this change?")
memory_recap(scope="project", workspace_root="/path/to/repo", topic="release and deployment context")
memory_reconciliation_status(scope="project", workspace_root="/path/to/repo")
```

When a repository should use project memory, save or mutate project memory normally. The first write/mutation call initializes the local `.memory/` store automatically. Read calls against a repo with no project memory return empty results and leave the repo untouched. After a repo root is known, pass an absolute `workspace_root` on project-scoped reads/writes if the MCP server may have launched from another directory.

From there, use memory tools to store and retrieve reusable knowledge as needed.

Example canonical calls:

```text
memory_save(content="Project releases use pnpm build before publish.", tags=["release", "pnpm"])
memory_query(query="How do releases work?")
memory_recap(topic="release and deployment context")
memory_list(scope="project", workspace_root="/path/to/repo", index_only=true)
memory_recall(memory_id="abc123xy")
memory_reconciliation_record(scope="project", workspace_root="/path/to/repo", summary="Reconciled current project memory.", changes=[], unresolved=[]) # only after a completed user-approved reconciliation
memory_inspect(view="all")
```

## View — local dashboard

`agent-memory view` opens a read-only control panel for a memory store in your
browser. It boots a loopback-only HTTP server (`127.0.0.1`) that serves a
prebuilt SPA plus a small JSON API, reading the same files the MCP server uses.

Run it with `npx` (no install needed):

```bash
npx -y @wiolett/agent-memory@latest view                # current dir's ./.memory
npx -y @wiolett/agent-memory@latest view ./some/project # that project's .memory
npx -y @wiolett/agent-memory@latest view global         # the global store
```

Or, if the package is installed, use the `agent-memory` bin directly:

```bash
agent-memory view                 # current directory's ./.memory
agent-memory view ./some/project  # that project's .memory
agent-memory view global          # the configured global store
```

Options:

- `--port <n>` — preferred port (default `7077`; auto-increments if taken)
- `--no-open` — do not launch the browser automatically

Panels:

- **Graph** — force-directed view of memories and their links; filter by
  relation, manual/auto source, and weight; click a node for its content,
  tags, and neighbors. Superseded memories are dimmed.
- **Memory** — searchable list of every memory and index entry.
- **Health** — graph metrics (orphans, dangling edges, hubs, weight
  histogram, dead pointers) mirroring `memory_inspect view=health`.
- **Query** — run `search` and graph-expanded `query` side by side and see how
  results are scored and graph-connected.
- **Path** — trace the shortest or strongest path between two memories and
  highlight it on the graph.
- **Scatter** — 2D PCA projection of memory embeddings (needs an embedding
  provider and at least two embedded memories).

The dashboard is read-only and live: editing a `.md` or graph file on disk
refreshes the open panel automatically. The server is lazy-loaded, so running
the MCP server never pays for the UI. Nothing is sent off the machine.

## Doctor

`agent-memory doctor` compares the Wiolett plugin versions advertised by
GitHub `main` with locally installed Codex and Claude plugins. It also verifies
that configured Codex MCP servers use the expected
`npx -y @wiolett/...@latest` launch command.

```bash
npx -y @wiolett/agent-memory@latest doctor
```

The same read-only check is available from the interactive `agent-memory`
menu. It never upgrades plugins or rewrites MCP configuration itself; each
mismatch includes a reviewable suggested fix.

## Development

Requirements:

- Node.js 22.5+
- optional provider credentials in `~/.agents/.wiolett/config/ai-providers.yml` for model-gated writes, semantic search, and AI-generated memory slugs

Useful commands:

```bash
pnpm typecheck
pnpm build
pnpm test
```
