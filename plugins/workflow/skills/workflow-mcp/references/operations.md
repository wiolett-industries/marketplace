# Workflow MCP Operations Reference

Read this reference only while performing detailed plan/audit operations or troubleshooting a live tool mismatch.

## Active Runs

Root `.workflow/state.json` tracks `active_plan`, `active_audit`, and `updated_at`. Create tools set the corresponding pointer. Complete tools mark the run complete and clear the pointer only when it references that run.

Create vs update guard: create new authorized work; update an existing unfinished matching run. Omitted `plan_run` or `audit_run` targets the active run.

## Plan Operations

Plan create accepts title, complexity, optional slug/content/tasks/chunks, and workspace root. It creates plan, manifest, state, context, questions, decisions, UI contract, artifacts, chunks, and handoffs paths.

Plan update operations include `set_phase`, `set_complexity`, `set_review_round`, `set_clean_streak`, `set_open_findings`, `upsert_task`, `complete_task`, `set_active_chunk`, `clear_active_chunk`, `upsert_chunk`, `set_chunk_status`, `complete_chunk`, `cancel_chunk`, `wait_chunk`, and `merge`.

Material plan creation initializes `commitment_reflection` as pending. `workflow_plan_commitment_propose` records the request, expected and candidate change classes/surfaces, constraints, new abstractions/contracts, detected scope pressure, and a bounded reflection prompt. `workflow_plan_commitment_confirm` records `KEEP`, `SHRINK`, `ASK`, or `REPLAN`. Only a reviewed commitment can enter execution or complete; simple and legacy plans remain compatible.

Use `upsert_chunk` for metadata. Use lifecycle operations for status:

```json
{"type":"set_active_chunk","chunk_id":"C1"}
{"type":"wait_chunk","chunk_id":"C1"}
{"type":"complete_chunk","chunk_id":"C1"}
{"type":"cancel_chunk","chunk_id":"C1"}
{"type":"set_chunk_status","chunk_id":"C1","status":"blocked"}
```

Any status other than `active` or `in_progress` clears `active_chunk` when it affects the active chunk, including `set_chunk_status` with `blocked`.

Allowed plan artifact paths: `plan.md`, `context.md`, `questions.md`, `decisions.md`, `ui-contract.md`, `manifest.json`, `state.json`, `artifacts/**`, `chunks/**`, and `handoffs/**`.

## Audit Operations

Audit create accepts title, depth (`simple | standard | deep | exhaustive`), target (`project | subsystem | diff | plan`), optional slug/content/findings, and workspace root.

Audit update operations include `set_phase`, `set_depth`, `set_open_findings`, `upsert_reviewer`, `upsert_sanity_check`, and `merge`. Plan and audit updates use a shared operation handler, but use the subset meaningful for the active run.

Allowed audit artifact paths: `audit.md`, `scope.md`, `master-audit.md`, `findings.json`, `planning-input.md`, `manifest.json`, `state.json`, `prompts/**`, `reviews/**`, `sanity/**`, and `handoffs/**`.

## Handoff And Findings

`workflow_handoff_write` requires `kind: plan | audit`, `from_module`, `to_module`, and `summary`. Optional fields include run/id/status, artifacts, decisions, open questions, risks, next actions, and payload.

`workflow_findings_normalize` accepts findings with `BLOCKING`, `HIGH`, `MEDIUM`, `LOW`, or `INFO` severity.

`state.json` is operational truth; `manifest.json` is the discovery index. Manual fallback must keep them aligned.

## Drift

If a live `@wiolett/workflow@latest` installation lacks a source-registered tool such as `workflow_plan_complete` or `workflow_audit_complete`, verify the installed/published package version before weakening the source contract.
