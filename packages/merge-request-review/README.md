# Merge Request Review

MCP runtime for the Merge Request Review Codex plugin.

On startup it:

- syncs canonical `merge_request_*` custom agents into `~/.codex/agents/` with GPT-5.6 Luna for structured intake/verification, Terra for primary review, and Sol for high-risk review
- creates best-effort compatibility links under `~/.agents/agents/`
- registers filesystem-backed `.workflow/mr-reviews/` state and artifact tools

This package does not talk to GitLab. The model or an external GitLab MCP is responsible for fetching MR metadata, discussions, diffs, CI state, posting notes, and approving merge requests. This MCP owns only the review protocol state, local artifacts, normalized findings, and fixed-format note drafts.

## Tools

- `mr_review_status`: read active review state and latest review runs.
- `mr_review_create`: create a `.workflow/mr-reviews/<slug>/` run with manifest, state, discussions, notes, and artifact directories.
- `mr_review_update`: apply structured operations to the active or named review run.
- `mr_review_complete`: mark a clean, externally approved review complete and clear the matching active-review pointer.
- `mr_review_artifact_write`: write allowed files inside a review run without path escape.
- `mr_review_findings_normalize`: normalize MR review findings, preserving `evidence_basis`, into Critical/Important/Minor/Notes order.
- `mr_review_note_draft`: render a fixed-format finding note with required canonical evidence basis without posting it.

Supported `mr_review_update` operations: `set_phase`, `set_review_mode`, `set_ci_status`, `set_discussions`, `set_findings`, `set_blockers`, `set_review_round`, `set_clean_rounds`, `upsert_posted_note`, `mark_approved`, and `merge`.

## CLI

```text
merge-request-review        Start MCP stdio server
merge-request-review --help Print help
```
