---
name: Audit Flow
description: Use to run filesystem-backed project, subsystem, diff, or plan audits with scoped prompts, read-only agents, sanity review, and master audit output
---

# Audit Flow

Read-only workflow for understanding quality, risk, architecture, security, maintainability, or readiness before planning fixes. It produces findings and planning input; it does not edit code.

Inherit `Using Workflow` shared rules. Use workflow MCP when available; manual audit state/artifact writes are fallback only:

- create/update: `workflow_audit_create`, `workflow_audit_update`
- artifacts: `workflow_audit_artifact_write`
- findings: `workflow_findings_normalize`
- handoff: `workflow_handoff_write`

## Layout

Create `.workflow/audits/MM-DD-YY-slug/` with:

```text
audit.md
manifest.json
state.json
scope.md
prompts/
reviews/
sanity/
master-audit.md
findings.json
planning-input.md
handoffs/
```

`manifest.json`: `slug`, `phase`, `depth`, `target`, `created_at`, `updated_at`.
`state.json`: `phase`, `depth`, `reviewers`, `sanity_checks`, `open_findings`, `handoffs`.
`scope.md`: target, included/excluded paths, audit questions, depth, non-goals, evidence standard.

Depth:

- `simple`: one bounded area or small diff
- `standard`: ordinary project/subsystem audit
- `deep`: large project or several domains
- `exhaustive`: high-risk or broad audit needing many domain prompts

## Prompts

`simple`: one prompt is enough.
`standard`/`deep`/`exhaustive`: write standalone prompts under `prompts/`.

Each prompt needs: scope, domain question, included/excluded paths, severity model, output format, evidence requirements, non-goals.

For `deep`/`exhaustive`, run prompt sanity before audit reviewers when subagents are authorized.

Preferred prompt agent: `workflow_audit_prompt_writer`. If unavailable, stop that delegated step.

## Agents

Run audit agents only with explicit subagent authorization.

Defaults:

- `simple`: one `workflow_audit_reviewer`, `gpt-5.4 high`
- `standard`: 2-4 scoped `workflow_audit_reviewer`, `gpt-5.4 xhigh`
- `deep`/`exhaustive`: domain prompt per `workflow_audit_reviewer`, `gpt-5.4 xhigh`

Reviewer budget: use one reviewer per independent risk domain, not per file or folder. For `deep`/`exhaustive`, 3-6 reviewers is the normal range; exceed that only when domains are truly independent and the added review changes planning decisions. Group adjacent domains when overlap would create duplicate findings.

Audit agents are read-only. Parent writes outputs to `reviews/`. If `workflow_audit_reviewer` is unavailable, stop.

## Sanity And Master Audit

After reviews, run `workflow_audit_sanity_reviewer`:

- `simple`: one sanity review, `gpt-5.4 high`
- `standard`: grouped sanity, `gpt-5.4 high`
- `deep`/`exhaustive`: per review or domain group, `gpt-5.4 high`

Sanity checks unsupported claims, hallucinated files/behavior, duplicates, severity inflation, missing evidence, and counter-evidence. Parent writes outputs under `sanity/`. If unavailable, stop.

Then run `workflow_master_auditor`. If unavailable, stop. It returns:

- `master-audit.md`
- `findings.json`
- `planning-input.md`

`findings.json` shape:

```json
{
  "findings": [
    {
      "id": "A-001",
      "severity": "BLOCKING | HIGH | MEDIUM | LOW | INFO",
      "confidence": "high | medium | low",
      "domain": "architecture",
      "summary": "Short finding",
      "evidence": ["path:line or command/output"],
      "recommendation": "Concrete next action",
      "needs_plan": true
    }
  ]
}
```

## Handoff

If findings should become implementation work, invoke `Writing Plans`. Use `planning-input.md`, `master-audit.md`, and confirmed `findings.json` as planning inputs.

With MCP, write audit-to-plan handoff:

- `kind: "audit"`
- `from_module: "audit-flow"`
- `to_module: "writing-plans"`
- `artifacts`: `planning-input.md`, `master-audit.md`, `findings.json`

Final report: audit path, depth, reviewer count, sanity result, master audit path, findings by severity, planning readiness.
