---
name: Using Agent Memory
description: ALWAYS use at conversation start and after compaction or context loss, and proactively write durable user preferences, project conventions, credentials, setup steps, deployments, and other non-obvious workflows as soon as they are learned
---

# Using Agent Memory

This skill should be loaded at the start of every conversation and again after compaction, context reset, or any other loss of working context.

Do not wait for the user to mention memory first. Load the relevant memory state before normal work.

## Core Model

This plugin exposes two separate memory spaces:

| Space | Purpose | Storage |
|-------|---------|---------|
| `global` | Persistent user preferences, model-behavior requirements, cross-project coding patterns, reusable personal workflows | `~/.agents/agent-memory/` |
| `project` | Repo-specific workflows, credentials, infrastructure steps, conventions, gotchas | `<repo>/.memory/` |

Each space has the same two layers:

| Layer | Purpose |
|-------|---------|
| `deep` | Full reusable detail, fully searchable |
| `lite` | Cheap pointers and short always-useful facts |

Deep writes automatically create a lite pointer. Only write directly to `lite` for short standalone facts.

## Session Start

At the beginning of every conversation, and again after compaction or context loss:

1. Call `global_memory_read_lite()`
2. Read the returned lite entries before doing normal work
3. If a pointer like `[→ abc123xy]` is relevant, call `global_memory_get("abc123xy")`

Do this even if the current task is not tied to one project. Global memory is where durable user instructions and cross-project preferences live.

If a conversation continues after compaction, treat that like a fresh start for memory loading.

## Project Memory

Project memory is separate from global memory and scoped to the current repository.

It initializes automatically on the first project-memory tool call in a repo. That first use creates `.memory/`, the SQLite cache, and the other storage directories if they do not exist yet.

## Reading Memory

Use the smallest tool that fits.

Global memory:

- `global_memory_read_lite()` at every conversation start
- `global_memory_get(id)` when you already have a global deep entry ID
- `global_memory_search(query)` when you need a global preference or pattern but do not know the ID
- `global_memory_read_all()` only for cleanup or auditing

Project memory:

- `memory_read_lite()` when project memory already exists and the task may depend on prior repo knowledge
- `memory_get(id)` when you already have a project deep entry ID
- `memory_search(query)` when you know the repo topic but not the exact entry
- `memory_read_all()` only for cleanup or auditing

Graph tools work on deep memories only:

- `memory_link(...)`
- `memory_neighbors(...)`
- `memory_subgraph(...)`
- `global_memory_link(...)`
- `global_memory_neighbors(...)`
- `global_memory_subgraph(...)`

Do not use any `*_read_all()` tool for a normal read request.

## What Goes To Global Memory

Save to global memory when the user gives you durable instructions that should apply across projects, for example:

- preferences for answer style or collaboration style
- coding preferences that are not tied to one repo
- recurring tool preferences
- persistent model-behavior requirements
- cross-project workflow habits
- reusable personal environment notes

Typical global write:

```text
global_memory_write(
  content="User prefers concise answers, no nested bullets, and wants concrete file references when code is changed.",
  tags=["preferences", "communication", "style"],
  summary="Response style preferences"
)
```

## What Goes To Project Memory

Save to project memory when the knowledge is specific to the current repo or environment, for example:

- project conventions
- setup or bootstrap steps
- deploy or release workflows
- project credentials or tokens
- third-party integration details for this repo
- undocumented dependencies
- project-specific bug fixes and gotchas

Typical project write:

```text
memory_write(
  content="Deploy with git push origin main, then verify GitLab pipeline 42 before tagging the release.",
  tags=["deploy", "gitlab", "release"],
  summary="Release workflow through GitLab CI"
)
```

## Save Proactively

Default to writing memory when you learn durable information that will materially improve future sessions.

Do not wait for the user to ask for a save when the information is clearly reusable.

When in doubt, save if all of these are true:

- it is likely to matter again in a future session
- it is not obvious from the code alone
- forgetting it would cost time or cause mistakes

Write as soon as the durable fact becomes clear, not only at the end of the task.

Prefer:

- `global_memory_write(...)` for user preferences and cross-project instructions
- `memory_write(...)` for repo-specific knowledge

Common proactive save triggers:

- the user states a stable preference about how you should behave
- you discover the real deploy, release, setup, or bootstrap workflow
- you learn a non-obvious credential, environment, or integration detail
- you find a convention that the repo follows but the code does not explain clearly
- you resolve a gotcha that is likely to recur
- you confirm a cross-project habit or requirement that should persist

## What Not To Save

Do not store:

- session summaries
- temporary progress notes
- obvious facts visible directly in code
- speculative plans
- changelog-style recaps

Only save information that will make a future session materially better.
