---
name: context-discovery
description: Use after intent routing only when unresolved requirements, product intent, architecture, constraints, or tradeoffs can materially change scope, risk, acceptance criteria, or user-visible behavior. Inspect discoverable facts first and avoid exhaustive questioning.
---

# Context Discovery

Gather only enough context for a confident execution decision or decision-complete durable plan. Ask only questions whose answers can change scope, architecture, risk, acceptance criteria, or user-visible behavior.

## Question Budget

1. Start at the named working surface; inspect only the smallest code, test, or manifest evidence that resolves the question.
2. Ask one grouped question batch for the remaining material branches.
3. Use a second batch only if the first answer reveals a new costly or irreversible branch.
4. For reversible fast/standard decisions, proceed with an explicit reasonable assumption when clarification would cost more than correction.
5. Stop when another answer would not change the implementation, primary path, or assurance profile.

Do not ask for discoverable facts, preferences that do not affect the result, or exhaustive edge cases outside the requested scope.

## UI Discovery

For production UI work, complete the `ui-contract` reuse gate before proposing new components or visual rules. Inspect the closest screen, reusable primitives, and visual source of truth; capture the candidate paths and `reuse`/`adapt`/`none` decision in the plan or handoff. This is part of normal discovery, not a separate design exercise.

## Read Budget

These are hard gates. Count new file output; prefer slices over whole files.

- `fast`: diff or named surface; at most three files, two searches, and 12 KB.
- `standard`: at most four files, three searches, and 16 KB initially; eight files or 25 KB total unless the next read answers a named dependency.
- `assurance` or explicit audit: declare the extra surface before widening and keep each pass tied to a named risk.

No whole-repository scan without a named unknown. Stop when the direct path and tests are known. A new plan, compaction, retry, hand-off, or correction never resets these totals. At the cap, proceed, shrink, ask, or name the gap.

## Exploration Delegation

For nontrivial diagnosis or unfamiliar mapping, use `workflow_explorer` only after the initial probe exposes a named unknown across known surfaces. Never delegate generic orientation. The parent keeps the decision; keep direct lookups local.

Give the explorer a question, surfaces, six-file-slice/20-KB default, and the decision it must unblock. Allow more only for named assurance surfaces. For UI inventory, require reusable component, analogous-screen, token, and responsive-pattern paths plus a `reuse`/`adapt`/`none` recommendation. Return paths/evidence and a compact recommendation, not a dump.

## Bounded Spike

When feasibility is genuinely uncertain, state the uncertainty and run one disposable experiment or read-only investigation. Use up to three only for distinct unknowns. Record evidence in an active plan when one exists; otherwise summarize in chat. A spike must not drift into production implementation.

Before continuing, capture only the decisions needed by the next step: goal, success criteria, scope/non-goals, constraints, material risks, and unresolved questions. Do not create workflow artifacts unless a durable path is authorized.
