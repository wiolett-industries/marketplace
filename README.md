# Wiolett Marketplace

Codex plugin marketplace for Wiolett Industries.

This repository provides a Codex marketplace source, exposed through [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json).

The marketplace currently ships:

- [`agent-memory`](./plugins/agent-memory) — persistent scoped memory for Codex with compiled recall and automatic graph links
- [`workflow`](./plugins/workflow) — modular agentic workflow framework for intent, planning, execution, and review/fix loops
- [`merge-request-review`](./plugins/merge-request-review) — discussion-aware GitLab merge request review with strict gates and approval discipline

## Install In Codex

Register the marketplace with Codex:

```bash
codex plugin marketplace add wiolett-industries/marketplace
```

To pin a specific ref:

```bash
codex plugin marketplace add wiolett-industries/marketplace --ref main
```

To register a local checkout:

```bash
codex plugin marketplace add /absolute/path/to/local/marketplace
```

To refresh or remove the marketplace:

```bash
codex plugin marketplace upgrade wiolett-industries
codex plugin marketplace remove wiolett-industries
```

After the marketplace is registered, install the plugin you want from Codex.

The marketplace itself does not require an OpenAI API key. The `agent-memory` plugin uses `OPENAI_API_KEY` or `~/.agents/.wiolett/auth-config.json` for model-gated writes, embeddings, semantic search, and graph-link review when configured.

## Included Plugins

### Agent Memory

`agent-memory` gives Codex durable memory in two scopes:

- global memory for preferences, model behavior, and cross-project patterns
- project memory for repo-specific workflows, conventions, credentials, and operational knowledge

It supports lazy no-op reads for projects without memory, model-gated writes, compiled recall/query answers, and automatic graph links between graph-capable memories.

### Workflow

`workflow` is the consolidated engineering workflow plugin. It includes intent gating, context discovery, frontend UI contracts, durable `.workflow/plans/<date-slug>/` and `.workflow/audits/<date-slug>/` artifacts, stateful execution, worktree-isolated subagent policy, final review/fix loops, and a bundled MCP server that syncs workflow custom agents globally at startup and provides deterministic plan/audit artifact tools.

### Merge Request Review

`merge-request-review` gives Codex a careful GitLab merge request review workflow with discussion intake, strict findings, re-review loops, fixed note formats, and approval only after blocker threads are resolved.

## Repository Layout

- marketplace manifest: [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
- plugin: [`plugins/agent-memory`](./plugins/agent-memory)
- plugin: [`plugins/workflow`](./plugins/workflow)
- plugin: [`plugins/merge-request-review`](./plugins/merge-request-review)
- MCP implementation: [`packages/agent-memory`](./packages/agent-memory)
- Workflow MCP implementation: [`packages/workflow`](./packages/workflow)
- Merge request review implementation: [`packages/merge-request-review`](./packages/merge-request-review)
