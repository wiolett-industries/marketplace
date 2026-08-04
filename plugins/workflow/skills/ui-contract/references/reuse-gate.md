# UI Reuse Gate

Use this before substantive production UI changes. Search narrowly from the requested surface; do not inventory the whole repository.

1. Find the closest existing screen/feature and its layout/responsive behavior.
2. Find reusable primitives and composition patterns: controls, fields, dialogs, lists, cards, feedback states, icons, and utilities.
3. Find visual sources of truth: theme/tokens, global CSS, font loading, typography scales, spacing/radius/shadow rules, and viewport conventions.
4. Record paths and choose one outcome:
   - `reuse`: use the existing primitive unchanged;
   - `adapt`: extend or compose it within the approved scope;
   - `none`: no candidate is suitable; state the concrete missing behavior or visual contract.

Pass this decision to every UI implementer. New components and styles must inherit the local layout, responsive, and typography rules unless the approved UI contract explicitly requires a deviation. Do not create a new shared abstraction for a one-off screen; do not clone a component merely to make local styling easier.

During review, compare the new surface with the chosen candidates and tokens. A duplicate primitive, unexplained bespoke size/font/spacing, or competing responsive pattern is an `Important` finding unless the recorded `none` decision justifies it.
