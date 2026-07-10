---
{
  "id": "uxyyc6dd",
  "file_name": "uxyyc6dd_risk_budget_workflow",
  "tags": [
    "marketplace",
    "migration",
    "gpt-5.6",
    "agents",
    "skills",
    "workflow",
    "review",
    "memory",
    "tools",
    "gitlab"
  ],
  "layer": "deep",
  "ref": null,
  "source": "model_inferred",
  "confidence": 0.7,
  "importance": 0.8,
  "created_at": 1783694145863,
  "updated_at": 1783709484349
}
---
Project memory update: Marketplace 0.2.9, Agent Memory plugin 0.4.3, Workflow plugin 0.4.4 / @wiolett/workflow 0.2.6, and Merge Request Review plugin 0.3.4 / @wiolett/merge-request-review 0.2.5 complete the GPT-5.6 migration across agents, skills, hooks, manifests, docs, tests, and runtime version constants.

Core orchestration contract:
- Choose exactly one primary task path: direct, plan-execute, audit, or ready GitLab MR review.
- intent-gate and context-discovery are brief local routing helpers.
- ui-contract, workflow-mcp, and using-agent-memory are supporting skills and must never allocate separate agents, review loops, or budgets.
- A triggered skill does not imply an artifact, plan, subagent, review, or verification step.
- GitLab review uses review-merge-request and is mutually exclusive with finalizing-plan for the same review.

Task-wide budgets:
- fast: 0 agents and one targeted verification bundle.
- standard: at most 1 agent total, used only at the real bottleneck.
- assurance: declared total, default 3, at most 2 reviewers per round.
- explicit audit: bounded depth-specific budget.
- Parent Max/Ultra and multiple applicable skills do not expand budgets.
- Run the same verification only once while the diff and relevant environment are unchanged.
- Stop when scoped acceptance, required evidence, and material-risk gates pass; LOW/cosmetic/speculative polish does not extend work.

Action and persistence boundaries:
- Answer/explain/diagnose/review/discussion requests inspect and report without code, .workflow, memory, or external writes.
- Read-only/no-edits blocks those writes unless the same request explicitly authorizes one.
- Durable plan/audit artifacts require explicit authorization or real multi-step/risk/recovery value.
- using-agent-memory performs one focused project query only when prior knowledge can change the task.
- Memory writes are state changes and happen only for a real durable lesson; other skills only point to this owner.

Fast paths:
- Bounded mockups/prototypes: one requested viewport and one local visual pass; no production UI state matrix or UI agent.
- Quick audits: chat-only, no .workflow artifacts, 0 agents.
- Normal ready GitLab MR review: 0 agents by default, at most 1 when independence materially changes the decision.
- High-risk GitLab MR review: at most 2 agents; support roles consume the same budget.
- CI is primary MR verification when coverage is clear; local checks fill concrete gaps.
- Re-review only changed delta and affected paths; one clean pass at current SHA is sufficient.

Skill packaging:
- All 11 frontmatter names match lowercase kebab-case folder names.
- Skill entrypoints total about 5,405 words; detailed schemas/templates live in seven directly linked references and load only when needed.
- Critical trigger, action, safety, evidence, and stop contracts remain in SKILL.md.
- Exact model choice remains in canonical agent TOMLs: Luna for mechanical/structured work, Terra for everyday implementation/exploration/primary review, Sol for complex/high-risk work. Skills use semantic work_class and agent_role.

Verification:
- All 11 skill-creator quick validators pass.
- Agent Memory tests: 73 passed.
- Workflow tests: 44 passed.
- Merge Request Review tests: 8 passed.
- Full pnpm test passes.
- Full pnpm typecheck passes.
- git diff --check passes.
- Agent Memory and MR generic plugin validation pass. Workflow's repo-supported hooks manifest is covered by source tests; the generic plugin-creator validator does not yet accept the hooks field.
