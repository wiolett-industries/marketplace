# Workflow

Merged Codex workflow plugin for feature discovery, architecture design, implementation discipline, plan quality, review loops, and verification.

This plugin ships:

- skills for brainstorming, feature development, planning, plan review, execution, debugging, worktree setup, review, and verification
- specialist explorer, architect, reviewer, and risk-reviewer agents

The review system is built around three levels:

- `Review Completed Task` after each meaningful task or plan section
- `Review Completed Feature` for larger finished changes
- `Review High-Risk Change` for breaking changes, risky refactors, migrations, and codebase-wide verification

Planning discipline includes:

- `Writing Plans` for implementation plans that preserve approved scope
- `Plan Review` for checking requirement coverage, wiring, dependencies, and hidden scope reduction before execution

Related plugins in this marketplace:

- `codebase-scan` for brownfield codebase onboarding and architecture scanning
- `ui-contract-review` for frontend design contracts and retroactive UI audits
- `spike-investigation` for bounded feasibility spikes before planning
- `test-driven-development` for strict TDD discipline
- `multi-agent-workflows` for subagent-driven and parallel-agent execution

## Attribution

This plugin includes adapted material from:

- `obra/superpowers` (MIT)

See:
- [`NOTICE.md`](./NOTICE.md)
- [`LICENSE`](./LICENSE)
