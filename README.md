# Wiolett Industries Codex Marketplace

Codex-first plugin marketplace for Wiolett Industries.

This repo exposes a local Codex marketplace manifest under `.agents/plugins/` and currently ships one plugin:

- `agent-memory` — persistent agent memory with separate global and project scopes, exposed through a bundled Codex MCP server plus a skill

## Layout

- Marketplace manifest: `.agents/plugins/marketplace.json`
- Plugin wrapper: `plugins/agent-memory`
- MCP implementation: `packages/agent-memory`

Point Codex at this repo's `.agents/plugins/marketplace.json` to install the plugin.

## Root Scripts

- `npm run plugins:install` — install dependencies for all plugin packages in this repo
- `npm run plugin:agent-memory:install` — install dependencies only for `agent-memory`
- `npm run build` — build `agent-memory`
- `npm run test` — run the `agent-memory` test suite
- `npm run typecheck` — typecheck `agent-memory`
