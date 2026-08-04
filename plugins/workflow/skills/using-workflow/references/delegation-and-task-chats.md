# Delegation And Task Chats

Read this reference before launching an internal agent or creating a user-visible task/chat. Pick the smallest boundary that gives genuinely new evidence or allows independently useful work to finish sooner.

## Choose The Boundary

| Situation | Default boundary | Why |
| --- | --- | --- |
| A known file or direct causal path answers the question | Parent, local | Coordination adds no useful evidence. |
| Diagnosis spans several layers, logs, tests, or an unfamiliar area | `workflow_explorer` | Isolates broad read-only search and returns the causal evidence. |
| Nontrivial code, plan, or design review needs an independent reading | Matching reviewer | Finds regressions, scope gaps, and unsupported claims the parent may miss. |
| A bounded patch can proceed independently from a locked approach | Matching implementer | Reduces wall time while preserving one parent integration point. |
| A standalone deliverable needs its own lifecycle or later user discussion | User-visible task/chat | Keeps that work and follow-up visible and independently resumable. |

For a `standard` task, use one focused agent whenever diagnosis, review, or exploration is not a small direct lookup. The parent still owns product choices, integration, and the final answer. A second standard agent is justified only for a disjoint role with a named payoff, such as an explorer plus a risk reviewer; do not use it to repeat the same reading.

## Internal Agents

Use internal subagents for short-lived, bounded work whose result belongs in the current response. Give each agent:

- the decision or deliverable it must unblock;
- exact included and excluded surfaces;
- the role/work class, non-goals, and stop condition;
- required evidence or scoped verification; and
- a compact handoff format with paths, findings, uncertainties, and next action.

Do not delegate a one-file lookup, a direct symptom with a known cause, or a task whose coordination costs more than the likely new evidence. Do not fan out by file count, checklist length, or the number of skills.

## User-Visible Task Chats

A task/chat is not a hidden subagent: it is a user-visible, independently resumable unit of work. Create one only when the user asks to split work or has explicitly authorized task splitting, and it has a standalone result, needs an isolated worktree or long-running lifecycle, or is likely to need later user interaction. It does not consume the internal subagent budget, but it must not be used to evade that budget or to create background noise.

In Codex, use the supported task/thread API. For repository work, resolve the project first and choose the appropriate environment; state the objective, repository/environment boundary, expected deliverable, and whether the user should continue the task directly. Do not create a visible task for a short research leaf, an independent review, ordinary tool work, or a tiny follow-up; keep those as internal subagent work or local work in the current task.
