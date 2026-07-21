---
{
  "id": "t7wcxn2n",
  "file_name": "t7wcxn2n_memory_synthesis",
  "tags": [
    "agent-memory",
    "completion",
    "memory-recap",
    "merge-request-review",
    "workflow"
  ],
  "layer": "deep",
  "ref": null,
  "created_at": 1784106992374,
  "updated_at": 1784106992374
}
---
In agent-marketplace-next, the root causes of weak memory summaries and lingering active runs were that memory_query compiled only the top search result and did not pass the original query or other ranked hits to the model. The durable fix is query-aware multi-memory synthesis plus a separate memory_recap tool for broad recovery. Agent Memory response generation uses the dedicated responseModel field and defaults to gpt-5-mini, while the embeddingModel remains separate. Workflow updates must reject terminal complete/completed phases so callers use workflow_plan_complete or workflow_audit_complete and clear root pointers. Merge Request Review requires mr_review_complete; the compatibility mark_approved must also clear the matching active_review pointer. Session hooks and skills should surface these terminal latches explicitly. Verification for this change: full pnpm test passed with Agent Memory 76 tests, Workflow 45 tests, Merge Request Review 9 tests; full pnpm typecheck and git diff --check passed.
