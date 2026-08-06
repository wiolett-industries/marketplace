---
{
  "id": "6ilp4hao",
  "file_name": "6ilp4hao_windows_fts5_paths",
  "tags": [
    "cli",
    "fts5",
    "migration",
    "paths",
    "sqlite",
    "windows"
  ],
  "layer": "deep",
  "ref": null,
  "created_at": 1786016042587,
  "updated_at": 1786016042587
}
---
Windows compatibility fix pattern for Agent Memory CLI: legacy global-memory migration must create a junction (not a directory symlink) on win32, because normal users may lack symlink privilege. If SQLite lacks FTS5, schema initialization must retain the base tables and skip FTS triggers; search continues via the existing portable lexical scorer. Expand custom home-relative config paths in both ~/ and ~\\ forms.
