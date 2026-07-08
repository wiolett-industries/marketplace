# Contributing

Thanks for helping improve the Wiolett Industries agent marketplace.

This repo contains two layers:

- `plugins/` - installable Codex and Claude Code plugin bundles: manifests,
  skills, assets, hooks, and platform-native agent files
- `packages/` - published MCP runtime packages and CLIs used by those plugins

## Setup

```bash
pnpm install
pnpm test
pnpm typecheck
```

Use the repository-pinned package manager from `package.json` when possible.

## Development Notes

- Keep plugin skills aligned with the actual MCP tool surface.
- Prefer canonical MCP tool names in new docs and skills.
- Keep generated or platform-native plugin artifacts in git when they are
  required for turnkey installation.
- Project `.memory/` markdown, index, embedding, and graph files are expected
  team knowledge artifacts and may be committed. Generated SQLite cache files
  `.memory/memory.db*` should stay ignored.
- `.workflow/` artifacts are local workflow state and should stay ignored
  unless explicitly versioned for a specific reason.

## Versioning

When changing runtime behavior or install-facing plugin behavior, update patch
versions consistently:

- root `package.json` when marketplace-level metadata changes
- affected `packages/*/package.json`
- matching runtime `VERSION` constants
- affected Codex and Claude plugin manifests under `plugins/*`

## Verification

For broad changes, run:

```bash
pnpm test
pnpm typecheck
git diff --check
```

For focused runtime changes, package filters are fine:

```bash
pnpm --filter @wiolett/agent-memory test
pnpm --filter @wiolett/workflow test
pnpm --filter @wiolett/merge-request-review test
```

## Pull Requests

Keep pull requests focused and describe:

- what changed
- which plugin/package is affected
- how it was verified
- any release/versioning notes

Do not include secrets, API keys, private webhook URLs, or raw credentials in
issues, pull requests, tests, docs, or memory files.
