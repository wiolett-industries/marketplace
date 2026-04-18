# Wiolett Marketplace

Codex plugin marketplace for Wiolett Industries.

This repository publishes:

- a Codex marketplace source, exposed through [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
- a lightweight npm installer CLI published as `@wiolett/marketplace`

The marketplace currently ships:

- [`agent-memory`](./packages/agent-memory) — persistent memory for Codex with separate global and project scopes

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
npx @wiolett/marketplace install --yes
```

After the marketplace is registered, install the plugin you want from Codex.

## Included Plugin

### Agent Memory

`agent-memory` gives Codex durable memory in two scopes:

- global memory for preferences, model behavior, and cross-project patterns
- project memory for repo-specific workflows, conventions, credentials, and operational knowledge

Learn more in [`packages/agent-memory/README.md`](./packages/agent-memory/README.md).

## Repository Layout

- marketplace manifest: [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
- plugin wrapper: [`plugins/agent-memory`](./plugins/agent-memory)
- MCP implementation: [`packages/agent-memory`](./packages/agent-memory)
- npm installer CLI: [`bin/cli.mjs`](./bin/cli.mjs)

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
