---
name: ui-contract
description: Use as a supporting skill for substantial production UI and for any production UI change that names an existing/shared component, pattern, or analogous screen. Do not trigger for tiny copy/style changes without an architecture constraint, invisible frontend plumbing, or bounded mockups and throwaway prototypes.
---

# UI Contract

Support production UI within the active workflow and its existing agent budget.

## Mockup And Prototype Fast Path

For an explicitly bounded mockup, concept, or prototype, create no durable contract unless requested. Inspect the viewport/objective once; check only clipping, overlap, unreadable copy, broken assets, and major hierarchy failures; use no UI review agent under `fast`; stop after one successful visual pass. Do not invent production state matrices, breakpoints, or reusable behavior.

## Production Define Mode

## UI Reuse Gate

Before production JSX, CSS, or layout, inspect the closest screen, shared primitives, layout/responsive patterns, and tokens.

## UI Reuse Receipt

Before the first edit, record in `ui-contract.md` or chat the target, shared path/export, layout precedent, `reuse`/`adapt`/`none`, and planned structural verification; [reuse-gate.md](references/reuse-gate.md) defines the exact receipt. Named reuse is an architecture acceptance criterion, not visual equivalence. Resolve its path/export; do not substitute local markup or wrappers without explicit approval. Component reuse alone is insufficient; `none` needs evidence.

Reuse/adapt the closest primitive and named layout precedent. Do not introduce one-off components, arbitrary font/size/spacing values, or a parallel responsive/layout pattern when an established local pattern covers the need. A “shared components only” constraint forbids custom components/wrappers; compose/adapt or ask. Otherwise, a new primitive needs evidence no candidate fits.

Before substantial undecided production UI implementation, create/update the active plan's `ui-contract.md`; smaller named-reuse tasks record the receipt in chat. Include only acceptance-relevant details:

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

Before completing substantial UI or named reuse, review once against the contract and browser evidence. Verify reuse; unapproved duplicate components, tokens, or layouts are `Important`. Named components need lint, AST/import assertion, or focused code evidence; behavior tests and screenshots alone do not prove reuse. Record `UI_PASS`/`UI_REVISE` under `artifacts/ui-review/` when a plan exists; otherwise report in chat.

An independent UI reviewer is optional, consumes the existing task-wide budget, and requires the same benefit gate as any other agent. Screenshots do not replace relevant code verification, and code checks do not replace the scoped visual pass.

Stop on `UI_PASS`. `Polish` does not extend the loop unless requested.
