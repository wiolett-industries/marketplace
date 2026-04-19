---
name: Review Merge Request
description: ALWAYS use when reviewing, re-reviewing, or approving a GitLab merge request that is ready for review, especially when discussions, CI state, strict scope policing, and fixed review note formats matter
---

# Review Merge Request

Use this skill for GitLab merge requests that are actually ready for review.

This is not a casual skim. This is a gated MR review workflow with explicit blocked, findings, and clean states.

This plugin depends on an external GitLab MCP. If GitLab review actions are not available in the current session, say so clearly and fall back to local review only.

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

2. Inspect task linkage and scope.
   - Extract linked issue or task context when present.
   - If no linked task exists, warn, but continue.
   - Scope compliance is always checked explicitly, even if no violation is found.
   - Treat unrelated cleanup, drive-by refactors, and extra features as out-of-scope by default.

3. Determine review mode.
   - `normal` for ordinary merge requests.
   - `high-risk` for:
     - auth
     - billing or payments
     - migrations
     - infra or deploy behavior
     - public or shared APIs and contracts
     - security-sensitive code
     - broad refactors
     - any MR with broad or uncertain blast radius

4. Check whether the MR is reviewable.
   - Inspect GitLab pipeline or MR-backed check state first.
   - Infer likely local checks from the repository and run them when feasible.
   - Examples:
     - `package.json` -> likely `npm`, `pnpm`, or `yarn` based checks
     - Go repo -> likely `go test`
     - Rust repo -> likely `cargo test` or `cargo check`
   - Fail fast if checks are red.

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

7. Dispatch the right reviewers.
   - `normal`: use `merge-request-primary-reviewer`
   - `high-risk`: use both `merge-request-primary-reviewer` and `merge-request-risk-reviewer`

8. Post findings.
   - Use inline threads first for concrete file- or line-bound issues.
   - Use top-level notes only for:
     - blocked review state
     - cross-cutting issues spanning multiple files or the whole MR
   - Do not post a summary while blocking issues remain open.

9. Re-review after author updates.
   - Treat new commits as a fresh review pass.
   - Do not assume old conclusions still hold.
   - Resolve plugin-created blocker threads only after the fix is actually verified.

10. Finalize only when the gate is satisfied.
   - `normal`: no `Critical`, no `Important`
   - `high-risk`: both reviewers clean, no `Critical`, no `Important`, and two clean rounds in a row after any code changes
   - Approval requires all plugin-created blocking findings to be resolved
   - Final clean note and approval happen together

## Severity Model

- `Critical`
  Serious merge blocker. Do not proceed.

- `Important`
  Must be fixed in the current review loop. Task undershoot or acceptance-criteria undershoot defaults here.

- `Minor`
  Real issue, but non-blocking.

- `Notes`
  Useful observations without required action.

## GitLab Comment Formats

Use the fixed structure below in the dominant MR/discussion language. If the language is mixed or unclear, default to English.

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
- local checks reviewed
- CI status reviewed

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
- do not downgrade a high-risk MR into normal mode to save time
- do not post blocked notes for local environment uncertainty
- do not post summary notes while blockers remain open
- do not assume a tiny diff is low risk if it changes branching, caches, invalidation, or contracts

## Integration

- use this plugin instead of generic `Review Change` when the user wants the full GitLab MR workflow
- combine with `workflow:Systematic Debugging` when review requires debugging a failing path before deciding whether the MR is safe
