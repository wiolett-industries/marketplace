---
{
  "id": "4brr4cdo",
  "file_name": "4brr4cdo_postcompact_sessionstart",
  "tags": [
    "codex",
    "hooks",
    "postcompact",
    "workflow"
  ],
  "layer": "deep",
  "ref": null,
  "created_at": 1786642683019,
  "updated_at": 1786642683019
}
---
Codex PostCompact accepts only its common hook output fields and rejects hookSpecificOutput.additionalContext as invalid JSON output. To inject post-compaction recovery context, configure SessionStart to match source=compact and emit its supported hookSpecificOutput.additionalContext there. Keep any retained PostCompact handler limited to common output such as {"continue": true}.
