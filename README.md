# Wiolett Marketplace

Codex plugin marketplace for Wiolett Industries.

This repository publishes:

- a Codex marketplace source, exposed through [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
- a lightweight npm installer CLI published as `@wiolett/marketplace`

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

The simplest install path is:

```bash
npx @wiolett/marketplace
```

This registers the Wiolett marketplace in Codex.

You can also run the command explicitly:

```bash
npx @wiolett/marketplace install
```

Optional flags:

```bash
npx @wiolett/marketplace install --ref main
npx @wiolett/marketplace install --source /absolute/path/to/local/marketplace
npx @wiolett/marketplace install --openai-api-key-env OPENAI_API_KEY --yes
npx @wiolett/marketplace install --openai-api-key sk-proj-... --yes
npx @wiolett/marketplace install --yes
npx @wiolett/marketplace update --yes
npx @wiolett/marketplace uninstall
```

After `update`, reinstall the plugins you want enabled again in Codex. Refreshing the marketplace can leave previously installed plugins disabled.

During interactive installation, the CLI can ask for an OpenAI API key and persist it for `agent-memory` before applying the marketplace change.

That key is only relevant if you plan to install and use `agent-memory`. The marketplace itself and the other plugins do not require it.

If you provide a key during install, it is stored at:

```text
~/.agents/agent-memory/config.json
```

`agent-memory` prefers `OPENAI_API_KEY` from the environment when present, and otherwise falls back to the stored key automatically.

After the marketplace is registered, install the plugin you want from Codex.

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
- npm installer CLI: [`bin/marketplace`](./bin/marketplace)

## Publish

This repository is configured to publish the installer CLI as:

```text
@wiolett/marketplace
```

Standard publish flow:

```bash
npm pack --dry-run
npm publish
```
