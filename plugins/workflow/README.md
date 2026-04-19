# Workflow

Merged Codex workflow plugin for feature discovery, architecture design, implementation discipline, review loops, and verification.

This plugin ships:

- `Using Workflow` as the entry skill for every conversation start and post-compaction restart
- skills for brainstorming, feature development, planning, execution, debugging, worktree setup, review, and verification
- specialist explorer, architect, reviewer, and risk-reviewer agents

The review system is built around three levels:

- `Review Change` in `task` mode after each meaningful task or plan section
- `Review Change` in `feature` mode for larger finished changes
- `Review Change` in `high-risk` mode for breaking changes, risky refactors, migrations, and codebase-wide verification

Planning discipline includes:

- `Writing Plans` for codebase exploration, comprehensive draft planning, self-review, and final implementation plan creation

Related plugins in this marketplace:

- `codebase-scan` for brownfield codebase onboarding and architecture scanning
- `ui-contract-review` for frontend design contracts and retroactive UI audits
- `spike-investigation` for bounded feasibility spikes before planning
- `test-driven-development` for strict TDD discipline
- `multi-agent-workflows` for subagent-driven and parallel-agent execution
- `live-browser-debug` for real-browser frontend debugging and delayed incident capture

## Attribution

This plugin includes adapted material from:

- `obra/superpowers` (MIT)

See:
- [`NOTICE.md`](./NOTICE.md)
- [`LICENSE`](./LICENSE)
