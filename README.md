# Wiolett Industries Agent Plugins

![Wiolett Industries Agent Plugins](https://s3.wiolett.net/static/net/wiolett/gh/marketplace/gh-marketplace-banner-2.png)

Unified marketplace source for [Wiolett Industries](https://wiolett.net)
agent plugins.

This repository ships Codex and Claude Code plugin metadata together.
Platform-specific manifests and agent definitions are committed so users can
install directly without running generators or setup commands.

## Why

Most skill packs are easier for humans to browse than for models to execute:
rules repeat, workflows get split into too many tiny skills, and context fills
up with prose that sounds nice but does not change behavior.

This marketplace takes the opposite bias: fewer moving parts, less prompt
sludge, and more explicit state. `workflow` keeps engineering work in clear
phases, `agent-memory` makes project knowledge durable and commit-friendly,
and `merge-request-review` adds stricter review artifacts and note drafts.

The goal is boring infrastructure for agents: workflow, memory, review
discipline, and shared knowledge future sessions should not have to rediscover.

## Quick Start

Register the marketplace, install the plugins you want, then configure model
access for Agent Memory if you want gated writes, embeddings, semantic search,
and graph-link review.

Codex:

```bash
codex plugin marketplace add wiolett-industries/marketplace
```

Claude Code:

```text
/plugin marketplace add wiolett-industries/marketplace
/plugin install agent-memory@wiolett-industries
/plugin install workflow@wiolett-industries
/plugin install merge-request-review@wiolett-industries
```

Agent Memory auth:

```bash
npx -y @wiolett/agent-memory@latest init
```

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

Register the marketplace:

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

Only `agent-memory` needs a model key. `workflow` and `merge-request-review`
store local workflow state and do not call a model provider directly.

Agent Memory uses an OpenAI-compatible key for:

- model-gated memory writes
- AI-generated memory slugs and summaries
- compiled recall/query answers
- automatic graph-link review
- embeddings and semantic search

Configure it interactively:

```bash
npx -y @wiolett/agent-memory@latest init
```

Or configure it non-interactively:

```bash
npx -y @wiolett/agent-memory@latest init \
  --key "$OPENAI_API_KEY" \
  --endpoint "https://api.openai.com/v1" \
  --embedding-model "text-embedding-3-small"
```

The config is stored at:

```text
~/.agents/.wiolett/auth-config.json
```

The file is written with `0600` permissions. You can override the path with
`WIOLETT_AUTH_CONFIG_PATH`, or skip the config file and provide
`OPENAI_API_KEY` in the environment.

The config accepts OpenAI-compatible values:

```json
{
  "openAIKey": "sk-proj-...",
  "endpoint": "https://api.openai.com/v1",
  "embeddingModel": "text-embedding-3-small",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

Supported key aliases include `openAIKey`, `openaiApiKey`,
`openai_api_key`, `apiKey`, and `api_key`. Endpoint aliases include
`endpoint`, `baseUrl`, `baseURL`, `openAIBaseUrl`, and `openaiBaseUrl`.

Other providers work when they implement the OpenAI-compatible endpoints Agent
Memory calls:

- `POST /responses` with Bearer-token auth and OpenAI Responses-style output
- `POST /embeddings` returning numeric embedding vectors
- the configured embedding model, or the default `text-embedding-3-small`
- the default response model used by Agent Memory, `gpt-5-nano`, or a provider
  alias that accepts that model name

Without a key, durable memory files still work, but model-gated writes,
semantic search, embeddings, AI slugs, and graph-link review are disabled or
fall back to cheaper local behavior where possible.

## Agent Memory Dashboard

Inspect a project or global memory store visually:

```bash
npx -y @wiolett/agent-memory@latest view
npx -y @wiolett/agent-memory@latest view global
```

## Repository Layout

- Plugin overview: [`plugins/README.md`](./plugins/README.md)
- Package overview: [`packages/README.md`](./packages/README.md)
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

You can copy and paste the MIT license summary from below.

```text
MIT License

Copyright (c) 2026 Wiolett Industries

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
