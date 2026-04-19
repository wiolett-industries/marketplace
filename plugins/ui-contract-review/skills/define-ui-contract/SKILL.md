---
name: Define UI Contract
description: Use before implementing a substantial frontend change to lock the intended layout, hierarchy, copy, spacing, states, and interaction rules
---

# Define UI Contract

Create a concise build contract for a frontend change before code is written.

The point is to prevent five different UI decisions from being made ad hoc during implementation. The contract should be strong enough to guide implementation, but light enough to stay usable.

## When to Use

Use this skill when:
- the task includes new UI or major UI changes
- the visual direction is still soft
- multiple components or screens need to feel coherent
- the implementation would drift without a shared design target

## Contract Sections

Produce a concise contract covering:

1. Objective
   What this UI needs to help the user do.

2. Screen or Surface Scope
   Which screens, panels, routes, or components are in scope.

3. Layout and Hierarchy
   Main regions, focal points, density, grouping, and primary scan order.

4. Copy and Tone
   CTA style, empty-state tone, labels, warnings, and error language.

5. Color and Emphasis
   Accent usage, contrast expectations, and how emphasis should be distributed.

6. Typography and Spacing
   Relative hierarchy, rhythm, spacing consistency, and where restraint matters.

7. States and Interactions
   Hover, focus, loading, empty, error, success, disabled, and transitions if relevant.

8. Non-Negotiables
   Any decisions the implementation should not quietly reinterpret.

## Output Style

Keep it practical and implementation-facing.

- Do not turn it into a brand manifesto.
- Prefer concrete rules over vague taste language.
- If a decision is still open, mark it clearly instead of pretending it is settled.
