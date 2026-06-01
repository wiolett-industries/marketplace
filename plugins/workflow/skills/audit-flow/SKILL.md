---
name: Audit Flow
description: Use to run filesystem-backed project, subsystem, diff, or plan audits with scoped prompts, read-only agents, sanity review, and master audit output
---

# Audit Flow

Use this skill when the task is to understand quality, risk, architecture, security, maintainability, or readiness before deciding what to build or fix.

Audit is read-only. It produces findings and planning input. It does not fix code.

When workflow MCP tools are available, use `workflow_audit_create` to create the audit-run, `workflow_audit_update` for phase/reviewer/sanity/finding state, `workflow_audit_artifact_write` for prompt/review/sanity/master-audit files, and `workflow_findings_normalize` before writing `findings.json`. The model still writes the audit prompts and synthesized audit text; MCP only performs deterministic filesystem operations.

Before creating `.workflow/` audit artifacts in a git repository, ensure `.workflow/` is ignored where possible. Prefer adding `.workflow/` to the repository root `.gitignore` when missing, unless the user explicitly wants workflow artifacts versioned.

## Audit-Run Directory

Create:

```text
.workflow/audits/MM-DD-YY-slug/
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

Use the current local date. Keep the slug short and stable.

## Required Artifacts

`manifest.json` indexes the audit:

```json
{
  "slug": "MM-DD-YY-slug",
  "phase": "scoping",
  "depth": "standard",
  "target": "project | subsystem | diff | plan",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

`state.json` tracks:

```json
{
  "phase": "scoping",
  "depth": "standard",
  "reviewers": [],
  "sanity_checks": [],
  "open_findings": [],
  "handoffs": []
}
```

`scope.md` defines:

- target
- included paths
- excluded paths
- audit questions
- depth
- non-goals
- expected evidence standard

## Depth

Use:

- `simple`: one bounded area or small diff
- `standard`: ordinary project/subsystem audit
- `deep`: large project or several domains
- `exhaustive`: high-risk or broad audit needing many domain prompts

## Prompt Generation

For `simple` audits, a single audit prompt is enough.

For `standard`, `deep`, or `exhaustive` audits, write prompts first under `prompts/`.

Prompt files must be standalone:

- scope
- domain question
- included/excluded paths
- severity model
- expected output format
- evidence requirements
- non-goals

For `deep` and `exhaustive` audits, run prompt sanity review before launching audit reviewers when subagent authorization is explicit.

Preferred custom agent for prompt generation: `workflow_audit_prompt_writer`.

If it is unavailable, stop prompt-generation delegation and report that workflow agent sync/setup is missing.

## Audit Agents

Run audit agents only when subagent authorization is explicit for the current task/session.

If authorization is missing, ask once before the first audit agent. If the user does not authorize subagents, run a local audit and record that agentic audit guarantees are unavailable.

Model defaults:

- `simple`: one `workflow_audit_reviewer`, preferred `gpt-5.5 high`
- `standard`: 2-4 scoped `workflow_audit_reviewer` agents, preferred `gpt-5.5 xhigh`
- `deep` or `exhaustive`: domain prompts with `workflow_audit_reviewer`, preferred `gpt-5.5 xhigh`

Audit agents are read-only. Their review outputs must be saved under `reviews/` by the parent workflow.

If `workflow_audit_reviewer` is unavailable, stop the audit-agent step and report that workflow agent sync/setup is missing.

## Sanity Review

Run sanity after audit reviews:

- `simple`: one `workflow_audit_sanity_reviewer`, preferred `gpt-5.5 high`
- `standard`: grouped sanity review, preferred `gpt-5.5 high`
- `deep` or `exhaustive`: sanity per review or per domain group, preferred `gpt-5.5 high`

Sanity checks:

- unsupported claims
- hallucinated files or behavior
- duplicate findings
- severity inflation
- missing evidence
- missed obvious counter-evidence

Sanity artifacts go under `sanity/`. The parent workflow writes the returned sanity output.

If `workflow_audit_sanity_reviewer` is unavailable, stop the audit sanity step and report that workflow agent sync/setup is missing.

## Master Audit

After sanity, run `workflow_master_auditor`.

If `workflow_master_auditor` is unavailable, stop master-audit compilation and report that workflow agent sync/setup is missing.

It produces:

- `master-audit.md`
- `findings.json`
- `planning-input.md`

`findings.json` should use:

```json
{
  "findings": [
    {
      "id": "A-001",
      "severity": "HIGH",
      "confidence": "high",
      "domain": "architecture",
      "summary": "Short finding",
      "evidence": ["path:line or command/output"],
      "recommendation": "Concrete next action",
      "needs_plan": true
    }
  ]
}
```

Severities:

- `BLOCKING`
- `HIGH`
- `MEDIUM`
- `LOW`
- `INFO`

Confidence:

- `high`
- `medium`
- `low`

## Relationship To Plans

If audit findings should become implementation work, invoke `Writing Plans` after the master audit.

`Writing Plans` should treat `planning-input.md`, `master-audit.md`, and confirmed `findings.json` entries as planning inputs.

When workflow MCP tools are available, write the audit-to-planning handoff with `workflow_handoff_write` using `kind: "audit"`, `from_module: "audit-flow"`, and `to_module: "writing-plans"`. Include `planning-input.md`, `master-audit.md`, and `findings.json` in `artifacts`.

Do not let audit agents fix findings. Fixing starts with planning or explicit execution after the user approves the direction.

## Output

At handoff, report:

- audit-run path
- depth
- reviewer count
- sanity result
- master audit path
- number of findings by severity
- whether `planning-input.md` is ready for `Writing Plans`
