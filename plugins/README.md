# Plugins

Platform plugin sources for the Wiolett Industries marketplace.

Each directory under `plugins/` is an installable plugin bundle. The bundle
contains platform manifests, skills, assets, and any platform-native agent or
hook files needed by that plugin. Generated or synced platform artifacts are
committed on purpose so installs stay turnkey.

Kimi Code installs the repository root as one aggregate plugin by default.
Each bundle also contains a `kimi.plugin.json` for local development and future
per-plugin ZIP distribution. The aggregate behavior and installation commands
are documented in the repository [README](../README.md#install-in-kimi-code).

## Plugin Bundles

- [`agent-memory`](./agent-memory) - persistent scoped memory with global and
  project stores, graph-aware recall, semantic search, and a local dashboard
- [`workflow`](./workflow) - one-path risk-budgeted workflow router with a
  zero-agent fast path, chat-only quick audits, production UI contracts,
  selective execution, and single-pass completion gates
- [`merge-request-review`](./merge-request-review) - ready GitLab MR review
  protocol with discussion intake, CI-first evidence, bounded agents, strict
  findings, and one clean-pass approval

## Layout

Codex plugin metadata lives under each bundle's `.codex-plugin/` directory.
Claude Code plugin metadata lives under `.claude-plugin/`. Kimi Code metadata
lives in `kimi.plugin.json`.

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

Kimi registers only Workflow's bounded `Stop` guard. Its hook entry lives only
in the Kimi manifests, while Codex and Claude continue to use their existing
platform-specific hook configurations. Kimi does not register the
`PostToolUse` output filter because that event is observation-only there.
