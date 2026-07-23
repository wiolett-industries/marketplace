# Agent Memory

Persistent, scoped memory for Codex and Claude Code.

Agent Memory gives agents a durable place to store reusable knowledge without
mixing it into chat history. It supports global user memory and project-local
team memory, compiled recall/query answers, graph links, semantic search when
embeddings are configured, and a local read-only dashboard.

## What It Ships

- `using-agent-memory` skill for proactive task-appropriate reads, compaction
  recovery, and a mandatory durable-write completion latch
- MCP server wiring through `.mcp.json`
- Codex and Claude plugin manifests
- marketplace icon assets

The runtime package is [`@wiolett/agent-memory`](../../packages/agent-memory).

## Memory Model

- Global memory lives under `~/.agents/.wiolett/global-memory/` by default and follows the user
  across repositories.
- Project memory lives under `<repo>/.memory/` and belongs to that repository.
- Canonical project `.memory/` markdown, index, embedding, and graph files are
  team knowledge artifacts and should be committed.
- Generated SQLite cache files, `.memory/memory.db*`, should stay ignored.

## MCP Tools

Canonical tools include:

- `memory_setup`
- `memory_list`
- `memory_query`
- `memory_recap`
- `memory_recall`
- `memory_save`
- `memory_update`
- `memory_inspect`
- `memory_delete`
- `memory_link`
- `memory_unlink`
- `memory_graph`
- `memory_path`
- `memory_graph_prune`

Compatibility aliases remain available for older skills, but new instructions
should prefer the canonical names.

The startup skill chooses one task-appropriate read: `memory_query` for a focused
question or `memory_recap` for broad recovery across several memories. It treats
memory writes as state changes: read-only/no-edits work does not save or update
memory unless remembering is explicitly requested.

## Model Access

Model access is optional but recommended. It enables model-gated writes,
compiled recall/query answers, AI slugs, embeddings, semantic search, and graph
link review.

Configure once:

```bash
npx -y @wiolett/agent-memory@latest init
```

Agent Memory creates `~/.agents/.wiolett/config/ai-providers.yml` and
`mcp-config.yml`; generated comments are English and provider credentials are
stored with `0600` permissions. Named roles may combine providers and models.
Text providers may use `POST /responses` or `POST /chat/completions`, while
embedding providers use `POST /embeddings`.

The same locked migration runs from `init` and MCP startup. It imports the
legacy JSON config and moves the old global store to the configured path while
leaving a compatibility symlink. Workflow and Merge Request Review only read
their sections of `mcp-config.yml` and never generate or migrate it.

## Dashboard

Inspect memory visually with:

```bash
npx -y @wiolett/agent-memory@latest view
npx -y @wiolett/agent-memory@latest view global
```

The dashboard is loopback-only, read-only, and uses the same files as the MCP
server.
