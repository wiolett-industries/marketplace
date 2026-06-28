# Merge Request Review

Generic GitLab merge request review workflow for Codex and Claude Code.

This plugin ships:

- `Review Merge Request` as the entry skill
- `merge_request_primary_reviewer` for correctness, task fit, regression risk, and verification quality
- `merge_request_risk_reviewer` for high-risk merge requests with meaningful blast radius
- `merge_request_discussion_auditor` for existing discussion intake and unresolved blocker state
- `merge_request_verification_reviewer` for CI/local verification quality and reviewability
- a bundled MCP server that syncs `merge_request_*` custom agents globally and stores `.workflow/mr-reviews/` state and artifacts

This plugin does not register platform hooks directly. When the `workflow` plugin is installed, its consolidated hook detects `merge-request-review` and applies merge_request_* reviewer prompts and output validation.

The workflow is intentionally strict:

- existing MR discussions are always read before code review starts
- local checks and GitLab CI state are checked before deep review
- non-trivial changes require full-file inspection, not diff-only review
- blocking findings are posted as inline threads by default
- blocked, findings, and clean states are explicit
- final clean note and approval happen together
- approval is allowed only when plugin-created blocking findings are resolved

High-risk mode is used for merge requests that touch sensitive categories such as auth, payments, migrations, infra, public/shared APIs, security-sensitive code, or any change with broad or uncertain blast radius.

This plugin does not bundle its own GitLab integration. It depends on an external GitLab MCP being available in the agent session.

## MCP Tools

The bundled MCP owns review protocol state only. It does not read GitLab, post notes, or approve merge requests.

- `mr_review_status`
- `mr_review_create`
- `mr_review_update`
- `mr_review_artifact_write`
- `mr_review_findings_normalize`
- `mr_review_note_draft`
