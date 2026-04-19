---
name: Scan Existing Codebase
description: ALWAYS use when repository context is effectively empty and no relevant memory is available, when the user explicitly asks to scan or research the codebase, or before any codebase-wide code review or security review
---

# Scan Existing Codebase

Build a practical model of the repository before making design claims or implementation decisions.

This is a brownfield skill. Its purpose is not exhaustive documentation. Its purpose is to answer: how does this codebase work today, where does new work belong, and what could break if we touch it?

## When to Use

Always use this skill when:
- you are starting effectively cold in a repository and do not already have enough grounded codebase context from current-session exploration or memory
- the user explicitly asks you to scan, research, understand, map, or audit the codebase
- the user asks for a codebase-wide code review
- the user asks for a codebase-wide security review

Also use this skill when:
- the repository is unfamiliar
- the request touches multiple files or subsystems
- you need to anchor planning in current architecture
- there is a risk of fighting existing conventions

If context is empty, do not jump directly into planning, implementation, or global review. Scan first.

## Outputs

Produce a concise scan with these sections:

1. Stack
   Languages, frameworks, build tools, test tools, package managers, deployment clues.

2. Entry Points
   Main application entry paths, startup paths, routing boundaries, CLI entrypoints, or service boot paths.

3. Relevant Subsystems
   The concrete files, modules, or directories most likely involved in the requested work.

4. Existing Conventions
   Naming, file layout, error handling, test style, state/data flow, API patterns, and any strong local idioms.

5. Integration Points
   Where a new change would naturally attach.

6. Risks
   Areas likely to regress, hidden couplings, migration hazards, or code that is more fragile than it first appears.

7. Recommended Starting Path
   One suggested implementation entry path grounded in the codebase as it exists today.

## Operating Rules

- Prefer concrete file-level evidence over abstract architecture talk.
- Follow the codebase’s current patterns unless there is a strong task-specific reason not to.
- Distinguish clearly between observed facts and your inference.
- Stay scoped to the requested area. Do not turn a scan into a full repo audit.
- If the scan surfaces durable repo conventions, integration rules, or operational gotchas that future sessions would benefit from, recommend storing them with `Using Agent Memory`.
