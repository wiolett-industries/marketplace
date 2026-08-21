---
{
  "id": "6dj2jocx",
  "file_name": "6dj2jocx_local_model_usage",
  "tags": [
    "agent-memory",
    "cli",
    "codex",
    "gate",
    "global-memory",
    "reconciliation",
    "scope",
    "skills",
    "usage"
  ],
  "layer": "deep",
  "ref": null,
  "source": "model_inferred",
  "confidence": 0.99,
  "importance": 0.9,
  "created_at": 1785833570620,
  "updated_at": 1787305785946
}
---
Agent Memory project contracts:

- Usage, reconciliation report, and Codex invocation contracts remain as implemented in code.

- Memory write gate default: preserve submitted content verbatim with decision `allow`. `rewrite` is exceptional and must never be used for prose, grammar, formatting, headings, language, concision, tone, clarity, Markdown, commands, code, field names, paths, versions, or exact technical wording. It is allowed only for a minimal safety correction not otherwise rejected, objectively malformed structure, or removal of clearly unrelated transcript residue. Any rewrite must be surgical and preserve all durable facts, negation, modality, ownership, constraints, and uncertainty. If the change is editorial or preservation is uncertain, return allow with null normalized content.

- Caller-selected memory scope is authoritative. The write gate may allow, surgically rewrite, or reject content, but it must never reroute a write between `global` and `project`. Normalize away conflicting `suggested_scope` values and make `handleSave` persist to the requested scope as a second invariant.

- Global gate classification is intentionally permissive for durable cross-project value: a lesson does not become project-only because it was learned during repository work, mentions the originating project as an example, or is also useful there. Reject it as wrongly scoped only when its useful meaning depends exclusively on one repository. Keep global writes fail-closed when model review is unavailable or invalid, and continue rejecting secrets, raw transcripts, ephemeral chatter, and model self-notes.

- The using-agent-memory skill must deliberately consider both scopes at the completion latch and prefer global memory when a durable lesson can improve future work in another repository without depending on the originating repository's code or state. Store repository-dependent details in project memory and avoid duplicating the same undistilled content across both scopes.

- Regression coverage for this contract belongs in the gate, global-scope, and MCP smoke tests; run the full `@wiolett/agent-memory` test suite after changing gate or scope behavior.
