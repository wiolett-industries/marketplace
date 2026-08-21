---
{
  "id": "g6tfutxq",
  "file_name": "g6tfutxq_gitlab_review_scope",
  "tags": [
    "gitlab",
    "hooks",
    "merge-request-review",
    "versioning",
    "workflow"
  ],
  "layer": "deep",
  "ref": null,
  "created_at": 1787317989817,
  "updated_at": 1787317989817
}
---
In agent-marketplace-next, Workflow SessionStart companion context must not phrase the Merge Request Review integration boundary as a global GitLab CLI prohibition. The MR review MCP owns only `.workflow/mr-reviews/` protocol state and artifacts; actual GitLab reads/writes may use any separately configured and authorized interface available in the environment, including an external GitLab MCP or authenticated `glab`. State explicitly that this does not restrict CLI use outside MR reviews, and keep the review skill/manifests/docs aligned. For plugin-only instruction or hook changes, bump the affected plugin manifest versions and the aggregate marketplace version, but do not bump `packages/*` MCP runtime versions when no MCP implementation changed. Verify with the workflow hook regression test, full `pnpm test`, `pnpm typecheck`, and `git diff --check`.
