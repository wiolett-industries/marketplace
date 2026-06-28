---
{
  "id": "cyeiuloe",
  "file_name": "cyeiuloe_workflow_hooks_schema",
  "tags": [
    "codex",
    "hooks",
    "verification",
    "workflow",
    "tests",
    "output-schema",
    "hook"
  ],
  "layer": "deep",
  "ref": null,
  "source": "model_inferred",
  "confidence": 0.55,
  "importance": 0.8,
  "created_at": 1781807766345,
  "updated_at": 1782687395119
}
---
In this repo, the workflow context hook outputs must include the common field continue: true in addition to hookSpecificOutput. Without continue, Codex may report an invalid hook JSON/output schema for after-tool or subagent hook handling even if stdout is valid JSON. Verify with pnpm --filter @wiolett/workflow test -- --test-name-pattern=hook, git diff --check, and direct event simulation via node plugins/workflow/hooks/workflow-hook.cjs for SessionStart, SubagentStart, SubagentStop, and PostToolUse.
