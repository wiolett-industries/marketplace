# Live Browser Debug

`live-browser-debug` lets Codex inspect and record the user's real browser
session during local frontend debugging.

It is designed for cases where Playwright is the wrong tool because the bug only
appears in the actual browser tab the user is using, with the real auth state,
local storage, cookies, extensions, or delayed malicious behavior.

The plugin provides:

- temporary integration guidance for local frontend apps
- session discovery and labeling for multiple open tabs
- recording and redirect-watch workflows
- console, error, network, DOM, storage, and navigation inspection
- best-effort approximate visual snapshots

The bridge is local-only and intended for temporary development debugging.
