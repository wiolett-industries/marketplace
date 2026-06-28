---
{
  "id": "cyeiuloe",
  "file_name": "cyeiuloe_workflow_hooks_schema",
  "tags": [
    "codex",
    "hooks",
    "verification",
    "workflow"
  ],
  "layer": "deep",
  "ref": null,
  "created_at": 1781807766345,
  "updated_at": 1781807766345
}
---
In the project at /Users/knownout/Projects/wiolett/agent-marketplace-next, the workflow context hook outputs must include the common field continue: true in addition to hookSpecificOutput. Without continue, Codex may report an invalid hook JSON/output schema for after-tool/subagent hook handling even if stdout is valid JSON. Verify with pnpm --filter @wiolett/workflow test -- --test-name-pattern=hook, git diff --check, and simulate events directly via node plugins/workflow/hooks/workflow-hook.cjs for SessionStart, SubagentStart, SubagentStop, and PostToolUse.
