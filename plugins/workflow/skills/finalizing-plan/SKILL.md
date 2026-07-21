---
name: finalizing-plan
description: Use for standard or assurance completion, explicit independent review, risky handoff, or finalization of an active plan. Run one profile-appropriate verification/review path and stop at the completion latch. Fast work completes directly without this skill unless review is explicitly requested.
---

# Finalizing Plan

Prove the scoped result once, resolve material blockers, close the active plan, and stop. Inherit the existing task-wide assurance, agent, and verification budgets; finalization never creates fresh budgets.

## Completion Latch

Completion requires all of the following:

1. scoped acceptance criteria are satisfied;
2. required fresh verification is green;
3. diff/scope sanity finds no silent shrink, unrelated change, or unwired artifact;
4. no unresolved `BLOCKING` or `HIGH` finding remains;
5. substantial production UI has its scoped `ui-contract` review;
6. the active plan is closed with `workflow_plan_complete`.

Once the latch passes, stop. Do not add another review, rerun unchanged checks, or pursue optional polish.

## Inputs And Verification

Read active state, the plan's acceptance criteria, current diff, latest relevant evidence, and only the artifacts needed by the changed paths. For chunked work, finalize local chunk evidence and run one root integration pass; do not create a reviewer matrix per chunk.

Check scope before style: compare the final diff with the reviewed change class, expected surfaces, must-preserve constraints, and non-goals. If material scope or architecture changed, run one new commitment propose/confirm pass; otherwise do not repeat it. Do not turn finalization into architecture polish.

Before accepting a finding that an artifact is missing, stale, or inconsistent, identify its canonical source/owning contract and whether it is generated, mirrored, cached, vendored, synchronized, or runtime-produced. Use one focused project-memory query when durable provenance can change the verdict, then confirm it against current repository, pipeline, or runtime evidence. Reject findings based only on a derived artifact or unresolved provenance.

Use the verification budget from `using-workflow`:

- run the strongest relevant targeted bundle once after the final change set;
- add integration evidence only for actual crossed boundaries;
- trust a fresh unchanged worker result for its scoped command;
- repeat a check only after relevant edits, inconclusive evidence, or changed external state.

## Independent Review Trigger

Review agents are optional controls, not a completion tax. Use one only for a concrete signal:

- high-consequence auth/security/permission/payment/data/migration/infra/concurrency/public-contract risk;
- broad cross-subsystem integration or genuinely uncertain blast radius;
- missing, contradictory, or flaky verification that local inspection cannot resolve;
- explicit user request for independent review.

Profiles:

- `standard`: local review by default; at most one reviewer for the dominant concrete signal.
- `assurance`: one primary reviewer for the dominant risk plus `workflow_risk_reviewer` when independent high-consequence judgment is required; a second general reviewer is allowed only for a distinct risk and within the existing total budget.

Visible UI does not add a reviewer automatically. Missing named agents fall back to local review unless independence was explicitly required.

When provenance memory affects review, pass the verified source-of-truth fact and current anchor to the selected reviewer; do not make it infer ownership from derived files.

## Findings And Fix Loop

Severities are `BLOCKING`, `HIGH`, `MEDIUM`, and `LOW`; `CLEAN` means no findings. Lint/test suppression, unresolved lint warnings, unapproved 500-line touched code, unrelated responsibility growth, unwired behavior, and silent scope shrink are at least `HIGH`.

Normalize reviewer output before acting. Remove duplicates, unsupported claims, speculative polish, and out-of-scope requests. Fix `BLOCKING`/`HIGH` findings or failed required verification. `MEDIUM` is fixed when it affects accepted quality or risk; `LOW` is reported and accepted unless polish was requested.

After a material fix set, rerun the strongest affected verification once and re-review only the changed delta plus affected integration paths, preferably with the same reviewer. One focused re-review is the default maximum. A second is allowed only for a concrete remaining blocker with a narrow fix; otherwise escalate the tradeoff instead of expanding the loop.

Do not chase perfection indefinitely.

Read [references/review-protocol.md](references/review-protocol.md) only when storing structured findings/review artifacts or coordinating a material fix round.

## UI, Memory, And Close

For substantial production UI, invoke `ui-contract` review mode once. Bounded mockups use their one local visual pass and do not enter a production UI gate.

Before final output, follow the memory completion latch in `using-agent-memory`; do not duplicate its trigger list here.

Use `workflow_findings_normalize`, `workflow_plan_update`, `workflow_plan_artifact_write`, and `workflow_plan_complete` when available. Manual findings/state/artifact writes are fallback only. `workflow_plan_complete` is mandatory for a realized active plan because phase-only updates do not clear root active state.

Report the verdict, material verification evidence, accepted non-blocking findings, and completed plan path. If creating a PR/MR, first match repository templates or recent examples.
