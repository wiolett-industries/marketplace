# Merge Request Review

Generic GitLab merge request review workflow for Codex and Claude Code.

This plugin ships:

- `review-merge-request` as the ready, non-draft GitLab MR entry skill
- `merge_request_primary_reviewer` for correctness, task fit, regression risk, and verification quality
- `merge_request_risk_reviewer` for high-risk merge requests with meaningful blast radius
- `merge_request_discussion_auditor` for existing discussion intake and unresolved blocker state
- `merge_request_verification_reviewer` for CI/local verification quality and reviewability
- a bundled MCP server that syncs `merge_request_*` custom agents globally and stores review state and artifacts under `.workflow/mr-reviews/` by default

The MCP reads an optional `mcp.merge-request-review.artifacts.root` from
`$AGENTS_HOME/.wiolett/config/mcp-config.yml`. Agent Memory owns generation and
migration of that file; this plugin remains a read-only consumer.

This plugin does not register platform hooks directly. When the `workflow` plugin is installed, its consolidated hook detects `merge-request-review` and applies merge_request_* reviewer prompts and output validation.

Agent use is bounded by review mode rather than accumulated per step. Normal reviews use zero agents by default and at most one when independent review materially changes the decision; high-risk reviews use at most two. Discussion and verification agents are reserved for large or ambiguous evidence and consume the same budget instead of being added automatically. Canonical Codex agents use GPT-5.6 Luna for discussion/verification intake, GPT-5.6 Terra for primary review, and GPT-5.6 Sol for high-risk review.

The workflow is intentionally strict:

- existing MR discussions are always read before code review starts
- current GitLab CI is primary evidence; local checks fill concrete verification gaps
- full files are inspected when the diff lacks control-flow, state, contract, or integration context
- missing/stale artifact findings require canonical source, provenance, update-boundary, and current-proof evidence; derived artifacts alone are insufficient
- blocking findings are posted as inline threads by default
- blocked, findings, and clean states are explicit; approved is the post-clean approval state
- final clean note and approval happen together
- one clean pass at the current SHA is sufficient
- approval is allowed only when plugin-created blocking findings are resolved

The skill applies only to actual ready GitLab MR review/re-review/approval work.
It does not trigger for drafts, casual MR discussion, GitHub PRs, or local code
review, and it is not combined with Workflow `finalizing-plan` for the same MR.

High-risk mode is used for merge requests that touch sensitive categories such as auth, payments, migrations, infra, public/shared APIs, security-sensitive code, or any change with broad or uncertain blast radius.

This plugin does not bundle its own GitLab integration. It depends on an external GitLab MCP being available in the agent session.

## MCP Tools

The bundled MCP owns review protocol state only. It does not read GitLab, post notes, or approve merge requests.

- `mr_review_status`
- `mr_review_create`
- `mr_review_update`
- `mr_review_complete`
- `mr_review_artifact_write`
- `mr_review_findings_normalize`
- `mr_review_note_draft`

Supported `mr_review_update` operations: `set_phase`, `set_review_mode`, `set_ci_status`, `set_discussions`, `set_findings`, `set_blockers`, `set_review_round`, `set_clean_rounds`, `upsert_posted_note`, `mark_approved`, and `merge`.
