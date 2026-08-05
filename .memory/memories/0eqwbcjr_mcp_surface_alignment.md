---
{
  "id": "0eqwbcjr",
  "file_name": "0eqwbcjr_mcp_surface_alignment",
  "tags": [
    "agent-memory",
    "cli",
    "maintenance",
    "registry",
    "release"
  ],
  "layer": "deep",
  "ref": null,
  "source": "model_inferred",
  "confidence": 0.99,
  "importance": 0.9,
  "created_at": 1783548897136,
  "updated_at": 1785967874524
}
---
Agent Memory maintenance and release safeguards:

- Full maintenance is two-stage: deterministic repair removes only dead index pointers, orphan graph files, and structurally impossible edges; semantic Codex reconciliation may merge, split, create, update, or remove memories only with explicit evidence. Ambiguous canonical memories remain.
- Manual graph edges are authoritative. AUTO links with the same tuple are omitted; replacement is transactional. Duplicate canonical tuples resolve deterministically in both cold SQLite rebuild and maintenance: manual beats auto, then the most recently updated manual revision wins. No-op automatic refresh preserves graph bytes and timestamps.
- The cross-project registry is auxiliary metadata at ~/.agents/.wiolett/agent-memory/projects.json. It is populated only by existing project memory at MCP startup or a successful project write; help/view remain side-effect-free, and registry locks never fail or delay durable writes/MCP startup.
- Interactive Open memory view runs quietly with Node warnings and agent-memory diagnostics suppressed, prints its URL and Ctrl+C instruction through the CLI outro, and uses wider graph spacing. Filesystem watch failures disable automatic refresh rather than crashing the view.
- Release 1.1.0 aligns root marketplace, all npm packages, runtime versions, and Claude/Codex/Kimi manifests. Canonical .memory artifacts are committed; only .memory/memory.db* is cache.
