---
name: Review Merge Request
description: ALWAYS use when reviewing, re-reviewing, or approving a GitLab merge request that is ready for review, especially when discussions, CI state, strict scope policing, and fixed review note formats matter
---

# Review Merge Request

Use this skill for GitLab merge requests that are actually ready for review.

This is not a casual skim. This is a gated MR review workflow with explicit blocked, findings, and clean states.

This plugin depends on an external GitLab MCP. If GitLab review actions are not available in the current session, say so clearly and fall back to local review only. For non-GitLab local review, use the consolidated workflow `Finalizing Plan` loop instead.

The bundled Merge Request Review MCP owns only review protocol state. Use it for `.workflow/mr-reviews/` artifacts, normalized findings, note drafts, and active review state. It does not read GitLab, post notes, approve MRs, or replace the external GitLab MCP.

## When to Use

Always use this skill when:

- the user asks to review a GitLab merge request
- the user asks whether a GitLab MR is ready to approve
- the author pushed fixes and the MR needs re-review
- the user wants a careful, discussion-aware review loop instead of a one-pass diff skim

Do not use this skill for draft or WIP merge requests. Skip those until they are ready for review.

## Review States

Every review pass should end in one explicit state:

- `blocked`
- `findings`
- `clean`

Use those states consistently in chat and in GitLab notes.

## Core Workflow

1. Load the merge request and read existing discussions first.
   - Read all current discussions before reviewing code.
   - Understand what was already raised, what is still unresolved, and what changed since the last pass.
   - If an old resolved issue becomes relevant again, create a new linked thread instead of pretending the old context is still current.
   - Use `mr_review_create` to open a review run and `mr_review_update` / `mr_review_artifact_write` to store discussion intake under `.workflow/mr-reviews/`.

2. Inspect task linkage and scope.
   - Extract linked issue or task context when present.
   - If no linked task exists, warn, but continue.
   - Scope compliance is always checked explicitly, even if no violation is found.
   - Treat unrelated cleanup, drive-by refactors, and extra features as out-of-scope by default.

3. Determine review mode.
   - `normal` for ordinary merge requests.
   - `high-risk` for:
     - auth
     - session, identity, wallet, account, or permission state
     - billing or payments
     - migrations
     - infra or deploy behavior
     - public or shared APIs and contracts
     - security-sensitive code
     - broad refactors
     - any MR with broad or uncertain blast radius
   - Release MRs and auth/session/state changes stay `high-risk` unless the linked task and diff prove otherwise.
   - High-risk auth/session/state review must inspect the whole affected flow, not only the visible widget, modal, or file where the symptom appears.

4. Check whether the MR is reviewable.
   - Inspect GitLab pipeline or MR-backed check state first.
   - Check draft notes, pending review notes, and approval state before starting deep review.
   - Infer likely local checks from the repository and run them when feasible.
   - Examples:
     - `package.json` -> likely `npm`, `pnpm`, or `yarn` based checks
     - Go repo -> likely `go test`
     - Rust repo -> likely `cargo test` or `cargo check`
   - For local verification, prefer an isolated temporary worktree checked out at the MR head SHA.
   - Record the exact SHA, commands, and results in the review artifact before relying on local checks.
   - Fail fast if checks are red.
   - If a check succeeds but prints warnings that are clearly pre-existing and unrelated to the MR diff, do not treat them as blockers. Record them as non-blocking context.

5. Post a blocked note only when the blocker is real MR state.
   - Allowed blocker sources:
     - failing GitLab CI or MR status
     - reproducible repo checks in a sane local environment
   - Do **not** post a blocked GitLab note if:
     - local tooling is missing
     - the environment is incomplete or ambiguous
     - the failure might be local-only noise
   - In those cases, report the limitation in chat and do not create a blocked MR note yet.

6. Review the actual change.
   - Read diffs, then read full changed files for non-trivial logic.
   - For small branching or control-flow fixes, explicitly inspect all execution branches, not only the intended path.
   - Inspect commit history only when suspicious.
   - Review generated files, lockfiles, snapshots, vendor, and binaries selectively when they look risky, suspicious, or unexpectedly large.
   - Run the review gates below and record coverage, even when they pass:
     - scope and acceptance-criteria trace
     - code quality and DRY
     - existing-pattern compliance
     - async/state safety
     - contract boundary safety
     - UI loading, error, and empty states when UI is touched
     - deletion and migration safety
     - performance and render-cost risk
     - security basics
     - test delta and verification adequacy
     - final evidence: discussions, CI, local checks, reviewed files, open findings

7. Dispatch the right reviewers.
   - Always use `merge_request_discussion_auditor` for discussion intake when custom agents are available.
   - Use `merge_request_verification_reviewer` for CI/local verification reviewability.
   - `normal`: use `merge_request_primary_reviewer`
   - `high-risk`: use both `merge_request_primary_reviewer` and `merge_request_risk_reviewer`
   - If a named `merge_request_*` agent is unavailable, stop that agentic step and report that merge-request-review agent sync/setup is missing.

8. Post findings.
   - Use inline threads first for concrete file- or line-bound issues.
   - Use top-level notes only for:
     - blocked review state
     - cross-cutting issues spanning multiple files or the whole MR
   - Do not post a summary while blocking issues remain open.
   - Use `mr_review_findings_normalize` before storing findings and `mr_review_note_draft` before posting fixed-format finding notes.

