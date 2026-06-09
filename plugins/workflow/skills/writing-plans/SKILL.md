---
name: Writing Plans
description: Use when an approved or sufficiently clear direction must become a durable decision-complete implementation plan under .workflow/plans/
---

# Writing Plans

Write a durable plan-run that another agent can execute without product or architecture guesswork. Plans live in `.workflow/`, not chat. Inherit `Using Workflow` shared rules.

Use MCP when available: `workflow_plan_create`, `workflow_plan_update`, `workflow_plan_artifact_write`, `workflow_handoff_write`. Manual `.workflow/` writes are fallback only.

If planning from audit, use `planning-input.md`, `master-audit.md`, confirmed `findings.json`, and any audit handoff as primary inputs.

## Layout

Create `.workflow/plans/MM-DD-YY-slug/` with:

```text
plan.md
manifest.json
state.json
context.md
questions.md
decisions.md
ui-contract.md
artifacts/
chunks/
handoffs/
```

Use current local date and a short stable slug.

`manifest.json`: `slug`, `phase`, `complexity`, `plan`, `state`, `created_at`, `updated_at`.
`state.json`: `phase`, `complexity`, `tasks`, `review_round`, `clean_streak`, `open_findings`, `handoffs`.
`context.md`: repo facts/constraints. `questions.md`: questions/answers. `decisions.md`: locked decisions/defaults. `plan.md`: executable plan. `ui-contract.md`: required for substantial UI; omit or write "no UI contract applies" otherwise.

## Chunking

Chunk when single-pass execution would be unreliable. Required when complexity is `complex`/`very_complex`, tasks > 7, work spans independent subsystems, agents can own disjoint scopes, compaction recovery would be hard, or one `state.json` would become noisy. Optional for `medium`; skip for true `simple`.

For `medium` and larger work, prefer chunks that separate analysis/decision tasks from small implementation tasks. A chunk or task intended for the implementer must already contain the relevant analysis, exact allowed scope, expected edits, non-goals, and verification commands; do not make the implementer infer architecture or discover broad context.

One level only:

```text
.workflow/plans/root/
  plan.md
  manifest.json
  state.json
  context.md
  decisions.md
  artifacts/
  chunks/<chunk-slug>/
    plan.md
    manifest.json
    state.json
    context.md
    questions.md
    decisions.md
    ui-contract.md
    artifacts/
```

Root owns goal, shared decisions, cross-chunk constraints, order/dependencies, integration, finalization. Chunks own bounded scope, allowed files/modules, task state, local verification, local artifacts.

Root manifest indexes chunks with `id`, `path`, `status`, `depends_on`, `scope`. Chunk manifest includes `type: "chunk"`, `parent`, `chunk_id`.

Chunk scopes must be disjoint unless root defines a shared integration point. Cross-chunk scope changes require root `decisions.md` and `state.json` updates.

## Plan Contract

The plan must be decision-complete. Include:

- exact goal, success criteria, scope, non-goals
- audit findings addressed, if any
- implementation approach
- tasks with ownership/allowed scope
- chunks and dependencies, when used
- expected artifacts/files
- subagent delegation guidance; delegated write tasks require worktrees, review/audit tasks are read-only
- delegation guidance: each delegated task/chunk records why delegation is safe; analysis-heavy tasks go to reasoning-focused review agents, while small bounded code tasks go to the implementer
- verification commands/acceptance checks
- lint command/config when present
- UI contract/visible criteria when UI is in scope
- file-boundary risks, especially files near 500 lines
- interactive user-testing note when heavy mid-work checks should be avoided
- finalization complexity and review requirements

Never write `TBD`, `TODO`, `later`, `choose appropriate`, vague placeholders, fake staging, or unwired "basic version" language unless explicitly approved.

Code plans must preserve lint rules, focused responsibilities, the 500-line file limit, approved scope, and real wiring.

Delegated task objects should include:

```json
{
  "id": "T1",
  "title": "Short title",
  "status": "pending",
  "owner": "agent:workflow_implementer",
  "delegation_reason": "Why delegating this task is safe",
  "allowed_scope": ["path/or/module"],
  "verification": ["command"]
}
```

## UI Plans

For substantial UI, run `UI Contract` in `define` mode first. Plan must include `ui-contract.md`, UI acceptance criteria, affected surfaces/states, desktop/mobile expectations, loading/error/empty/disabled/hover/focus/success states, browser/screenshot verification expectations, and user-testing loop note when applicable.

Execution must treat `ui-contract.md` as an acceptance source. Any drift requires `decisions.md` update.

## Complexity

- `simple`: narrow, low-risk, small surface
- `medium`: several files or moderate reasoning
- `complex`: multiple subsystems, migrations, broad behavior, coordination
- `very_complex`: high blast radius, sensitive domains, many dependent tasks

Later modules may adjust complexity; later decisions have higher weight.

## Plan Review And Handoff

After writing, run agent review when available:

- `simple`: `workflow_combined_reviewer`
- `medium`/`complex`/`very_complex`: `workflow_plan_sanity_reviewer` + `workflow_plan_overall_reviewer`

Agents are read-only. Parent writes findings to `artifacts/plan-review-*.md`. If a named agent is unavailable, do local self-review and record the gap in `decisions.md`. Fix blocking plan findings before readiness.

Handoff report: plan path, complexity, review result, readiness for `Executing Plans`. With MCP, write handoff `kind: "plan"`, `from_module: "writing-plans"`, `to_module: "executing-plans"`.
