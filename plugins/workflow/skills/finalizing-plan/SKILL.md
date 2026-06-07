---
name: Finalizing Plan
description: Use to complete a plan or review current changes through an agentic review/fix loop with complexity-based exit thresholds
---

# Finalizing Plan

Use before declaring complete, committing, opening a PR, merging subagent worktrees, or handing off. This is a review/fix loop, not a one-time check. Inherit `Using Workflow` shared rules.

Use MCP when available: `workflow_status`, `workflow_findings_normalize`, `workflow_plan_update`, `workflow_plan_artifact_write`. Manual findings/state/artifact writes are fallback only.

## Inputs

Read available plan artifacts: `manifest.json`, `state.json`, `plan.md`, `ui-contract.md`, latest review/fix/UI artifacts, chunk manifests/states, and `git status --short`.

If no plan-run exists, use `Intent Gate` first and finalize against the current diff or requested review scope.

For chunked plans: finalize each chunk by its own complexity, update root state, then run root integration review for cross-chunk wiring, dependency order, shared decisions, and scope.

## Severity, Verdicts, Hard Findings

Severities: `BLOCKING`, `HIGH`, `MEDIUM`, `LOW`; `CLEAN` means no findings.
Round verdicts: `CLEAN`, `LOW_ONLY`, `FINDINGS`, `BLOCKED`.

Treat as at least `HIGH`:

- lint/test rule disable, suppression, ignore, or config downgrade
- unresolved lint errors/warnings when a linter exists
- changed code files at or above 500 lines without approved split
- unrelated responsibility added to a large/mixed file
- unwired artifacts or placeholder behavior
- silent scope shrink

## Review Matrix

Run review agents only with explicit subagent authorization. Review agents are read-only; any change they recommend becomes a scoped fix task. If authorization is denied, do local verification and state unavailable guarantees.

`simple`:

- `workflow_combined_reviewer`, `gpt-5.4-mini medium`
- scope: overall + sanity + code quality
- exit: one `CLEAN` or `LOW_ONLY`

`medium`/`complex`:

- `workflow_sanity_reviewer`, `gpt-5.4 high`
- `workflow_overall_reviewer`, `gpt-5.4 medium`
- add `workflow_scope_compliance_reviewer`, `gpt-5.4 medium`, when requirements/contract/acceptance criteria are specific
- exit: one `CLEAN`

`very_complex`:

- `workflow_scope_compliance_reviewer`, `gpt-5.5 xhigh`
- `workflow_sanity_reviewer`, `gpt-5.5 xhigh`
- `workflow_overall_reviewer`, `gpt-5.5 medium`
- exit: two acceptable rounds; acceptable is `CLEAN`, or `LOW_ONLY` only immediately after `CLEAN`; `FINDINGS`/`BLOCKED` reset streak

If a named review agent is unavailable, stop the affected step.

## Artifacts

Write reviews under:

```text
artifacts/review-round-N/
  scope-compliance.md
  sanity.md
  overall-code-quality.md
  ui-review.md
  findings.json
```

`findings.json`:

```json
{
  "round": 1,
  "verdict": "FINDINGS",
  "findings": [
    {
      "id": "F1",
      "severity": "HIGH",
      "source": "sanity",
      "summary": "Short issue",
      "allowed_scope": ["path/or/module"],
      "expected_fix": "Concrete correction"
    }
  ]
}
```

## Fix Loop

When findings remain:

1. Run `workflow_fix_triage`, `gpt-5.5 medium`.
2. Remove duplicates/false positives.
3. Produce 1-4 scoped fix tasks.
4. Assign tiny mechanical fixes to `gpt-5.3-codex-spark low`, small/medium mechanical fixes to `gpt-5.3-codex-spark medium`, analysis-heavy fixes to `gpt-5.5 high/xhigh`, and broad implementation fixes to `gpt-5.4` at the needed effort.
5. Fix agents use worktrees.
6. Merge only after review gate.
7. Reset clean streak when code changes.
8. Start next review round.

If fix agents are not authorized, fix in main thread and rerun strongest local verification before review. If `workflow_fix_triage` or `workflow_implementer` is unavailable, stop.

Do not chase perfection indefinitely. Use review/fix loops to remove blockers, regressions, scope drift, broken verification, and material quality issues. Time-box additional rounds once the remaining findings are `LOW`, cosmetic, speculative, or outside the requested scope. For `simple`/`medium`, normally stop after one clean or low-only round unless a concrete blocker remains. For `complex`/`very_complex`, run the required validation, but after two unsuccessful fix-review cycles escalate to the parent/user with remaining tradeoffs instead of burning more tokens on marginal polish.

Review budget: `simple` and `medium` normally get at most 1 fix-review round unless `BLOCKING`/`HIGH` remains; `complex` gets at most 2; `very_complex` gets 2 and only rarely 3 when there is a concrete blocker and a narrow fix path. When the budget is exhausted, report accepted lows and unresolved tradeoffs instead of starting another broad round.

Fix artifacts:

```text
artifacts/fix-round-N/
  triage.md
  tasks.json
  agents/
```

## UI Gate

If visible UI changed, run `UI Contract` in `review` mode before completion. If substantial UI lacks a contract, treat that as a finding unless clearly tiny/mechanical.

UI artifacts:

```text
artifacts/ui-review/
  contract-check.md
  browser-check.md
  screenshots.md
  findings.md
```

Check contract/fundamentals, hierarchy, copy, typography, spacing, color/emphasis, icons, affordances, loading/error/empty/disabled/hover/focus/partial/success states, desktop/mobile, text overflow/clipping/overlap/layout stability, and browser/screenshot evidence when runnable.

UI verdicts: `UI_PASS` or `UI_REVISE`. UI findings feed the normal fix loop and do not replace code verification.

## Main Thread And Output

Main thread coordinates agents, normalizes findings, runs verification commands, updates state, and performs minimal diff sanity. It does not replace detailed review agents with large in-context review.

Do not require full build/test/review after every tiny user-testing correction. At finalization, use fresh verification evidence.

When Agent Memory is available, make the memory decision before final output: save/update durable repo workflow, verification sequence, root cause, user preference, or recurring gotcha; skip raw progress, obvious code facts, and one-off edits.

When exit threshold is met, report final verdict, review rounds, verification commands/results, accepted `LOW` findings, and plan-run path.

If creating a PR/MR, first inspect recent project PRs/MRs or templates when available, then match their title/description structure and tone.
