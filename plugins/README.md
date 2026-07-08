# Plugins

Platform plugin sources for the Wiolett Industries marketplace.

Each directory under `plugins/` is an installable plugin bundle. The bundle
contains platform manifests, skills, assets, and any platform-native agent or
hook files needed by that plugin. Generated or synced platform artifacts are
committed on purpose so installs stay turnkey.

## Plugin Bundles

- [`agent-memory`](./agent-memory) - persistent scoped memory with global and
  project stores, graph-aware recall, semantic search, and a local dashboard
- [`workflow`](./workflow) - modular workflow router for intent, discovery,
  audits, UI contracts, plans, execution, and review/fix loops
- [`merge-request-review`](./merge-request-review) - GitLab merge request
  review protocol with discussion intake, strict findings, and approval gates

## Layout

Codex plugin metadata lives under each bundle's `.codex-plugin/` directory.
Claude Code plugin metadata lives under `.claude-plugin/`.

Common plugin files:

- `README.md` - human-facing plugin overview
- `skills/` - Codex and Claude skill instructions
- `assets/` - marketplace icons and related plugin assets
- `.mcp.json` - MCP server wiring when the plugin ships a runtime
- `agents/` - Claude Code agent definitions when the plugin ships agents
- `hooks/` - platform hooks; currently only `workflow` owns hooks

## Hook Ownership

`workflow` is the consolidated hook owner for Wiolett plugins. Companion
plugins keep their own skills and MCP servers, but they do not register
separate hooks. The workflow hook detects installed companions such as
`agent-memory` and `merge-request-review` and adds the relevant startup context
or reviewer validation.
