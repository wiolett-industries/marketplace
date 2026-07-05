---
name: Review Merge Request
description: ALWAYS use when reviewing, re-reviewing, or approving a GitLab merge request that is ready for review, especially when discussions, CI state, strict scope policing, and fixed review note formats matter
---

# Review Merge Request

Use for ready GitLab merge requests, re-reviews, and approval readiness. Not for draft/WIP MRs. For non-GitLab local review, use Workflow `Finalizing Plan`.

External GitLab MCP handles GitLab reads/writes. This plugin MCP only owns `.workflow/mr-reviews/` protocol state, findings, note drafts, and approval artifacts.

Every pass ends in one state: `blocked`, `findings`, or `clean`.

## Workflow

1. Load MR and read all current discussions first. Preserve unresolved, resolved, and stale context; if a resolved issue regresses, open a new linked thread. Open a review run with `mr_review_create`; store intake with `mr_review_update` / `mr_review_artifact_write`.
2. Extract linked issue/task when present; warn and continue when absent. Always check scope; unrelated cleanup, drive-by refactors, and extra features are out-of-scope by default.
3. Choose mode:
   - `normal`: ordinary MR
   - `high-risk`: auth/session/identity/wallet/account/permission, billing, migrations, infra/deploy, public/shared APIs/contracts, security-sensitive code, broad refactors, uncertain blast radius
   - release MRs and auth/session/state changes stay high-risk unless task and diff prove otherwise
4. Check reviewability: current CI/MR checks, draft notes, pending notes, approval state, likely local checks. Prefer isolated temporary worktree at MR head SHA for local verification. Record SHA, commands, and results. Red checks block. Passing checks with clearly unrelated pre-existing warnings are context, not blockers.
5. Post a blocked top-level note only for real MR state: failing CI/MR status or reproducible repo checks in a sane local env. For local tooling/env uncertainty, report in chat without blocked GitLab note.
6. Review actual diff plus full changed files for non-trivial logic. Inspect all branches for branching/control-flow fixes. Check generated/lock/snapshot/vendor/binary files only when risky, suspicious, or unexpectedly large.
7. Dispatch agents when available:
   - always `merge_request_discussion_auditor`
   - `merge_request_verification_reviewer` for reviewability
   - `normal`: `merge_request_primary_reviewer`
   - `high-risk`: `merge_request_primary_reviewer` + `merge_request_risk_reviewer`
   - if a named `merge_request_*` agent is unavailable, stop that agentic step
8. Post findings: inline threads for file/line issues; top-level notes only for blocked state or cross-cutting issues. Do not post summaries while blockers remain. Normalize findings before storing; draft notes before posting.
9. Re-review after author updates as a fresh pass. Resolve plugin-created blocker threads only after verified fixes.
10. Finalize only when gate passes:
    - `normal`: no `Critical` or `Important`
    - `high-risk`: both reviewers clean, no `Critical`/`Important`, and two clean rounds in a row after any code changes
    - no unresolved plugin-created blockers, pending draft notes, or unposted blocker notes
    - MR CI succeeds, or a user-approved exception is recorded
    - final clean note and approval happen together
    - before final chat handoff or approval, make an Agent Memory MCP decision when Agent Memory MCP is available; save only durable review/release workflow lessons, repo gotchas, verification sequences, or accepted review patterns; do not substitute Codex built-in memory

## MCP Artifacts

One run per MR/re-review:

```text
.workflow/mr-reviews/<MM-DD-YY-project-iid>/
  manifest.json
  state.json
  discussions.json
  diff-summary.md
  posted-notes.json
  notes-to-post/
  posted-notes/
  artifacts/review-round-N/
```

`approval.md` is an allowed artifact for final approval evidence; it is written later with `mr_review_artifact_write`, not created by `mr_review_create`.

Tools:

- `mr_review_status`: resume after compaction/uncertainty
- `mr_review_create`: after MR metadata is known
- `mr_review_update`: phase, discussions, findings, blockers, posted notes, clean rounds, approval state
- `mr_review_artifact_write`: discussion summaries, diff summaries, reviewer outputs, notes, approval evidence
- `mr_review_findings_normalize`: before state findings
- `mr_review_note_draft`: render fixed-format note text before GitLab posting

