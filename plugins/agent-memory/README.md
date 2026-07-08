# Agent Memory

Persistent, scoped memory for Codex and Claude Code.

Agent Memory gives agents a durable place to store reusable knowledge without
mixing it into chat history. It supports global user memory and project-local
team memory, compiled recall/query answers, graph links, semantic search when
embeddings are configured, and a local read-only dashboard.

## What It Ships

- `Using Agent Memory` skill for startup reads, compaction recovery, and
  durable write decisions
- MCP server wiring through `.mcp.json`
- Codex and Claude plugin manifests
- marketplace icon assets

The runtime package is [`@wiolett/agent-memory`](../../packages/agent-memory).

## Memory Model

- Global memory lives under `~/.agents/agent-memory/` and follows the user
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

## Model Access

Model access is optional but recommended. It enables model-gated writes,
compiled recall/query answers, AI slugs, embeddings, semantic search, and graph
link review.

Configure once:

```bash
npx -y @wiolett/agent-memory@latest init
```

The config is stored at `~/.agents/.wiolett/auth-config.json` with `0600`
permissions. `OPENAI_API_KEY` can also be provided through the environment.
OpenAI-compatible providers must support the endpoints used by Agent Memory:
`POST /responses` and `POST /embeddings`.

## Dashboard

Inspect memory visually with:

```bash
npx -y @wiolett/agent-memory@latest view
npx -y @wiolett/agent-memory@latest view global
```

The dashboard is loopback-only, read-only, and uses the same files as the MCP
server.
