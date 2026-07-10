# Durable Audit Artifact Reference

Read this reference only for an authorized durable audit run.

## Layout

`workflow_audit_create` owns `.workflow/audits/<MM-DD-YY-slug>/`:

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

Do not populate empty stages that the selected depth does not use.

## Standalone Prompt

Each prompt contains target/scope, one domain question, included/excluded paths, evidence requirements, severity model, output format, and non-goals. Prompt sanity is justified only when ambiguity could distort several independent reviews.

## Findings

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

Normalize findings before storing them. `master-audit.md` explains the supported result; `planning-input.md` contains only confirmed implementation inputs.

## Handoff

Use `workflow_handoff_write` with `kind: "audit"`, `from_module: "audit-flow"`, `to_module: "writing-plans"`, and references to `planning-input.md`, `master-audit.md`, and `findings.json`. Include only confirmed decisions, risks, open questions, and next actions.
