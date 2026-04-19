---
name: Using UI Contract Review
description: ALWAYS use for substantial frontend changes, before implementation to define the UI contract and after implementation to review the delivered UI against that contract or against strong frontend fundamentals
---

# Using UI Contract Review

This is the single UI workflow skill for the `ui-contract-review` plugin.

Use it for both phases of meaningful frontend work:

- before implementation: define the UI contract
- after implementation: review the delivered UI

This skill usually sits inside a broader engineering flow. If the `workflow` plugin is installed, use it alongside `Using Workflow`, `Brainstorming`, `Feature Development`, or `Writing Plans` rather than as a standalone replacement for them.

## Activation Rule

Always use this skill when the task includes substantial UI work, especially when:

- the layout or hierarchy is still soft
- several components or screens need to feel coherent
- the implementation could drift without explicit visual rules
- a built UI needs structured audit before handoff

If the UI matters enough that you would care whether it feels coherent, this skill should be active.

## Modes

### `define`

Use before implementation when the UI direction is not fully locked.

Produce a concise contract covering:
- objective
- surface scope
- layout and hierarchy
- copy and tone
- color and emphasis
- typography and spacing
- states and interactions
- non-negotiables

The contract should be practical enough to build from, not decorative.

Good contract output answers:
- what the user is supposed to notice first
- what the main action is
- how dense or spacious the surface should feel
- what tone the copy should carry
- which decisions the implementation must not quietly reinterpret

### `review`

Use after implementation to audit the final UI.

Review:
- copy
- hierarchy
- color discipline
- typography
- spacing and rhythm
- interaction and states

Review the implemented UI either:
- against the defined contract, if one exists
- or against strong frontend fundamentals, if no contract was created first

Return:
- `UI_PASS`
- `UI_REVISE`

With findings grouped by:
- `Important`
- `Minor`
- `Polish`

Each finding should explain:
- what feels off
- why it matters
- what to change

## Workflow

1. Select the mode: `define` or `review`
2. Keep the scope explicit:
   - which screen, panel, route, component, or feature surface is in play
3. Stay concrete:
   - avoid vague taste language
   - prefer implementation-facing rules
4. For `review`, prioritize the issues that most affect clarity and product feel first

## Hard Rule

Do not jump into frontend implementation without a contract when the UI is still materially undecided.

Do not treat implemented UI as finished without a structured review when the surface is important enough to matter.

## Anti-Patterns

- turning the contract into a brand manifesto
- reviewing only for pixel trivia while missing weak hierarchy or poor CTA clarity
- signing off on a UI that technically works but still feels inconsistent or half-finished