## Severity

- `Critical`: serious blocker; do not proceed
- `Important`: must fix in current loop; task or acceptance-criteria undershoot defaults here
- `Minor`: real non-blocking issue
- `Notes`: useful observation, no action required

## Review Loop Discipline

Keep the GitLab review developer-facing. Do not expose internal triage labels in comments; public notes use only `Critical`, `Important`, `Minor`, or `Notes`.

Approval is blocked by `Critical` and `Important`. `Minor` does not block unless it materially affects acceptance, safety, or reviewability. `Notes` never block approval.

Do not open new threads for cosmetic, speculative, or out-of-scope polish unless it affects acceptance or hides a real risk. Prefer mentioning non-blocking context in the final clean note only when useful.

For `normal` mode, one focused re-review after author fixes is usually enough unless `Critical`/`Important` remains or new risky code appears. For `high-risk`, keep the required clean rounds, but after two failed fix/re-review cycles escalate remaining tradeoffs in chat instead of expanding the review indefinitely. Never approve over unresolved `Critical`/`Important` findings.

## Required Gates

Every non-blocked review covers these gates and records coverage:

- scope and acceptance criteria: trace to issue/MR/user request; task undershoot, missed criteria, and unrelated extra behavior default `Important`
- code quality/DRY: local architecture/naming, duplication with real risk, no unrelated style churn
- async/state safety: stale closures, cancellation, sequencing, races, cache invalidation, retries, cleanup; auth/session/account must not leak old identity state
- contract/boundary safety: API, schema, events, storage, feature flags, providers, compatibility/migrations
- UI state coverage when UI touched: loading, error, empty, disabled, retry, partial data, misleading controls
- deletion/migration safety: removed refs, rollback, idempotency, env assumptions
- performance/render cost: N+1, rerenders, unbounded loops, polling, cache churn
- security basics: authz/authn, secrets, injection, redirects, logging, data leakage; escalate sensitive behavior to high-risk
- test delta/verification: missing tests block only when risk cannot be verified otherwise
- final evidence before `clean`: discussions, SHA, CI, local commands, full files, findings state, approval readiness

## GitLab Comment Formats

Use the dominant MR/discussion language; default English when unclear. Follow Agent Memory MCP `scope: "project"` or repo convention for review language.

### Inline Finding Thread

```md
Severity: <Critical|Important|Minor>

Problem:
<specific issue>

Why it matters:
<impact, risk, or broken expectation>

Expected fix:
<concrete resolution direction>
```

Use GitLab suggestions only for tiny mechanical 1-3 line non-logic edits. Do not use suggestions for behavior changes or medium-risk edits.

### Blocked Review Top-Level Note

Only for real MR-backed blockers:

```md
Status: Review blocked before code review

Why review is blocked:
<why the branch is not reviewable yet>

Current blockers:
- <blocking check or MR-backed gate>
- <blocking check or MR-backed gate>

Next step:
Bring the branch back to a reviewable state, then restart review from discussions and current diff.
```

### Final Clean Note

Immediately before approval:

```md
Review status: Clean

Scope check:
<scope result>

Review coverage:
- existing discussions reviewed
- current diff reviewed
- full files inspected for non-trivial changes
- required review gates covered
- local checks reviewed
- CI status reviewed
- current SHA recorded
- draft notes checked

Result:
No Critical or Important findings remain.
All blocking review threads are resolved.

Decision:
Approved.
```

## Hard Rules

- discussions first
- explicit scope status every pass
- no draft/WIP review
- no approval with unresolved plugin blockers, draft notes, unposted blocker notes, or blocking findings
- no downgrading high-risk to save time
- no blocked GitLab notes for local environment uncertainty
- no summary notes while blockers remain
- tiny diff is not low risk when it changes branching, caches, invalidation, or contracts
- unrelated warnings in passing checks are context, not blockers
- final pass must re-read current discussions, CI, SHA, and diff
- no internal triage labels in GitLab comments
