# Final Review And Fix Reference

Read this reference only while persisting structured review evidence or coordinating a material fix round.

## Verdicts

- `CLEAN`: no findings
- `LOW_ONLY`: only accepted non-blocking findings
- `FINDINGS`: material findings require action
- `BLOCKED`: required evidence or execution is unavailable

## Review Artifact

Store one round under `artifacts/review-round-N/`. Create only files that contain relevant evidence; do not create an empty reviewer matrix.

```json
{
  "round": 1,
  "verdict": "FINDINGS",
  "findings": [
    {
      "id": "F1",
      "severity": "HIGH",
      "source": "risk",
      "summary": "Short issue",
      "allowed_scope": ["path/or/module"],
      "expected_fix": "Concrete correction"
    }
  ]
}
```

Normalize with `workflow_findings_normalize` before writing state or `findings.json`.

## Fix Round

One clear finding becomes one direct scoped fix. Use `workflow_fix_triage` only when several material findings require real decomposition and the remaining task-wide agent budget justifies a new context. Delegated fixes use the semantic work class and a worktree.

Store fix evidence under `artifacts/fix-round-N/` only when a durable plan exists. Merge after scoped verification and the applicable review gate.

## UI Evidence

Production UI evidence may live under `artifacts/ui-review/` as contract, browser, screenshot, and findings notes. Only accepted viewports and states are relevant. A UI finding feeds the same fix loop; it never creates a second loop.
