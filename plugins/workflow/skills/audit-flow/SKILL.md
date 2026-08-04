---
name: audit-flow
description: Use for an explicit project, subsystem, diff, plan, quality, risk, security, architecture, maintainability, or readiness audit. Default to a quick local chat-only audit unless durable artifacts, several independent risk domains, or deep/exhaustive coverage are explicitly needed. The audit is read-only and does not imply fixes.
---

# Audit Flow

Produce evidence-backed findings without editing the audited code. An audit is one primary path; do not add `finalizing-plan` or implementation unless the user separately requests fixes.

## Select Depth And Output

- `quick`: bounded question, small diff, or ordinary analysis; parent works locally, writes no `.workflow` artifacts, launches 0 agents, and reports in chat.
- `standard`: one coherent subsystem or review question; use 1 scoped reviewer by default when the question crosses several surfaces, has a plausible regression/risk that benefits from an independent read, or would otherwise overload the parent context. Keep a small direct diff or single-surface question local. Create a durable run only when requested or needed for later planning/recovery.
- `deep`: several genuinely independent risk domains; create a durable run and use at most 2 scoped reviewers when the benefit gate passes.
- `exhaustive`: explicit broad/high-risk request only; create a durable run and declare a task-wide budget, default maximum 4. Exceed it only with explicit approval.

Repository size, file count, checklist length, or number of possible lenses does not raise depth. Read-only/no-edits requests use `quick` chat output unless the same request explicitly authorizes audit artifacts.

## Scope And Evidence

Define the target, included/excluded paths, audit questions, non-goals, depth, and evidence standard. Inspect the real source of truth. Every material finding needs a file/line, command/output, runtime observation, or other reproducible evidence.

Agents are read-only and consume the declared audit budget. Group overlapping domains. Use `workflow_audit_reviewer` for independent evidence that changes confidence or coverage; nontrivial diagnosis and review are affirmative candidates, not exceptions. Do not assign one agent per file, prompt, or gate.

## Durable Audit Path

When a durable run is authorized, use `workflow_audit_create`, `workflow_audit_update`, `workflow_audit_artifact_write`, `workflow_findings_normalize`, `workflow_handoff_write`, and `workflow_audit_complete`. Manual state/artifact writes are fallback only.

Read [references/audit-artifacts.md](references/audit-artifacts.md) before creating prompts, findings, or handoff artifacts. Do not load it for a quick chat-only audit.

## Prompt, Sanity, And Synthesis

The parent writes the audit prompt directly unless several standalone prompts require non-trivial decomposition. Use `workflow_audit_prompt_writer` only for that deep/exhaustive case and within budget.

After evidence collection:

- `quick`/`standard`: parent performs one grouped sanity pass and synthesizes directly.
- `deep`/`exhaustive`: use at most one `workflow_audit_sanity_reviewer` only when reviews conflict, severity inflation is plausible, or evidence is hard to validate locally.
- Use `workflow_master_auditor` only when multi-review synthesis is itself substantial and the remaining budget justifies a separate context.

Sanity removes unsupported claims, hallucinated behavior, duplicates, severity inflation, and findings contradicted by stronger evidence.

## Stop And Handoff

Stop when the scoped questions are answered with sufficient evidence and all findings are normalized. Do not continue into optional domains or fixes.

If the user requests remediation, hand confirmed findings to `writing-plans`; do not silently mutate the audit into implementation. A durable audit closes with `workflow_audit_complete`.

Final output reports depth, evidence limits, findings by severity, reviewer count, and planning readiness. Quick audits report directly in chat without an artifact path.
