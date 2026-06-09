---
name: UI Contract
description: Use for substantial frontend or UI work to define a buildable UI contract before implementation and review the delivered interface before completion
---

# UI Contract

Workflow support skill for substantial visible UI work. It plugs into `Context Discovery`, `Writing Plans`, `Executing Plans`, and `Finalizing Plan`; it is not a standalone workflow.

Use for new screens/routes/panels/flows/games/dashboards/tools, meaningful layout/hierarchy/interaction changes, product polish, visible state changes, or structured UI review. Skip tiny copy/style fixes and invisible frontend plumbing.

## Define Mode

Use before implementation when UI direction is not locked. Create/update:

```text
.workflow/plans/<run>/ui-contract.md
```

Contract must be buildable. Include:

- objective and user job
- surfaces: routes, screens, panels, components, states
- primary hierarchy and main/secondary actions
- density, spacing, typography, responsive expectations
- copy tone and labels that must not drift
- color, emphasis, icon, affordance rules
- loading/error/empty/disabled/partial/hover/focus/success states
- desktop/mobile expectations
- accessibility and text-overflow constraints
- non-goals/out-of-scope
- review acceptance criteria

Avoid brand manifestos and vague taste words.

## Review Mode

Use after implementation and before completion. Write:

```text
.workflow/plans/<run>/artifacts/ui-review/
  contract-check.md
  browser-check.md
  screenshots.md
  findings.md
```

Review against `ui-contract.md`; if missing, review against strong frontend fundamentals and record the missing contract.

Verdict: `UI_PASS` or `UI_REVISE`.
Finding severities: `Important`, `Minor`, `Polish`.
Each finding: what is off, why it matters, what should change.

## Visual Verification

When locally runnable, inspect in browser before signoff. Check desktop/mobile, overflow/clipping/wrapping/button labels, loading/error/empty/disabled/hover/focus/success states, layout stability, overlap/occlusion, primary content framing, and asset rendering.

Record evidence in `browser-check.md` and screenshots/notes in `screenshots.md`. If browser verification is blocked, record why and review static code/state coverage.

## Integration Rules

- Writing: substantial UI plans need `ui-contract.md` and must list it as an acceptance source. Root contract owns global visual rules; chunks may add local UI notes.
- Executing: re-read `ui-contract.md`; do not reinterpret hierarchy/copy/interaction without `decisions.md` update. Keep active user-testing fixes fast.
- Finalizing: if UI changed, run review mode before completion. For `medium`+ UI work, use a specialized UI review agent when available. UI review complements typecheck/tests/build; it does not replace them.

Hard rules: do not start substantial undecided UI work without a contract, do not call substantial UI work done without structured UI review, do not leave acceptance criteria only in chat, and do not let screenshots replace code verification or code verification replace visual review.
