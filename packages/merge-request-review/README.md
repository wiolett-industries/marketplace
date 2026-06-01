# Merge Request Review

MCP runtime for the Merge Request Review Codex plugin.

On startup it:

- syncs canonical `merge_request_*` custom agents into `~/.codex/agents/`
- creates best-effort compatibility links under `~/.agents/agents/`
- registers filesystem-backed `.workflow/mr-reviews/` state and artifact tools

This package does not talk to GitLab. The model or an external GitLab MCP is responsible for fetching MR metadata, discussions, diffs, CI state, and for posting notes. This MCP owns the review protocol state.

## CLI

```text
merge-request-review        Start MCP stdio server
merge-request-review --help Print help
```
