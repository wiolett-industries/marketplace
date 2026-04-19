---
name: Review Implemented UI
description: Use after a frontend change is implemented to audit hierarchy, copy, spacing, color discipline, interaction states, and overall UX quality
---

# Review Implemented UI

Audit a finished or nearly finished UI with a structured frontend eye.

This is not a code-style review. It is a product-facing UI review.

## Review Dimensions

Assess the UI across these dimensions:

1. Copy
   CTA labels, empty states, errors, warnings, and whether the text feels intentional.

2. Hierarchy
   Focal points, scan order, information grouping, and whether the main action is visually obvious.

3. Color Discipline
   Accent restraint, contrast quality, and whether emphasis is spent deliberately instead of everywhere.

4. Typography
   Clear size/weight hierarchy, readability, and consistency of text roles.

5. Spacing and Rhythm
   Alignment, breathing room, density choices, and whether spacing tokens feel coherent.

6. Interaction and States
   Loading, empty, error, disabled, and success handling, plus whether the surface behaves like a finished product.

## Output

Return:

- `UI_PASS`
- `UI_REVISE`

And findings grouped by:

- `Important`
- `Minor`
- `Polish`

Each finding should say:
- what feels off
- why it matters
- what to change

If a UI contract exists, review against it first. If no contract exists, review against strong frontend fundamentals instead.
