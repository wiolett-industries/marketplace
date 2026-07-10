# Merge Request Review Protocol Reference

Read this reference only for MCP state/artifacts, normalized findings, or GitLab note text.

## MCP Artifacts And Tools

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

`approval.md` is an allowed artifact written later with `mr_review_artifact_write`; it is not created by `mr_review_create`.

Tools: `mr_review_status`, `mr_review_create`, `mr_review_update`, `mr_review_artifact_write`, `mr_review_findings_normalize`, and `mr_review_note_draft`.

Supported `mr_review_update` operations: `set_phase`, `set_review_mode`, `set_ci_status`, `set_discussions`, `set_findings`, `set_blockers`, `set_review_round`, `set_clean_rounds`, `upsert_posted_note`, `mark_approved`, and `merge`.

Use the exact live tool schema. Typical operation shapes:

```json
{"type":"set_phase","phase":"reviewing|blocked|findings|clean"}
{"type":"set_discussions","discussions":[]}
{"type":"set_findings","findings":[]}
{"type":"set_blockers","blockers":[]}
{"type":"set_review_round","review_round":1}
{"type":"upsert_posted_note","note":{"id":"N1"}}
{"type":"mark_approved"}
```

## Severity

- `Critical`: serious blocker; do not proceed.
- `Important`: must be fixed in the current loop; task or acceptance undershoot defaults here.
- `Minor`: real non-blocking issue.
- `Notes`: useful observation with no required action.

## Inline Finding

```md
Severity: <Critical|Important|Minor>

Problem:
<specific issue>

Why it matters:
<impact or broken expectation>

Expected fix:
<concrete resolution direction>
```

Use GitLab suggestions only for tiny mechanical one-to-three-line non-logic edits.

## Blocked Note

```md
Status: Review blocked before code review

Why review is blocked:
<MR-backed reason>

Current blockers:
- <blocking check or gate>

Next step:
Restore a reviewable state, then refresh discussions, SHA, diff, and CI.
```

## Final Clean Note

```md
Review status: Clean

Scope check:
<scope result>

Review coverage:
- current discussions, SHA, diff, and applicable gates reviewed
- required verification reviewed
- blocker and draft-note state checked

Result:
No Critical or Important findings remain.
All blocking review threads are resolved.

Decision:
Approved.
```

Use the dominant MR/discussion language; default to English when unclear. Do not expose internal triage labels.
