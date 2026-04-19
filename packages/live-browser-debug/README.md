# Live Browser Debug MCP

Local MCP server for the `live-browser-debug` Codex plugin.

This package runs a local HTTP bridge and MCP server so Codex can debug the
user's real browser session by temporarily injecting a lightweight client into a
frontend app under development.

The MVP supports:

- session discovery and labeling
- recording incident timelines
- redirect-focused capture
- console, error, DOM, storage, and network inspection
- best-effort approximate visual snapshots

It is intended for local development use and temporary integration only.
