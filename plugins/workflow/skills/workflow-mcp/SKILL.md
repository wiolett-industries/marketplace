---
name: workflow-mcp
description: Use only when creating, resuming, inspecting, updating, completing, or writing artifacts for an authorized .workflow plan or audit run through the bundled Workflow MCP tools. It is an operations contract, not a reason to create workflow artifacts.
---

# Workflow MCP

Use the matching MCP tool for deterministic `.workflow/` state and artifact operations whenever it is available. This is the normal path, not a preference. MCP does not generate substantive content, launch agents, merge worktrees, run verification, or replace judgment.

## Tool Surface

- `workflow_status`
- `workflow_plan_create`, `workflow_plan_update`, `workflow_plan_complete`, `workflow_plan_artifact_write`
- `workflow_audit_create`, `workflow_audit_update`, `workflow_audit_complete`, `workflow_audit_artifact_write`
- `workflow_handoff_write`
- `workflow_findings_normalize`

Loading this skill never authorizes a new plan/audit. The active primary workflow and action boundary decide whether artifacts may exist.

## Core Contract

1. Pass an absolute `workspace_root` when cwd may be a parent or sibling workspace.
2. Call `workflow_status` at start/resume, after compaction, or when active state is uncertain; do not call it before every phase merely for reassurance.
3. New authorized work uses `workflow_plan_create` or `workflow_audit_create`. Existing unfinished work uses the matching update tool. Do not reopen completed runs without an explicit request.
4. Use artifact tools only for allowed run-relative paths. Pass exactly one of `content` or `json`.
5. Normalize structured findings before storing them.
6. Finish realized runs with `workflow_plan_complete` or `workflow_audit_complete`; phase-only updates do not clear the root active pointer.

Before creating artifacts in a git repository, ensure `.workflow/` is ignored unless explicitly versioned.

## State Updates

Use the operation names and payload fields exposed by the live tool schema. For task status, use `upsert_task` with a full task object or `complete_task` with `task_id`. For chunks, use lifecycle operations rather than inventing setters.

If a call fails with an unsupported operation, schema, payload, or validation error, read the nearest supported-operation hint, correct the same MCP call, and retry. Do not switch to manual files while the matching tool remains available.

Read [references/operations.md](references/operations.md) only when creating a run, manipulating chunks/handoffs, recovering an operation error, or diagnosing installed-package drift.

## Fallback And Stop

Manual `.workflow/` writes are fallback only when the matching MCP tool is unavailable. Preserve the same layout and state semantics and report the fallback.

Stop after the requested deterministic operation succeeds. Do not inspect unrelated artifacts or add workflow stages.
