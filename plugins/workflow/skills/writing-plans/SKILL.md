---
name: Writing Plans
description: Use when an approved or sufficiently clear direction must become a durable decision-complete implementation plan under .workflow/plans/
---

# Writing Plans

Write a durable plan-run that another agent can execute without making product or architecture decisions.

Plans are stored in the repository, not in chat.

When workflow MCP tools are available, use `workflow_plan_create` to create the plan-run and `workflow_plan_update` / `workflow_plan_artifact_write` for later state and artifact writes. The model still writes the actual plan text; MCP only performs deterministic filesystem operations.

Before creating `.workflow/` plan artifacts in a git repository, ensure `.workflow/` is ignored where possible. Prefer adding `.workflow/` to the repository root `.gitignore` when missing, unless the user explicitly wants workflow artifacts versioned.

If `.workflow/audits/<audit-slug>/planning-input.md` exists and the user wants to plan from audit findings, treat it as a primary input alongside `master-audit.md` and confirmed entries from `findings.json`. When an audit handoff exists in `handoffs/*.json` or `state.json.latest_handoff`, use it as the structured source for artifacts, decisions, risks, open questions, and next actions.

## Plan-Run Directory

Create:

```text
.workflow/plans/MM-DD-YY-slug/
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

Use the current local date. Keep the slug short and stable.

## Required Artifacts

`manifest.json` indexes the run:

```json
{
  "slug": "MM-DD-YY-slug",
  "phase": "planning",
  "complexity": "simple",
  "plan": "plan.md",
  "state": "state.json",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

`state.json` is machine state:

```json
{
  "phase": "planning",
  "complexity": "simple",
  "tasks": [],
  "review_round": 0,
  "clean_streak": 0,
  "open_findings": [],
  "handoffs": []
}
```

`context.md` captures repo facts and constraints.

`questions.md` captures asked questions and answers.

`decisions.md` captures locked decisions and defaults.

`plan.md` contains the executable plan.

`ui-contract.md` is required for substantial frontend/UI work. For non-UI plans, either omit it or write a short note that no UI contract applies.

## Chunked Plans

Use chunking when a plan would be too large or coupled for reliable single-pass execution.

Chunking is required when any of these are true:

- complexity is `complex` or `very_complex`
- the plan has more than 7 substantial tasks
- the work spans independent subsystems
- different agents can own independent file/module sets
- a single plan would be hard to restore after compaction
- one `state.json` would become too noisy to operate safely

Chunking is optional for `medium` work and should be skipped for genuinely `simple` work.

Use one level only:

```text
.workflow/plans/MM-DD-YY-slug/
  plan.md
  manifest.json
  state.json
  context.md
  decisions.md
  artifacts/
  chunks/
    MM-DD-YY-slug-chunk-01/
      plan.md
      manifest.json
      state.json
      context.md
      questions.md
      decisions.md
      ui-contract.md
      artifacts/
```

Do not create chunks inside chunks.

The root plan is the orchestration plan. It owns:

- overall goal and success criteria
- shared architecture decisions
- cross-chunk constraints
- chunk order and dependencies
- integration and finalization requirements

Each chunk is an executable plan-run. It owns:

- one bounded scope
- allowed files/modules
- local task state
- local verification
- local artifacts

Root `manifest.json` should include chunk index data:

```json
{
  "type": "root",
  "chunks": [
    {
      "id": "chunk-01",
      "path": "chunks/MM-DD-YY-slug-chunk-01",
      "status": "pending",
      "depends_on": [],
      "scope": ["path/or/module"]
    }
  ]
}
```

Chunk `manifest.json` should include parent data:

```json
{
  "type": "chunk",
  "parent": "../../manifest.json",
  "chunk_id": "chunk-01"
}
```

Chunk scopes must be disjoint unless the root plan explicitly defines a shared integration point. Cross-chunk scope changes require updating the root `decisions.md` and `state.json`.

When using MCP, create the root run with `workflow_plan_create`, then write chunk files with `workflow_plan_artifact_write` under `chunks/<chunk-slug>/...` and update the root chunk index through `workflow_plan_update`.

## Plan Requirements

The plan must be decision-complete:

- exact goal and success criteria
- scope and non-goals
- audit findings being addressed, if the plan comes from an audit
- implementation approach
- task list with clear ownership
- chunk list and dependency order when chunking is used
- expected artifacts and file areas
- subagent delegation guidance
- verification commands and acceptance checks
- lint command/config when the project has one
- UI contract and visible acceptance criteria when frontend/UI is in scope
- file-boundary risks, including any touched file near 500 lines
- explicit note when the work is an interactive user-testing loop where heavy mid-work checks should be avoided
- finalization complexity and review requirements

Do not write:

- `TBD`
- `TODO`
- `later`
- `choose appropriate`
- vague placeholders
- fake staging language unless explicitly approved

## Engineering Constraints

Plans for code changes must preserve:

- existing lint rules and warning standards
- focused file responsibilities
- the 500-line code file limit
- approved scope and non-goals
- real wiring, not created-but-unused artifacts

If a planned change would violate one of these constraints, the plan must include the split or alternative structure that avoids it.

## UI Plans

For substantial frontend/UI work, use `UI Contract` in `define` mode before treating the plan as ready.

The plan-run must include:

- `ui-contract.md` with the buildable UI contract
- UI acceptance criteria in `plan.md`
- affected routes, screens, panels, components, and states
- desktop/mobile expectations
- required loading, error, empty, disabled, hover/focus, and success states
- browser/screenshot verification expectations when the app can run locally
- explicit note when user-led inline testing should avoid heavy mid-work checks

The implementation plan must treat `ui-contract.md` as an acceptance source. Do not allow the execution phase to reinterpret hierarchy, copy, or interaction behavior without updating `decisions.md`.

## Complexity

Set complexity from all available context:

- `simple`: narrow, low-risk, small surface
- `medium`: several files or moderate reasoning
- `complex`: multiple subsystems, migrations, broad behavior, or substantial coordination
- `very_complex`: high blast radius, sensitive domains, or many dependent tasks

Later modules may raise or lower complexity when they have more evidence. Later decisions have higher weight.

## Plan Review

After writing the plan, always run agent review when available and subagent authorization is explicit:

- `simple`: one combined `sanity + overall` agent, `workflow_combined_reviewer`
- `medium`, `complex`, `very_complex`: separate `workflow_plan_sanity_reviewer` and `workflow_plan_overall_reviewer` agents

Review agents are read-only. The parent workflow writes returned findings to `artifacts/plan-review-*.md`.

If a named workflow custom agent is unavailable, stop plan review and report that workflow agent sync/setup is missing.

Fix blocking plan findings before treating the plan as ready.

If subagent authorization is missing, ask for it before plan review. If the user does not authorize subagents, perform a local plan self-review and record in `decisions.md` that agent review was not authorized.

## Output

At handoff, report:

- plan-run path
- complexity
- review result
- whether it is ready for `Executing Plans`

When workflow MCP tools are available, write the planning-to-execution handoff with `workflow_handoff_write` using `kind: "plan"`, `from_module: "writing-plans"`, and `to_module: "executing-plans"`.
