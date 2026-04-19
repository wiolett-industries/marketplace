---
name: Using Live Browser Debug
description: ALWAYS use for frontend bugs that depend on the user's real browser session, especially auth issues, local-state issues, delayed redirects, malicious injections, or behavior that Playwright would miss
---

# Using Live Browser Debug

Use this skill when a frontend bug depends on the real browser tab the user is actually using rather than an isolated automation browser.

This is the right tool when:

- the bug appears only after sign-in or after using the app normally
- local storage, session storage, cookies, or browser-specific state matter
- the page redirects after a delay
- suspicious third-party or malicious behavior needs to be captured in a time window
- Playwright would miss the real tab state or reproduce in a separate context

## Core Workflow

1. Call `browser_debug_prepare()` first.
2. Apply the recommended temporary integration patch in the frontend app.
3. Reload the local app so the injected client attaches to the bridge.
4. Call `browser_debug_sessions()` and label the correct tab if needed.
5. Attach to the target session.
6. Use recording or redirect-watch tools before reproducing the issue.
7. Inspect the resulting timeline, logs, network activity, and snapshots.
8. Remove the temporary integration patch when debugging ends.

## Session Selection

When there are multiple tabs of the same app:

- inspect `title`, `url`, `route_hint`, `description`, and `main_heading`
- use `browser_debug_label_session()` to assign a human-readable label
- then attach to the correct session explicitly

Do not assume the most recent tab is the right one when two sessions look similar.

## Recording Rules

Use `browser_debug_start_recording()` when you need a fixed capture window.

Use `browser_debug_watch_for_redirect()` when:

- the bug redirects the page after a delay
- suspicious code appears to navigate away
- unload-time evidence may disappear if you inspect only the current state

For redirect incidents, prefer timeline and snapshot inspection over a single point-in-time check.

## What This Plugin Is For

Use this plugin to gather:

- console output and runtime errors
- network metadata and bodies
- DOM and state snapshots
- navigation and redirect timeline
- approximate visual captures

It is not a replacement for full browser automation. It is a debugging bridge for the real browser session.
