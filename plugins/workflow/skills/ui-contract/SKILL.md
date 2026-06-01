---
name: UI Contract
description: Use for substantial frontend or UI work to define a buildable UI contract before implementation and review the delivered interface before completion
---

# UI Contract

Use this workflow support skill whenever frontend or UI quality materially affects success.

This is not a standalone workflow. It plugs into:

- `Context Discovery` when the UI direction is unclear
- `Writing Plans` when a UI change needs a durable implementation contract
- `Executing Plans` when implementation must preserve the approved UI contract
- `Finalizing Plan` when the delivered UI must be reviewed before completion

## When To Use

Use for substantial UI work, including:

- new screens, panels, routes, flows, games, dashboards, or tools
- meaningful layout, hierarchy, or interaction changes
- visual polish where product feel matters
- frontend changes that may affect loading, error, empty, disabled, hover, focus, or responsive states
- implemented UI that needs structured review before handoff

Skip for tiny copy edits, one-line style fixes, or purely internal frontend plumbing that cannot affect visible behavior.

## Modes

### `define`

Use before implementation when the UI direction is not already locked.

Create or update:

```text
.workflow/plans/<run>/ui-contract.md
```

The contract must be practical enough to build from. Include:

- objective and user job
- surface scope: routes, screens, panels, components, and states in play
- primary hierarchy: what should be noticed first, second, and last
- main action and secondary actions
- density, spacing, typography, and responsive expectations
- copy tone and labels that must not drift
- color, emphasis, icon, and affordance rules
- loading, error, empty, disabled, partial-data, hover, focus, and success states
- desktop and mobile expectations
- accessibility and text-overflow constraints
- explicit non-goals and out-of-scope surfaces
- acceptance criteria for review

Avoid brand manifestos and vague taste words. Prefer implementation-facing constraints.

### `review`

Use after implementation and before final completion.

Write review artifacts under:

```text
.workflow/plans/<run>/artifacts/ui-review/
  contract-check.md
  browser-check.md
  screenshots.md
  findings.md
```

Review against `ui-contract.md` when it exists. If no contract exists, review against strong frontend fundamentals and record that the contract was missing.

Return one verdict:

- `UI_PASS`
- `UI_REVISE`

Group findings by:

- `Important`
- `Minor`
- `Polish`

Each finding must say:

- what is off
- why it matters
- what should change

## Browser And Visual Verification

When the app can reasonably run locally, review visible UI in a browser before signoff.

Check:

- desktop and mobile viewport behavior
- text overflow, clipping, wrapping, and button label fit
- loading, error, empty, disabled, hover/focus, and success states where reachable
- layout stability during state changes
- overlapping or occluding UI
- whether the primary content is visible and framed correctly
- whether visual assets render as intended

Capture evidence in `artifacts/ui-review/browser-check.md` and reference screenshots or notes in `artifacts/ui-review/screenshots.md`.

If browser verification is not possible, record the blocker and review static code/state coverage instead.

## Integration Rules

For `Writing Plans`:

- UI plans must include `ui-contract.md` for substantial visible work.
- The plan must list `ui-contract.md` as an acceptance source.
- If UI work is chunked, the root contract owns global visual rules and each chunk may add local UI notes in the chunk context.

For `Executing Plans`:

- Re-read `ui-contract.md` before editing UI.
- Do not reinterpret hierarchy, copy, or interaction rules without updating `decisions.md`.
- Keep small user-testing fixes fast; do not run full build/review after every inline visual tweak while the user is actively testing.

For `Finalizing Plan`:

- If UI changed, run this skill in `review` mode before declaring completion.
- For `medium` or larger UI work, use a specialized UI review agent when workflow subagents are authorized and available.
- UI review does not replace typecheck, tests, or build; it catches product and visual failures those checks cannot see.

## Hard Rules

- Do not start substantial undecided UI work without a contract.
- Do not call substantial UI work done without a structured UI review.
- Do not bury UI acceptance criteria only in chat.
- Do not let screenshots or browser checks replace code verification.
- Do not let code verification replace visual review when the user-facing surface matters.
