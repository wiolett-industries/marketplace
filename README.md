# Wiolett Marketplace

Claude Code plugin marketplace for Wiolett Industries.

This repository provides a Claude Code marketplace source, exposed through [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json).

The marketplace currently ships:

- [`agent-memory`](./plugins/agent-memory) — persistent scoped memory with compiled recall and automatic graph links
- [`workflow`](./plugins/workflow) — modular agentic workflow framework for intent, planning, execution, review/fix loops, and consolidated hooks
- [`merge-request-review`](./plugins/merge-request-review) — discussion-aware GitLab merge request review with strict gates and approval discipline

## Install In Claude Code

Register the marketplace with Claude Code:

```
/plugin marketplace add wiolett-industries/marketplace@claude
```

Or use the full URL form:

```
/plugin marketplace add https://github.com/wiolett-industries/marketplace.git#claude
```

After the marketplace is registered, install the plugin you want:

```
/plugin install agent-memory@wiolett-industries
/plugin install workflow@wiolett-industries
/plugin install merge-request-review@wiolett-industries
```

The marketplace itself does not require an OpenAI API key. The `agent-memory` plugin uses `OPENAI_API_KEY` or `~/.agents/.wiolett/auth-config.json` for model-gated writes, embeddings, semantic search, and graph-link review when configured.

After installing `agent-memory`, configure model access once:

```bash
npx -y @wiolett/agent-memory@latest init
```

The init command prompts for an OpenAI API key and writes `~/.agents/.wiolett/auth-config.json`.

## Included Plugins

### Agent Memory

`agent-memory` gives the agent durable memory in two scopes:

- global memory for preferences, model behavior, and cross-project patterns
- project memory for repo-specific workflows, conventions, redacted integration processes, and operational knowledge

It supports lazy no-op reads for projects without memory, model-gated writes, compiled recall/query answers, and automatic graph links between graph-capable memories. When `workflow` is also installed, the consolidated workflow hook adds Agent Memory startup reminders.

### Workflow

`workflow` is the consolidated engineering workflow plugin. It includes intent gating, context discovery, frontend UI contracts, durable `.workflow/plans/<date-slug>/` and `.workflow/audits/<date-slug>/` artifacts, stateful execution, worktree-isolated subagent policy, final review/fix loops, a SessionStart context hook, and a bundled MCP server that provides deterministic plan/audit artifact tools.

### Merge Request Review

`merge-request-review` gives Claude Code a careful GitLab merge request review workflow with discussion intake, strict findings, re-review loops, fixed note formats, and approval only after blocker threads are resolved. When `workflow` is also installed, the consolidated workflow hook applies merge-request reviewer prompts and output checks.

## Repository Layout

- marketplace manifest: [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json)
- plugin: [`plugins/agent-memory`](./plugins/agent-memory)
- plugin: [`plugins/workflow`](./plugins/workflow)
- plugin: [`plugins/merge-request-review`](./plugins/merge-request-review)
- MCP implementation: [`packages/agent-memory`](./packages/agent-memory)
- Workflow MCP implementation: [`packages/workflow`](./packages/workflow)
- Merge request review implementation: [`packages/merge-request-review`](./packages/merge-request-review)
