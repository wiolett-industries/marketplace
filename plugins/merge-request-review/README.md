# Merge Request Review

Generic GitLab merge request review workflow for Codex.

This plugin ships:

- `Review Merge Request` as the entry skill
- `merge-request-primary-reviewer` for correctness, task fit, regression risk, and verification quality
- `merge-request-risk-reviewer` for high-risk merge requests with meaningful blast radius

The workflow is intentionally strict:

- existing MR discussions are always read before code review starts
- local checks and GitLab CI state are checked before deep review
- non-trivial changes require full-file inspection, not diff-only review
- blocking findings are posted as inline threads by default
- blocked, findings, and clean states are explicit
- final clean note and approval happen together
- approval is allowed only when plugin-created blocking findings are resolved

High-risk mode is used for merge requests that touch sensitive categories such as auth, payments, migrations, infra, public/shared APIs, security-sensitive code, or any change with broad or uncertain blast radius.

This plugin does not bundle its own GitLab integration. It depends on an external GitLab MCP being available in the Codex session.
