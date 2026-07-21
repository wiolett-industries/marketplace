---
name: review-merge-request
description: Use for an actual ready, non-draft GitLab merge request review, re-review, or approval decision when current discussions, diff, CI, scope, findings, and approval state must be checked. Do not trigger for casual MR discussion, draft/WIP work, GitHub PRs, or local code review.
---

# Review Merge Request

Run one discussion-aware GitLab review path. This skill is mutually exclusive with Workflow `finalizing-plan` for the same review. External GitLab MCP owns GitLab reads/writes; this plugin MCP owns only `.workflow/mr-reviews/` protocol state and artifacts.

Every pass ends in `blocked`, `findings`, or `clean`. `approved` is the post-clean state after the final note and approval occur together.

## Intake And Mode

1. Load current MR metadata, SHA, diff, CI/check state, and every current discussion before code review. Preserve unresolved, resolved, and stale context; if a resolved issue regresses, create a new linked thread.
2. Extract the linked task when present. Warn and continue when absent. Treat unrelated cleanup, drive-by refactors, and extra features as out of scope unless explicitly justified.
3. Choose mode:
   - `normal`: ordinary bounded MR.
   - `high-risk`: auth/session/identity/wallet/account/permission, billing, destructive data/migrations, infra/deploy, security-sensitive behavior, public/shared contracts, concurrency/state invalidation, broad refactor, or uncertain blast radius.
4. Open or resume one review run at the current SHA with the MR review MCP.

Draft/WIP MRs are not reviewable. Red MR/CI checks or reproducible failing required repo checks produce `blocked`. Local tooling uncertainty is reported in chat, not as a blocked GitLab note.

## Evidence Scope

Review the actual diff and trace affected execution paths. Read a full changed file when the diff lacks control-flow, state, contract, or integration context; do not read every generated, lock, snapshot, vendor, binary, or trivial file by ritual. Inspect those only when risky, suspicious, or unexpectedly large.

When Agent Memory exists, query once before findings for the changed domain's source of truth and generation/release workflow. Confirm hits against current repository, pipeline, or runtime evidence; ignoring relevant memory is a review error.

Before a missing/stale/inconsistent finding, identify canonical source, provenance class, update boundary, and MR ownership; verify there. Unknown provenance is uncertainty, not a finding. A derived artifact alone is not evidence. State current proof.

Use current CI as primary verification when it clearly covers the change. Run local checks or a temporary worktree only to reproduce a finding, cover missing/ambiguous evidence, or validate behavior CI cannot prove. Do not duplicate clear green CI merely to accumulate evidence.

Apply only relevant review gates and record irrelevant gates as not applicable. The required lenses are scope/acceptance, correctness, affected async/state behavior, changed contracts/boundaries, migration/deletion safety, security, performance, UI states when UI changed, and verification adequacy. A tiny diff is still high risk when it changes branching, caches, invalidation, identity, or contracts.

## Agent Budget

Authorization is permission, not activation. The parent owns discussions, scope, evidence, and ordinary review unless independence materially changes the decision.

- `normal`: 0 agents by default; at most 1 total, normally `merge_request_primary_reviewer`, only for non-trivial cross-cutting logic or uncertain review evidence.
- `high-risk`: use `merge_request_risk_reviewer` for independent high-consequence judgment when available; at most 2 agents total, adding `merge_request_primary_reviewer` only for a distinct correctness/integration risk.
- `merge_request_discussion_auditor` is only for large, stale, or contradictory histories.
- `merge_request_verification_reviewer` is only for large or ambiguous CI/local evidence.

Support agents consume the same mode budget. If one consumes a slot, the parent covers the ordinary corresponding step. Missing named agents fall back locally unless independent review was explicitly required.

Pass verified provenance and its current anchor to support reviewers.

## Findings And Re-review

Post file/line findings as inline threads. Use top-level notes only for real MR-backed blocked state or cross-cutting issues. Normalize findings and draft fixed-format notes before posting. Never expose internal triage labels in GitLab comments.

`Critical` and `Important` block approval. `Minor` does not block unless it materially affects acceptance, safety, or reviewability. `Notes` never block approval. Do not open threads for cosmetic, speculative, or out-of-scope polish.

After author fixes, refresh discussions, SHA, diff, and CI. Re-review only the changed delta and affected integration paths, preferably with the same reviewer; do not restart every support agent. Run a full pass only if the fix broadens scope or blast radius. After two failed fix/re-review cycles, escalate the remaining tradeoff in chat instead of expanding the loop.

## Clean And Approval Latch

Finalize only when:

- current SHA, discussions, diff, and CI have been refreshed;
- no `Critical` or `Important` finding remains;
- no unresolved plugin-created blocker, pending draft note, or unposted blocker note remains;
- required verification is green or an explicit user exception is recorded;
- high-risk independent coverage is current when required.

One clean pass at the current SHA is sufficient. Post the final clean note and approve together. The final MCP mutation is `mr_review_complete`; it marks the run `approved` and clears the matching `active_review` pointer. Do not substitute `set_phase`, omit this terminal latch, or repeat an unchanged clean review.

Before final chat output, follow `using-agent-memory` for its memory completion latch; do not duplicate its policy here.

Read [references/protocol.md](references/protocol.md) before writing MCP review artifacts, storing findings, or posting GitLab notes.
