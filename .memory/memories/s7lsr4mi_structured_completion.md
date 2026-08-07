---
{
  "id": "s7lsr4mi",
  "file_name": "s7lsr4mi_structured_completion",
  "tags": [
    "agent-memory",
    "npm",
    "reconciliation",
    "release"
  ],
  "layer": "deep",
  "ref": null,
  "source": "model_inferred",
  "confidence": 0.99,
  "importance": 0.9,
  "created_at": 1786064968082,
  "updated_at": 1786066394177
}
---
Consolidation CLI reliability and release rule:

- A zero exit from spawned `codex exec` is not proof that reconciliation completed. The CLI must request a strict structured report and validate it before the parent process calls `recordReconciliation`; malformed or absent output must leave reconciliation due.
- The 1.1.2 fix uses `codex exec --output-schema` plus `--output-last-message`, stores the report atomically in the parent, and has regression coverage for valid and invalid child output.
- A release version bump must cover root, npm packages, runtime constants, aggregate Kimi metadata, `.kimi-plugin/marketplace.json`, and hidden Codex/Claude plugin manifests. Verify with workspace tests/typecheck and `pnpm --filter <package> publish --dry-run --access public` after committing.
