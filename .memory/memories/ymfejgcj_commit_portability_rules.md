---
{
  "id": "ymfejgcj",
  "file_name": "ymfejgcj_commit_portability_rules",
  "tags": [
    "agent-memory",
    "codex",
    "git",
    "workflow"
  ],
  "layer": "deep",
  "ref": null,
  "created_at": 1782687350163,
  "updated_at": 1782687350163
}
---
In this repository, shared project Agent Memory content must be portable: use repository-relative paths or logical placeholders, never machine-local absolute filesystem paths. When project memory changes, commit the following artifacts under .memory/: .memory/memories/, .memory/index/, .memory/embeddings/, and .memory/graph/ if they are not ignored; keep only .memory/memory.db* as the local cache.
