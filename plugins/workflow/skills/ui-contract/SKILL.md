---
name: ui-contract
description: Use as a supporting skill for substantial production UI intended to ship when hierarchy, interaction, responsive behavior, accessibility, or visible states need an explicit build/review contract. Do not trigger for tiny copy/style changes, invisible frontend plumbing, or bounded mockups and throwaway prototypes.
---

# UI Contract

Support substantial production UI without creating an independent workflow or agent budget. The active primary path owns planning, execution, and completion.

## Mockup And Prototype Fast Path

If this skill is explicitly invoked for a bounded mockup, landing-page concept, or throwaway prototype:

- do not create a durable contract unless requested;
- inspect the requested viewport and primary visual objective once;
- check only obvious clipping, overlap, unreadable copy, broken assets, and major hierarchy failures;
- use no UI review agent under `fast`;
- stop after material issues are fixed and the single visual pass succeeds.

Do not invent production state matrices, extra breakpoints, accessibility programs, or reusable behavior for a bounded concept.

## Production Define Mode

## UI Reuse Gate

Before production JSX, CSS, or layout, inspect the closest analogous screen, shared primitives, layout/responsive patterns, and tokens. Record candidates/paths, `reuse`/`adapt`/`none`, and layout precedent (containment, hierarchy, spacing, responsive behavior) in `ui-contract.md` or chat. Component reuse alone is insufficient; no suitable candidate needs evidence.

Reuse/adapt the closest primitive and named layout precedent. Do not introduce one-off components, arbitrary font/size/spacing values, or a parallel responsive/layout pattern when an established local pattern covers the need. A “shared components only” constraint forbids custom components/wrappers; compose/adapt or ask. Otherwise, a new primitive needs evidence no candidate fits.

Read [reuse-gate.md](references/reuse-gate.md) before making the reuse decision or assigning UI work to an implementer.

Before substantial undecided production UI implementation, create or update the active plan's `ui-contract.md`. Include only acceptance-relevant details:

- objective and user job;
- surfaces and primary hierarchy/actions;
- typography, spacing, density, color/emphasis, icons, and copy constraints;
- accepted responsive targets;
- relevant loading, error, empty, disabled, partial, hover, focus, and success states;
- accessibility, overflow, and layout-stability constraints;
- reuse decision and any justified new primitive;
- non-goals and review acceptance criteria.

Do not include vague taste language or states outside accepted scope. Execution must treat the contract as an acceptance source; update `decisions.md` before intentional drift.

## Production Review Mode

Before completing substantial production UI, review once against the contract and runnable browser evidence. Check accepted viewports/states and verify that the reuse decision was followed; flag an unapproved duplicate component, visual token, or layout pattern as `Important`. Record `UI_PASS` or `UI_REVISE` plus concrete `Important`, `Minor`, or `Polish` findings under `artifacts/ui-review/` when a plan exists; otherwise report in chat.

An independent UI reviewer is optional, consumes the existing task-wide budget, and requires the same benefit gate as any other agent. Screenshots do not replace relevant code verification, and code checks do not replace the scoped visual pass.

Stop on `UI_PASS`. `Polish` does not extend the loop unless requested.
