---
{
  "id": "0eqwbcjr",
  "file_name": "0eqwbcjr_mcp_surface_alignment",
  "tags": [
    "agent-memory",
    "cli",
    "graph",
    "maintenance",
    "registry",
    "ui",
    "view"
  ],
  "layer": "deep",
  "ref": null,
  "source": "model_inferred",
  "confidence": 0.99,
  "importance": 0.9,
  "created_at": 1783548897136,
  "updated_at": 1785966341582
}
---
Agent Memory conventions: project memory tools use absolute workspace_root; memory_recall is ID-only, while memory_query/memory_recap are retrieval entrypoints. Project `.memory` canonical artifacts are committed; only `.memory/memory.db*` is disposable cache. Consolidation is an approved full maintenance run: it first performs deterministic structural repair (delete dead index pointers, orphan graph files, and structurally impossible edges, including a manual edge whose source/target/relation/weight is invalid) and rebuilds AUTO links while preserving valid manual links. Then Codex model reasoning performs semantic maintenance: merge, split, create, update, or remove proven redundant/stale memories and decide any non-structural relationship changes. Ambiguous canonical memories remain. A local cross-project registry is stored at `~/.agents/.wiolett/agent-memory/projects.json`: startup registers a project only when it already has persisted memory, and the first successful project write registers it. The interactive CLI exposes `Open memory view`; it launches the project dashboard in a child process with Node `--no-warnings`, filters only `[agent-memory]` diagnostics from child stderr, and reports the URL plus `Press Ctrl+C to stop.` as the interactive CLI's formatted `outro`, not raw stdout. Direct `agent-memory view` remains the detailed diagnostic command. The View Graph panel uses the existing react-force-graph simulation and, for legibility in dense stores, sets its link force distance to 64 and charge strength to -80 after canvas sizing; retain that effect dependency on both graph data and canvas dimensions so it applies on first mount. The View filesystem watcher is best-effort: later watcher errors such as EMFILE must disable automatic refresh without crashing the dashboard; manual refresh remains available.
