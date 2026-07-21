---
name: context-discovery
description: Use after intent routing only when unresolved requirements, product intent, architecture, constraints, or tradeoffs can materially change scope, risk, acceptance criteria, or user-visible behavior. Inspect discoverable facts first and avoid exhaustive questioning.
---

# Context Discovery

Gather only enough context for a confident execution decision or decision-complete durable plan. Ask only questions whose answers can change scope, architecture, risk, acceptance criteria, or user-visible behavior.

## Question Budget

1. Inspect manifests, docs, related code, tests, and recent local patterns first.
2. Ask one grouped question batch for the remaining material branches.
3. Use a second batch only if the first answer reveals a new costly or irreversible branch.
4. For reversible fast/standard decisions, proceed with an explicit reasonable assumption when clarification would cost more than correction.
5. Stop when another answer would not change the implementation, primary path, or assurance profile.

Do not ask for discoverable facts, preferences that do not affect the result, or exhaustive edge cases outside the requested scope.

## Read Budget

- `fast`: inspect the diff or named surface, at most five relevant files, and at most three targeted searches.
- `standard`: start from the named surface and stop by twelve files or about 50 KB of new tool output unless a concrete unresolved dependency justifies widening.
- `assurance` or explicit audit: declare the extra surface before widening and keep each pass tied to a named risk.

Do not list or read the whole repository without a named unknown that requires it. Stop when the direct implementation path and affected tests are known. A small user correction reopens only the touched surface; it does not restart discovery.

## Bounded Spike

When feasibility is genuinely uncertain, state the uncertainty and run one disposable experiment or read-only investigation. Use up to three only for distinct unknowns. Record evidence in an active plan when one exists; otherwise summarize in chat. A spike must not drift into production implementation.

Before continuing, capture only the decisions needed by the next step: goal, success criteria, scope/non-goals, constraints, material risks, and unresolved questions. Do not create workflow artifacts unless a durable path is authorized.
