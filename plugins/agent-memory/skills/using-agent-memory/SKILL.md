---
name: Using Agent Memory
description: ALWAYS use at conversation start, after compaction, and when durable user or project knowledge should be read or saved through Agent Memory tools
---

# Using Agent Memory

Use this skill at conversation start, after compaction or context reset, and whenever durable user or project knowledge could materially affect the task.

## Core Model

Memory has two scopes:

| Scope | Purpose |
|-------|---------|
| `global` | Durable user preferences, cross-project workflow habits, stable model-behavior requirements, reusable personal environment notes |
| `project` | Durable repo-specific conventions, setup steps, release/deploy workflows, integration gotchas, architectural decisions |

Memory has two layers:

| Layer | Purpose |
|-------|---------|
| `deep` | Canonical durable memory with full text, embeddings when configured, and graph links |
| `lite` | Cheap index/pointer layer for quick recall; standalone lite entries can participate in graph links, pointer lite entries cannot |

Prefer canonical tools:

- `memory_list`
- `memory_query`
- `memory_recall`
- `memory_save`
- `memory_update`
- `memory_inspect`

Use compatibility aliases only when the runtime exposes only aliases.

## Session Start

At conversation start or after compaction:

1. Read global lite memory with `memory_list({ scope: "global", index_only: true })`.
2. If a listed memory is relevant, call `memory_recall({ scope: "global", memory_id: "<id>" })`.
3. For repo work, read project lite memory with `memory_list({ scope: "project", index_only: true })` after the repo boundary is known.
4. If the task depends on prior repo conventions or gotchas, use `memory_query({ scope: "project", query: "..." })`.

Keep reads focused. Do not dump all memory unless the user asks for maintenance or audit.

## What Goes To Global Memory

Save to `global` only when the fact is durable across projects:

- user communication and collaboration preferences
- stable cross-project coding preferences
- recurring tool preferences
- durable model-behavior requirements
- reusable personal workflows

Do not write project-specific facts to global memory.

## What Goes To Project Memory

Save to `project` when the knowledge is durable and repo-specific:

- setup, bootstrap, test, build, release, deploy, or rollback workflow
- project conventions that are not obvious from code
- non-obvious architecture decisions
- integration gotchas
- environment constraints that affect future work

Do not save ordinary local edits, temporary debug notes, obvious code facts, one-off TODOs, or session progress.

## What Not To Save

Never save:

- raw secrets, API keys, tokens, passwords, private webhook URLs, or credentials
- temporary conversation summaries
- speculative plans
- obvious facts visible directly in code
- implementation chatter such as "changed file X"
- project-specific facts in global memory

If a secret-related workflow matters, save only the redacted location or process, not the secret value.

## Save And Update

Use `memory_save` for new durable facts.

Use `memory_update` when an existing canonical memory is outdated. Updates preserve memory IDs and graph links.

The MCP automatically suggests graph links for saved or updated graph-capable memories. Manual `memory_link` edges are still useful for important relations and are not overwritten by automatic links.

For global writes, be especially strict: save only stable cross-project facts that will almost certainly help future sessions.

Do not bypass the memory gate. The MCP tool surface intentionally does not expose a bypass parameter.

## Query And Recall

Use `memory_query` when asking "what do we know about this?" and the model needs a compiled answer from search results.

Use `memory_recall` when you already have a specific memory ID and need its compiled context plus valuable relations.

Use `memory_inspect` only for raw maintenance/debugging views.

## Compaction Recovery

After compaction, recover durable behavior from memory and active workflow artifacts:

- global preferences from global memory
- repo-specific workflow from project memory
- plan/audit execution state from `.workflow/` artifacts when the workflow plugin is also installed

Do not reconstruct state from chat history when filesystem artifacts or memory are available.
