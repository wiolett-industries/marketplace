---
{
  "id": "0eqwbcjr",
  "file_name": "0eqwbcjr_mcp_surface_alignment",
  "tags": [
    "mcp",
    "merge-request-review",
    "skill-surface",
    "verification",
    "workflow"
  ],
  "layer": "deep",
  "ref": null,
  "created_at": 1783548897136,
  "updated_at": 1783548897136
}
---
Project: agent-marketplace-next
Scope: project
Tags: mcp, merge-request-review, skill-surface, verification, workflow
Summary:
- Local MCP runtime packages (agent-marketplace-next) include: agent-memory, workflow, and merge-request-review.
- Workflow specifics:
  - The Workflow component registers 11 tools in source/docs/tests, including workflow_plan_complete and workflow_audit_complete.
  - If a live installed MCP surface misses any of these complete tools, treat it as installed package drift rather than a source-contract downgrade.
  - Behavior: Workflow.set_chunk_status clears the active_chunk for the active chunk whenever the new status is neither active nor in_progress (i.e., it may be blocked).
- Merge Request Review specifics:
  - The mr_review_update surface supports exactly the operations: set_phase, set_review_mode, set_ci_status, set_discussions, set_findings, set_blockers, set_review_round, set_clean_rounds, upsert_posted_note, mark_approved, and merge.
  - The operation mark_approved transitions the run to the approved post-clean state.
- Verification helpers:
  - zsh -lic 'pnpm --filter @wiolett/workflow test'
  - zsh -lic 'pnpm --filter @wiolett/merge-request-review test'
  - git diff --check

Notes on maintenance and verification:
- If a live surface lacks complete workflow tools, prefer treating it as drift (not a source-contract downgrade).
- The set_chunk_status rule should consistently clear active_chunk when transitioning to a non-active and non-in-progress state.
- Ensure verification commands remain valid anchors for testing and diff checks during review.

This entry should be used to inform durable repository conventions and verification workflows for MCP runtime components and their interaction with workflow and merge-request-review surfaces.
