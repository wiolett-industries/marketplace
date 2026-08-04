---
{
  "id": "rn35sah4",
  "file_name": "rn35sah4_project_git_contract",
  "tags": [
    "agent-memory",
    "git",
    "gitignore",
    "project-memory"
  ],
  "layer": "deep",
  "ref": null,
  "created_at": 1785531523946,
  "updated_at": 1785531523946
}
---
In agent-marketplace-next, project `.memory/` is repository-owned team knowledge and must be committed. Canonical changes under `.memory/memories/`, `.memory/index/`, `.memory/embeddings/`, and `.memory/graph/` — including memories, embedding arrays, and graph edges — belong in the repository diff. Never ignore `.memory/` wholesale or treat canonical files as disposable generated output. The only Agent Memory ignore pattern is `.memory/memory.db*`, covering the SQLite cache and its `memory.db-shm`/`memory.db-wal` sidecars. After a project-memory mutation, inspect `git status --short .memory` and remove any broad rule reported by `git check-ignore -v` for canonical artifacts.
