# Durable Plan Reference

Read this reference only while creating, chunking, updating, or handing off a durable workflow plan.

## Layout

`workflow_plan_create` owns `.workflow/plans/<MM-DD-YY-slug>/`:

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

Use the current local date and a stable short slug. The runtime may create placeholder files; do not read or fill an irrelevant placeholder merely because it exists.

## Task Shape

```json
{
  "id": "T1",
  "title": "Short title",
  "status": "pending",
  "owner": "main | agent:workflow_implementer",
  "work_class": "mechanical | structured | standard | complex | critical",
  "agent_role": "workflow_implementer | workflow_implementer_standard | workflow_implementer_complex | null",
  "delegation_reason": "Why delegation and this work class are justified",
  "allowed_scope": ["path/or/module"],
  "verification": ["command"]
}
```

## Chunks

Keep one level under `chunks/<chunk-slug>/` with its own plan, manifest, state, context, decisions, artifacts, and optional UI contract. Root manifest indexes `id`, `path`, `status`, `depends_on`, and `scope`. Chunk manifest records `type: "chunk"`, `parent`, and `chunk_id`.

Chunk scopes must be disjoint unless root decisions define a shared integration point. Cross-chunk scope changes require root decision and state updates.

## Commitment Reflection

Medium and larger plans start with `state.json.commitment_reflection.status: "pending"`. Use `workflow_plan_commitment_propose` and `workflow_plan_commitment_confirm`; do not edit this field manually. `reviewed` permits execution, `awaiting_user` pauses for the recorded question, and `replan_required` requires a narrower proposal. Simple and legacy plans may be `not_required` or omit the field.

## Handoff

Use `workflow_handoff_write` with `kind: "plan"`, `from_module: "writing-plans"`, `to_module: "executing-plans"`, a concise summary, relevant artifacts, locked decisions, open questions, risks, and next actions.
