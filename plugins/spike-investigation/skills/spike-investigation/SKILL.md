---
name: Spike Investigation
description: Use when feasibility, implementation approach, or library choice is materially uncertain and a few bounded experiments would reduce design risk before planning
---

# Spike Investigation

Run a small number of throwaway experiments to answer a concrete uncertainty before full planning starts.

This skill is for reducing risk, not for accidentally implementing the feature under a different name.

## When to Use

Use this skill when:
- you are unsure which technical approach is viable
- library or framework choice is unclear
- integration risk is high enough to justify experiments
- a short spike is cheaper than planning blind

Do not use it when the path is already clear enough to plan directly.

## Spike Rules

- Keep spikes bounded and disposable.
- Prefer 2-5 focused experiments, not endless branching.
- Each spike should answer one concrete question.
- Record findings and recommendation.
- Do not quietly turn the spike into production implementation.

## For Each Spike

Capture:

1. Question
   What uncertainty is this spike meant to resolve?

2. Approach
   What did you try?

3. Evidence
   What commands, outputs, prototype behavior, or code observations support the result?

4. Verdict
   - `works`
   - `works with caveats`
   - `not recommended`

5. Implication
   What does this mean for the final implementation direction?

## Final Output

Summarize:
- the spikes run
- the findings
- the recommended path
- the main caveats or unresolved risks

If the spike resolves a durable technical decision, confirmed workflow, or recurring constraint, activate `Using Agent Memory` and store the outcome as project memory once the result is clear.
