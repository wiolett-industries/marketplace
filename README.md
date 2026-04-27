# Wiolett Marketplace

Codex plugin marketplace for Wiolett Industries.

This repository provides a Codex marketplace source, exposed through [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json).

The marketplace currently ships:

- [`agent-memory`](./packages/agent-memory) — persistent memory for Codex with separate global and project scopes
- [`workflow`](./plugins/workflow) — engineering workflow core for discovery, planning, debugging, review loops, and verification
- [`codebase-scan`](./plugins/codebase-scan) — brownfield codebase scanning before planning or implementation
- [`live-browser-debug`](./plugins/live-browser-debug) — real-browser debugging bridge for local frontend apps and incident recording
- [`merge-request-review`](./plugins/merge-request-review) — discussion-aware GitLab merge request review with strict gates and approval discipline
- [`ui-contract-review`](./plugins/ui-contract-review) — frontend UI contract definition and retroactive interface review
- [`spike-investigation`](./plugins/spike-investigation) — bounded feasibility spikes before committing to an implementation path
- [`test-driven-development`](./plugins/test-driven-development) — strict red-green-refactor discipline as a standalone plugin
- [`multi-agent-workflows`](./plugins/multi-agent-workflows) — parallel investigation and subagent-driven execution workflows
- [`ask-questions`](./plugins/ask-questions) — ask only the minimum clarifying questions before ambiguous implementation work

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

The marketplace itself does not require an OpenAI API key. If you install `agent-memory`, it prefers `OPENAI_API_KEY` from the environment and otherwise falls back to a stored key at `~/.agents/agent-memory/config.json` when configured.

## Included Plugins

### Agent Memory

`agent-memory` gives Codex durable memory in two scopes:

- global memory for preferences, model behavior, and cross-project patterns
- project memory for repo-specific workflows, conventions, credentials, and operational knowledge

Learn more in [`packages/agent-memory/README.md`](./packages/agent-memory/README.md).

### Workflow

`workflow` covers discovery, planning, execution, debugging, review loops, and verification discipline for general engineering work.

### Codebase Scan

`codebase-scan` helps Codex map an unfamiliar repository before planning or implementing a substantial change.

### Live Browser Debug

`live-browser-debug` lets Codex temporarily wire a local debug client into a frontend app so it can inspect the user's real browser session, record delayed incidents, and review console, network, DOM, and approximate visual state.

### Merge Request Review

`merge-request-review` gives Codex a careful GitLab merge request review workflow with discussion intake, strict findings, re-review loops, fixed note formats, and approval only after blocker threads are resolved.

### UI Contract Review

`ui-contract-review` adds a frontend-oriented contract-before-build and review-after-build workflow.

### Spike Investigation

`spike-investigation` gives Codex a clean way to run bounded technical experiments before committing to a design path.

## Repository Layout

- marketplace manifest: [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
- plugin wrapper: [`plugins/agent-memory`](./plugins/agent-memory)
- plugin: [`plugins/workflow`](./plugins/workflow)
- plugin: [`plugins/codebase-scan`](./plugins/codebase-scan)
- plugin: [`plugins/live-browser-debug`](./plugins/live-browser-debug)
- plugin: [`plugins/merge-request-review`](./plugins/merge-request-review)
- plugin: [`plugins/ui-contract-review`](./plugins/ui-contract-review)
- plugin: [`plugins/spike-investigation`](./plugins/spike-investigation)
- plugin: [`plugins/test-driven-development`](./plugins/test-driven-development)
- plugin: [`plugins/multi-agent-workflows`](./plugins/multi-agent-workflows)
- plugin: [`plugins/ask-questions`](./plugins/ask-questions)
- MCP implementation: [`packages/agent-memory`](./packages/agent-memory)
