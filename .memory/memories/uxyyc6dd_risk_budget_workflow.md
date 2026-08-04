---
{
  "id": "uxyyc6dd",
  "file_name": "uxyyc6dd_risk_budget_workflow",
  "tags": [
    "agents",
    "delegation",
    "reuse",
    "task-chats",
    "ui",
    "workflow"
  ],
  "layer": "deep",
  "ref": null,
  "source": "model_inferred",
  "confidence": 0.86,
  "importance": 0.82,
  "created_at": 1783694145863,
  "updated_at": 1785830071234
}
---
Project workflow routing policy:

- fast path: Keep agent-free. Use only for clear, localized, direct work with a small known surface and a clear causal path.

- standard path: Budget one focused agent by default at the most valuable independent investigation, review, or implementation boundary. A second agent is allowed only when it serves a disjoint role with concrete payoff.

- Affirmative delegation candidates: Nontrivial diagnosis with an unclear causal chain; unfamiliar multi-surface repository exploration; code or plan review that benefits from independent evidence. Use workflow_explorer for broad read-only mapping and assign a matching reviewer for independent evaluation. The parent (human/product owner) retains product decisions, integration, and final synthesis.

- Do not fan out work by file/checklist/skill count. Keep work local unless the surface is small and causal path is clear or coordination would not add evidence.

- User-visible task/chat vs internal subagent: A user-visible task/chat is distinct from an internal subagent and does not consume the agent budget. Create a user-visible task/chat only when the user requests splitting work or explicitly authorizes task splitting, and when the work has a standalone deliverable, an isolated worktree or long-running lifecycle, or expected later user interaction. In Codex, use the supported task/thread API. Short research leaves and independent reviews remain internal subagent work.

- UI reuse gate (for substantial production UI): Before adding new JSX/CSS/layout/components, complete the ui-contract reuse gate: identify the closest screen, existing primitives, tokens (theme/font/spacing), and responsive patterns; record candidate paths and tag each as reuse/adapt/none. New duplicate components or unexplained visual patterns require a NEEDS_CONTEXT marker; UI review should mark them Important. Carry the gate through discovery, planning, execution, and implementer prompts (Codex/Claude).

- Canonical references: delegation matrix at plugins/workflow/skills/using-workflow/references/delegation-and-task-chats.md; UI gate details at plugins/workflow/skills/ui-contract/references/reuse-gate.md.

- Verification: After this change, tests passed: zsh -lic 'pnpm --filter @wiolett/workflow test && git diff --check' returned 61/61 passing.
