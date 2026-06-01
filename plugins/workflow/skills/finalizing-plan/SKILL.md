---
name: Finalizing Plan
description: Use to complete a plan or review current changes through an agentic review/fix loop with complexity-based exit thresholds
---

# Finalizing Plan

Use this skill before declaring work complete, committing, opening a PR, merging subagent worktrees, or handing off implementation.

This is a loop, not a one-time check.

When workflow MCP tools are available, use `workflow_status` to locate the active plan, `workflow_findings_normalize` before writing findings, and `workflow_plan_update` / `workflow_plan_artifact_write` for review rounds, fix rounds, verdicts, clean streaks, and final phase updates. If MCP is unavailable, make equivalent filesystem edits manually.

## Inputs

Read:

- `.workflow/plans/<MM-DD-YY-slug>/manifest.json` when available
- `.workflow/plans/<MM-DD-YY-slug>/state.json` when available
- `.workflow/plans/<MM-DD-YY-slug>/plan.md` when available
- `.workflow/plans/<MM-DD-YY-slug>/ui-contract.md` when available
- latest `artifacts/review-round-*` and `artifacts/fix-round-*`
- latest `artifacts/ui-review/*` when UI changed
- chunk manifests and states when the plan has `chunks/`
- `git status --short`

If there is no plan-run, use `Intent Gate` first and run finalization against the current diff or requested review scope.

## Chunk Finalization

If the plan has chunks:

1. Finalize each chunk using its own complexity and review matrix.
2. Do not mark a chunk complete until its exit threshold is met.
3. Update the root `state.json` after each chunk finalizes.
4. After all chunks are complete, run a root-level integration review.
5. Root finalization checks cross-chunk wiring, dependency order, shared decisions, and scope consistency.

Chunk findings stay in the chunk's `artifacts/`. Root integration findings stay in the root `artifacts/`.

If a root review finds a cross-chunk issue, create a scoped fix task in the affected chunk when possible. If the fix crosses chunk boundaries, update the root `decisions.md` and `state.json` before assigning work.

## Severity And Verdicts

Review agents must use:

- `BLOCKING`: must fix before progress
- `HIGH`: must fix
- `MEDIUM`: fix unless explicitly deferred
- `LOW`: non-blocking
- `CLEAN`: no findings

Round verdicts:

- `CLEAN`
- `LOW_ONLY`
- `FINDINGS`
- `BLOCKED`

Treat these as at least `HIGH`:

- introduced lint disables, broad ignore directives, warning suppressions, rule removals, or config downgrades
- unresolved lint errors or warnings when a linter exists
- changed code files at or above 500 lines without an approved split
- adding unrelated responsibility to a large or mixed-purpose file
- created artifacts that are not wired into the delivered behavior
- silent scope shrink or unapproved placeholder behavior

## Review Matrix

Run review agents only when subagent authorization is explicit for the current task/session. If authorization is missing, ask once before the first review agent. If the user does not authorize subagents, perform local verification and state that agentic review/fix-loop guarantees are unavailable.

For `simple` work:

- run one combined review agent, `workflow_combined_reviewer`
- preferred model: `gpt-5.4-mini medium`
- scope: overall, sanity, code quality

Exit after one `CLEAN` or `LOW_ONLY` round.

For `medium` or `complex` work:

- run sanity review with `workflow_sanity_reviewer`, preferred model `gpt-5.4 high`
- run overall/code-quality review with `workflow_overall_reviewer`, preferred model `gpt-5.4 medium`
- add scope-compliance review when the task has specific requirements, contract, acceptance criteria, or user-stated constraints
- preferred scope model: `gpt-5.4 medium`

Exit after one `CLEAN` round.

For `very_complex` work:

- run scope-compliance review with `workflow_scope_compliance_reviewer`, preferred `gpt-5.5 xhigh`
- run sanity review with `workflow_sanity_reviewer`, preferred `gpt-5.5 xhigh`
- run overall/code-quality review with `workflow_overall_reviewer`, preferred `gpt-5.5 medium`

Exit after two consecutive acceptable rounds. An acceptable round is `CLEAN`, or `LOW_ONLY` only when the immediately previous round was `CLEAN`. `FINDINGS` and `BLOCKED` reset the acceptable-round streak.

If a named workflow custom review agent is unavailable, stop the affected review step and report that workflow agent sync/setup is missing.

## Review Artifact Layout

Write every review round under:

```text
artifacts/review-round-N/
  scope-compliance.md
  sanity.md
  overall-code-quality.md
  ui-review.md
  findings.json
```

`findings.json` should contain normalized findings:

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

If review finds issues:

1. Run `workflow_fix_triage`, preferred model `gpt-5.5 medium`.
2. Remove duplicates and false positives.
3. Convert remaining findings into 1-4 scoped fix tasks.
4. Assign fix tasks to agents:
   - mechanical fixes: `gpt-5.3-codex-spark medium`
   - reasoning fixes: `gpt-5.5 medium`
5. Every fix agent works in a worktree.
6. Merge fix work only after review gate passes.
7. Reset clean streak when code changes.
8. Start a new review round.

If fix agents are not authorized, keep fixes in the main thread and rerun the strongest available local verification before another review attempt.

If `workflow_fix_triage` or `workflow_implementer` is unavailable, stop the affected fix-loop step and report that workflow agent sync/setup is missing.

Write fix artifacts under:

```text
artifacts/fix-round-N/
  triage.md
  tasks.json
  agents/
```

## UI Finalization Gate

If the diff or plan touches visible UI, run `UI Contract` in `review` mode before claiming completion.

Review against `.workflow/plans/<run>/ui-contract.md` when it exists. If no contract exists for substantial UI work, treat that as a review finding unless the UI change is clearly tiny or purely mechanical.

Write UI review evidence under:

```text
artifacts/ui-review/
  contract-check.md
  browser-check.md
  screenshots.md
  findings.md
```

The UI gate must check:

- contract compliance, or strong frontend fundamentals when no contract exists
- hierarchy, copy, typography, spacing, color/emphasis, icons, and affordances
- loading, error, empty, disabled, hover/focus, partial-data, and success states where applicable
- desktop and mobile viewport behavior
- text overflow, clipping, overlap, and layout stability
- browser/screenshot verification when the app can run locally

For `medium`, `complex`, or `very_complex` UI work, use a specialized UI review agent when workflow subagents are authorized and available. If the specialized agent is unavailable, record the setup gap and perform the strongest local UI review possible.

Verdicts:

- `UI_PASS`: no blocking UI issues remain
- `UI_REVISE`: UI findings must be fixed before completion unless the user explicitly accepts them

UI findings feed the normal fix loop. They do not replace typecheck, tests, build, or code review findings.

## Main Thread Role

The main thread coordinates only:

- starts review agents
- normalizes findings
- launches scoped fix agents
- runs verification commands
- updates `state.json`
- performs minimal diff sanity before merge

It does not replace detailed review agents with its own large in-context review.

## Verification Timing

During an active user-testing loop, do not require full build/test/review after every tiny correction. Finalization begins when the user asks for handoff, completion, commit, PR, or final review, or when implementation work is otherwise complete.

At finalization time, use fresh verification evidence. Do not rely on earlier mid-loop checks for completion claims.

## Final Output

When the exit threshold is met, report:

- final verdict
- review rounds completed
- verification commands and results
- remaining `LOW` findings, if accepted by threshold
- plan-run path, if one exists
