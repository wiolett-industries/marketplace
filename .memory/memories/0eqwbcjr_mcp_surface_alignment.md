---
{
  "id": "0eqwbcjr",
  "file_name": "0eqwbcjr_mcp_surface_alignment",
  "tags": [
    "agent-memory",
    "mcp",
    "reconciliation",
    "skill-surface",
    "verification",
    "workflow"
  ],
  "layer": "deep",
  "ref": null,
  "source": "model_inferred",
  "confidence": 0.9,
  "importance": 0.9,
  "created_at": 1783548897136,
  "updated_at": 1785828418253
}
---
In agent-marketplace-next, `packages/workflow/src/tools.ts` is the Workflow MCP source of truth. It registers 13 tools: workflow_status; plan create/update/commitment propose/commitment confirm/complete/artifact write; audit create/update/complete/artifact write; handoff write; and findings normalize. The Workflow package README, plugin README, and workflow-mcp skill must list that same surface; an installed MCP missing a source tool is package/install drift.

Agent Memory retrieval contract: use memory_query for a focused semantic question and memory_recap for broad startup/compaction recovery. memory_recall is only for a non-empty memory_id returned by query/list/recap or named explicitly; using it as the first search produces the schema min-length error.

Reconciliation contract: memory_reconciliation_status is read-only and reports project/global last_reconciled_at plus a 30-day due state without initializing a store. memory_reconciliation_record persists the current timestamp only after a user-approved reconciliation actually completes. Metadata lives in maintenance/reconciliation.json in each scope; project maintenance data is canonical .memory content and must be committed. The reconciling-memory skill bounds the maintenance pass and forbids automatic deletion, pruning, or record-only acknowledgement.

Workflow SessionStart reads the project reconciliation metadata without writing it and injects a recommendation only when a valid recorded timestamp is at least 30 days old. It does not remind for missing/uninitialized metadata or reconcile automatically.

Verification anchors: zsh -lic 'pnpm --filter @wiolett/agent-memory test'; zsh -lic 'pnpm --filter @wiolett/agent-memory typecheck'; zsh -lic 'pnpm --filter @wiolett/workflow test'; git diff --check.
