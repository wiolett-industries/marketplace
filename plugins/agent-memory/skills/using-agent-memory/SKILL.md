---
name: Using Agent Memory
description: ALWAYS use at conversation start, after compaction, and when durable user or project knowledge should be read or saved through Agent Memory tools
---

# Using Agent Memory

Use at conversation start, after compaction/context reset, and whenever durable user or project knowledge could matter.

## Model

Scopes:

- `global`: durable user preferences, cross-project workflow habits, stable model-behavior requirements, reusable personal environment notes
- `project`: durable repo-specific conventions, setup/build/release/deploy workflows, integration gotchas, architecture decisions

Layers:

- `deep`: canonical durable memories with full text, embeddings when configured, and graph links
- `lite`: cheap index/pointer layer for recall; standalone lite can link, pointer lite cannot

Canonical tools: `memory_list`, `memory_query`, `memory_recall`, `memory_save`, `memory_update`, `memory_inspect`. Use compatibility aliases only when canonical tools are absent.

## Reads

At start or after compaction:

1. `memory_list({ scope: "global", index_only: true })`
2. `memory_recall` relevant global entries only
3. after repo boundary is known, `memory_list({ scope: "project", index_only: true })`
4. use `memory_query({ scope: "project", query: "..." })` for repo conventions/gotchas

Keep reads focused. Do not dump all memory unless the user asks for maintenance/audit.

## Write Triggers

Memory writes are expected for durable lessons, not only when the user explicitly asks.

Before the final response for non-trivial work, make one memory decision:

- save or update a durable fact if the work revealed a reusable preference, workflow, setup command, verification sequence, environment blocker, integration gotcha, root cause, fix pattern, or architecture decision
- skip silently when the result is only local progress, obvious code, or a one-off edit with no future reuse

Save to `global` when the user corrects stable behavior, says "always/never/remember/запомни", or establishes a cross-project workflow or communication preference.

Save to `project` when repo work reveals non-obvious setup/test/build/release commands, persistent environment constraints, recurring failure modes, integration contracts, accepted review/release patterns, or completed root-cause/fix/verification lessons likely to matter later in the same repo.

## Writes

Save to `global` only for durable cross-project facts: communication preferences, stable coding/tool preferences, reusable workflows, model-behavior requirements. Never put project-specific facts in global memory.

Save to `project` only for durable repo-specific facts: setup/test/build/release/deploy/rollback workflows, non-obvious conventions, architecture decisions, integration gotchas, persistent environment constraints.

Never save raw secrets, API keys, tokens, passwords, private webhook URLs, raw session summaries, speculative plans, obvious code facts, implementation chatter, one-off TODOs, local edits, or transient progress. For secret-related workflows, save only redacted location/process.

Do not confuse raw session recap with durable memory: save the distilled reusable lesson, root cause, decision, or workflow; leave transcript/progress detail in chat or workflow artifacts.

Use `memory_save` for new durable facts. Use `memory_update` when an existing canonical memory is outdated; IDs and graph links are preserved. Automatic graph links are suggested for graph-capable saves/updates; manual `memory_link` remains useful for important relations.

Do not bypass the memory gate; the tool surface intentionally has no bypass parameter.

## Query, Recall, Inspect

- `memory_query`: compiled answer from search results
- `memory_recall`: compiled context for a known memory ID plus valuable relations
- `memory_inspect`: raw maintenance/debug only

## Compaction Recovery

Recover durable behavior from memory and active workflow artifacts:

- global preferences from global memory
- repo-specific workflow from project memory
- plan/audit state from `.workflow/` when Workflow is installed

Do not reconstruct state from chat when filesystem artifacts or memory are available.
