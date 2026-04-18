# Agent Memory

Persistent memory for Codex with separate global and project scopes.

`agent-memory` helps Codex retain durable knowledge without turning every session into prompt archaeology. It gives the model a structured way to store and retrieve:

- user preferences and long-lived behavior rules
- cross-project coding patterns
- repository-specific workflows and conventions
- deployment notes, credentials, setup steps, and operational gotchas

The plugin is powered by a bundled MCP server and a Codex skill.

## Highlights

- global memory stored under `~/.agents/agent-memory/`
- project memory stored under `<repo>/.memory/`
- deep and lite memory layers
- semantic and keyword search
- meaningful memory filenames
- weighted links between deep memories
- deterministic project setup through MCP

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

Project memory is enabled per repository with:

```text
memory_setup()
```

## Storage Model

Global memory:

```text
~/.agents/agent-memory/
  memories/
  embeddings/
  graph/
  memory.db
```

Project memory:

```text
.memory/
  memories/
  embeddings/
  graph/
  memory.db
  memory.db-shm
  memory.db-wal
```

Markdown memory files, embedding files, and graph files are the source of truth. SQLite is used as local cache for fast lookup.

## Tool Surface

Project tools:

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

Global tools:

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

## Install

Register the Wiolett marketplace in Codex:

```bash
npx @wiolett/marketplace install
```

Then install `agent-memory` from that marketplace in Codex.

To enable semantic search and AI-generated memory names, either:

```bash
export OPENAI_API_KEY="your-key"
codex
```

or save the key once through the marketplace installer or the `agent_memory_configure` MCP tool. Agent Memory stores the saved key in:

```text
~/.agents/agent-memory/config.json
```

At runtime, Agent Memory uses this precedence:

1. `OPENAI_API_KEY` from the environment
2. stored key from `~/.agents/agent-memory/config.json`
3. no key, which disables embeddings and AI naming

For non-interactive installs, the CLI also supports:

```bash
npx @wiolett/marketplace install --openai-api-key-env OPENAI_API_KEY --yes
```

## Usage

At conversation start, the bundled skill tells Codex to read global lite memory first:

```text
global_memory_read_lite()
```

When a repository should use project memory, initialize it once:

```text
memory_setup()
```

From there, use memory tools to store and retrieve reusable knowledge as needed.

## Development

Requirements:

- Node.js 22.5+
- optional `OPENAI_API_KEY` for semantic search and AI-generated memory slugs

Useful commands:

```bash
npm run typecheck
npm run build
npm test
```