9. Re-review after author updates.
   - Treat new commits as a fresh review pass.
   - Do not assume old conclusions still hold.
   - Resolve plugin-created blocker threads only after the fix is actually verified.

10. Finalize only when the gate is satisfied.
   - `normal`: no `Critical`, no `Important`
   - `high-risk`: both reviewers clean, no `Critical`, no `Important`, and two clean rounds in a row after any code changes
   - Approval requires all plugin-created blocking findings to be resolved
   - Approval requires no pending draft notes or unposted blocker notes
   - Approval requires successful MR CI, or an explicit user-approved exception recorded in the review artifacts
   - Final clean note and approval happen together

## MCP Artifact Layout

Create one review run per MR/re-review session:

```text
.workflow/mr-reviews/<MM-DD-YY-project-iid>/
  manifest.json
  state.json
  discussions.json
  diff-summary.md
  posted-notes.json
  approval.md
  notes-to-post/
  posted-notes/
  artifacts/review-round-N/
```

Use:

- `mr_review_status` before resuming after compaction or uncertainty
- `mr_review_create` after MR metadata is known
- `mr_review_update` for phase, discussions, findings, blockers, posted notes, clean rounds, and approval state
- `mr_review_artifact_write` for discussion summaries, diff summaries, reviewer outputs, notes-to-post, and approval evidence
- `mr_review_findings_normalize` before writing findings to state
- `mr_review_note_draft` to render fixed-format note text before posting through GitLab MCP

## Severity Model

- `Critical`
  Serious merge blocker. Do not proceed.

- `Important`
  Must be fixed in the current review loop. Task undershoot or acceptance-criteria undershoot defaults here.

- `Minor`
  Real issue, but non-blocking.

- `Notes`
  Useful observations without required action.

## Required Review Gates

Every non-blocked review must explicitly cover these gates. If a gate does not apply, say why.

- Scope and acceptance criteria
  - Trace changed behavior back to the linked issue, MR description, or user request.
  - Treat task undershoot, missed acceptance criteria, and unrelated extra behavior as `Important` by default.

- Code quality and DRY
  - Check whether the change follows local architecture and naming patterns.
  - Flag duplicated logic when it creates real maintenance or correctness risk.
  - Do not request stylistic churn that is unrelated to the MR risk.

- Async and state safety
  - Inspect stale closures, cancellation, sequencing, race windows, cache invalidation, retries, and cleanup order.
  - For auth/session/account changes, verify old identity state cannot leak into the new flow.

- Contract and boundary safety
  - Check API, schema, event, storage, feature flag, and provider boundaries.
  - Confirm backward compatibility or migration behavior when shared contracts change.

- UI state coverage
  - When UI is touched, check loading, error, empty, disabled, retry, and partial-data states.
  - Check that controls do not become misleading during async work.

- Deletion and migration safety
  - Confirm removed code/data is not still referenced.
  - For migrations or destructive changes, check rollback, idempotency, and environment assumptions.

- Performance and render cost
  - Check obvious N+1 calls, unnecessary rerenders, unbounded loops, expensive polling, and cache churn.

- Security basics
  - Check authz/authn boundaries, secret exposure, injection, unsafe redirects, unsafe logging, and data leakage.
  - Escalate to `high-risk` if security-sensitive behavior appears during review.

- Test delta and verification adequacy
  - Compare changed behavior to added or updated tests.
  - Missing tests are not automatically blocking, but they are blocking when the risk cannot be verified another way.

- Final evidence
  - Before `clean`, confirm and record reviewed discussions, current SHA, CI result, local commands, full files inspected, findings state, and approval readiness.

## GitLab Comment Formats

Use the fixed structure below in the dominant MR/discussion language. If the language is mixed or unclear, default to English.

When project memory or repo convention specifies a review language, follow that language for GitLab notes and chat summaries. For example, some repos expect Russian review notes even when code and issue text are English.

### Inline Finding Thread

Use this compact fixed template:

```md
Severity: <Critical|Important|Minor>

Problem:
<specific issue>

Why it matters:
<impact, risk, or broken expectation>

Expected fix:
<concrete resolution direction>
```

Use GitLab suggestion-style comments only for tiny mechanical edits:

- 1-3 lines
- non-logic changes
- typo, naming, trivial syntax, similarly safe cleanup

Do not use suggestions for behavior changes or medium-risk edits.

### Blocked Review Top-Level Note

Use this structured blocker note only when the blocker is real MR state:

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

Use this long clean template immediately before approval:

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

- always read discussions first
- always state scope status explicitly
- do not review drafts or WIP merge requests
- do not approve while plugin-created blocker threads remain unresolved
- do not approve while draft notes, unposted blocker notes, or unresolved blocking findings remain
- do not downgrade a high-risk MR into normal mode to save time
- do not post blocked notes for local environment uncertainty
- do not post summary notes while blockers remain open
- do not assume a tiny diff is low risk if it changes branching, caches, invalidation, or contracts
- do not mark warnings as blockers when checks pass and the warnings are clearly unrelated to the MR diff; record them as context instead
- do not call a final pass complete until it has re-read current discussions, current CI, current SHA, and current diff

## Integration

- use this plugin instead of `Finalizing Plan` when the user wants the full GitLab MR workflow
- use external GitLab MCP for GitLab reads/writes and this plugin's MCP for review state/artifacts
