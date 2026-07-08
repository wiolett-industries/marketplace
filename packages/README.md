# Packages

Published MCP runtime packages used by the Wiolett Industries plugins.

The package layer contains executable MCP servers and shared runtime logic. The
plugin layer in [`../plugins`](../plugins) contains marketplace manifests,
skills, platform hooks, and install-facing metadata.

## Packages

- [`@wiolett/agent-memory`](./agent-memory) - Agent Memory MCP server, auth
  setup CLI, model/embedding provider support, memory storage, graph tools, and
  local dashboard
- [`@wiolett/workflow`](./workflow) - Workflow MCP server, `.workflow/`
  artifact/state helpers, findings normalization, handoff helpers, and Codex
  workflow agent sync
- [`@wiolett/merge-request-review`](./merge-request-review) - Merge Request
  Review MCP server, `.workflow/mr-reviews/` state helpers, fixed-format note
  drafts, and Codex merge_request_* agent sync

## Runtime Boundary

Packages expose deterministic MCP tools and CLIs. They do not replace model
judgment:

- `agent-memory` stores, searches, recalls, and links durable memory.
- `workflow` creates and updates workflow artifacts but does not write the
  substantive plan or launch agents by itself.
- `merge-request-review` stores local MR review protocol state but does not
  read GitLab, post GitLab notes, approve MRs, or merge code.

## Development

Run package commands from the repository root with pnpm filters:

```bash
pnpm --filter @wiolett/agent-memory test
pnpm --filter @wiolett/workflow test
pnpm --filter @wiolett/merge-request-review test
```

The root commands run the package set together:

```bash
pnpm test
pnpm typecheck
```
