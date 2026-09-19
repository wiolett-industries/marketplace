---
{
  "id": "sb03exgr",
  "file_name": "sb03exgr_claude_code_compat",
  "tags": [
    "agent-sync",
    "claude-code",
    "hooks",
    "tests",
    "workflow"
  ],
  "layer": "deep",
  "ref": null,
  "created_at": 1789838172923,
  "updated_at": 1789838172923
}
---
Claude Code host-compat rules for agent-marketplace-next (established on branch fix/claude-host-compat, 2026-09-19):

- The old `claude` git branch is a dead June implementation; `main` is the single multi-host source. A Claude marketplace registered with `ref: claude` stays frozen at 0.3–0.4 plugin versions while MCP runs `@latest`; re-add the marketplace without a ref.
- Claude Code reports plugin agents as `plugin:agent_name` (e.g. `workflow:workflow_implementer`) in SubagentStart/SubagentStop `agent_type`. `workflow-hook.cjs` strips the namespace in `readInput`; any new agent-type matcher must tolerate the prefix.
- Claude stays hook-optional by test contract: `plugins/workflow/hooks/hooks.json` registers only SessionStart; `plugin-hooks.test.mjs` asserts Stop/SubagentStart/PostToolUse are undefined there. The Bash PostToolUse output filter was removed for all hosts because it silently dropped the middle of command output.
- Skill wording is pinned by `packages/workflow/test/plugin-hooks.test.mjs`: many exact phrases plus a total budget of <5400 words across workflow SKILL.md entrypoints (<850 each). Put new host-specific guidance in `references/*.md` (not counted), e.g. the Host Mapping section of `using-workflow/references/delegation-and-task-chats.md`.
- Codex TOML agent sync in `@wiolett/workflow` and `@wiolett/merge-request-review` is skipped when no Codex home exists and none is set via CODEX_HOME or the package override, so non-Codex hosts never get `~/.codex` or `~/.agents/agents` created.
- Claude implementer agents (`plugins/workflow/agents/workflow_implementer*.md`) use frontmatter `isolation: worktree`; Claude agent model/effort routing is pinned by a test and is deliberate.
- `packages/agent-memory/test/scope.test.mjs` has 3 macOS-only failures from `/var` vs `/private/var` tmpdir realpath; unrelated to feature changes.
