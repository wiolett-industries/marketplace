# Wiolett Industries Agent Plugins

Unified marketplace source for Wiolett Industries agent plugins.

This repository ships both Codex and Claude Code plugin metadata from the same
branch. Platform-specific manifests and generated agent definitions are committed
so users can install directly without running generators or setup commands.

## Plugins

- [`agent-memory`](./plugins/agent-memory) - persistent scoped memory with
  compiled recall, automatic graph links, graph pathfinding, health/prune
  maintenance, and a local read-only dashboard
- [`workflow`](./plugins/workflow) - modular agentic workflow framework for
  intent, planning, execution, audits, UI contracts, and review/fix loops
- [`merge-request-review`](./plugins/merge-request-review) - discussion-aware
  GitLab merge request review with strict gates and approval discipline

## Install In Codex

Register the marketplace:

```bash
codex plugin marketplace add wiolett-industries/marketplace
```

For local development:

```bash
codex plugin marketplace add /absolute/path/to/local/marketplace
```

Then install the plugins you want from Codex.

## Install In Claude Code

Register the same branch as a Claude Code marketplace:

```text
/plugin marketplace add wiolett-industries/marketplace
```

Then install the plugins you want:

```text
/plugin install agent-memory@wiolett-industries
/plugin install workflow@wiolett-industries
/plugin install merge-request-review@wiolett-industries
```

## Model Access

`agent-memory` uses `OPENAI_API_KEY` or
`~/.agents/.wiolett/auth-config.json` for model-gated writes, embeddings,
semantic search, and graph-link review.

Configure once:

```bash
npx -y @wiolett/agent-memory@latest init
```

## Agent Memory Dashboard

Inspect a project or global memory store visually:

```bash
npx -y @wiolett/agent-memory@latest view
npx -y @wiolett/agent-memory@latest view global
```

## Project Memory In Git

Project Agent Memory is meant to be shareable when a repo opts into it.
Commit these files when project memory changes:

- `.memory/memories/*.md`
- `.memory/index/*.md`
- `.memory/embeddings/*.embeddings`
- `.memory/graph/*.edges.json`

Do not commit `.memory/memory.db*`; it is a local SQLite cache.

Memory content should be portable. Use repo-relative paths such as
`plugins/workflow/README.md` or placeholders like `<repo>`. Do not store
machine-local absolute paths such as `/Users/name/...`, `/home/name/...`,
`/tmp/...`, or Windows user-profile paths in shared project memory.

## Recommended Codex Setup

Codex works best with these workflow plugins when subagents are explicitly
authorized. Add a standing authorization to the project's `AGENTS.md` or to a
global Codex `AGENTS.md`:

```md
The user grants standing authorization to launch subagents for non-trivial
engineering work without asking again. Treat this standing authorization as an
explicit user request for subagents, delegation, and parallel agent work whenever
subagents would materially help.

Use subagents proactively for suitable exploration, implementation,
verification, and review tasks. Keep work local for trivial tasks, tightly
coupled blocking work, or when the user explicitly asks not to use subagents or
asks to pause.
```

For Codex CLI/App installs that support `developer_instructions`, the same
authorization can live in `~/.codex/config.toml`:

```toml
developer_instructions = """
The user grants standing authorization to launch subagents for non-trivial
engineering work without asking again. Treat this standing authorization as an
explicit user request for subagents, delegation, and parallel agent work whenever
subagents would materially help.

Use subagents proactively for suitable exploration, implementation,
verification, and review tasks. Keep work local for trivial tasks, tightly
coupled blocking work, or when the user explicitly asks not to use subagents or
asks to pause.
"""
```

Without a standing authorization, give explicit subagent permission in each
chat before asking Workflow to run agentic exploration, implementation, or
review. Codex may otherwise instruct the model to avoid subagents by default.

## Repository Layout

- Codex marketplace: [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
- Claude Code marketplace: [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json)
- Codex plugin manifests: `plugins/*/.codex-plugin/plugin.json`
- Claude Code plugin manifests: `plugins/*/.claude-plugin/plugin.json`
- Codex workflow/MR agents: `packages/*/agents/*.toml`
- Claude Code workflow/MR agents: `plugins/*/agents/*.md`

The platform-specific agent files are intentionally committed. Maintainers may
use generators in the future, but generated outputs must stay in git so install
and runtime behavior remain turnkey.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
```

## License

MIT - see [LICENSE.md](./LICENSE.md).
