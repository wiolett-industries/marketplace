---
name: Using Agent Memory
description: Use at conversation start and after learning durable user preferences, project conventions, credentials, setup steps, deployments, or other non-obvious workflows
---

# Using Agent Memory

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

At the beginning of every conversation:

1. Call `global_memory_read_lite()`
2. Read the returned lite entries before doing normal work
3. If a pointer like `[→ abc123xy]` is relevant, call `global_memory_get("abc123xy")`

Do this even if the current task is not tied to one project. Global memory is where durable user instructions and cross-project preferences live.

## Project Activation Guard

Project memory is separate and should only be used when the current repo actually has it enabled.

Treat project memory as enabled when `.memory/` exists in the current project root.

If `.memory/` does not exist:

- ignore project-memory tools for normal repo work
- do not call project read or write tools just because this skill is present
- only call `memory_setup()` if the user explicitly asks to enable or set up project memory for this repo

If legacy project-memory storage is present, especially `.memory/entries/*.json` or DB-only older layouts, the MCP server handles migration or cache reset automatically on the first project-memory tool call.

## Reading Memory

Use the smallest tool that fits.

Global memory:

- `global_memory_read_lite()` at every conversation start
- `global_memory_get(id)` when you already have a global deep entry ID
- `global_memory_search(query)` when you need a global preference or pattern but do not know the ID
- `global_memory_read_all()` only for cleanup or auditing

Project memory:

- `memory_setup()` when the user explicitly wants project memory enabled in the current repo
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

Write memory without waiting for the user when you learn durable information that will materially improve future sessions.

Prefer:

- `global_memory_write(...)` for user preferences and cross-project instructions
- `memory_write(...)` for repo-specific knowledge

## What Not To Save

Do not store:

- session summaries
- temporary progress notes
- obvious facts visible directly in code
- speculative plans
- changelog-style recaps

Only save information that will make a future session materially better.
