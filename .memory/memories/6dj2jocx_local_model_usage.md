---
{
  "id": "6dj2jocx",
  "file_name": "6dj2jocx_local_model_usage",
  "tags": [
    "agent-memory",
    "cli",
    "codex",
    "gate",
    "reconciliation",
    "usage"
  ],
  "layer": "deep",
  "ref": null,
  "source": "model_inferred",
  "confidence": 0.9,
  "importance": 0.8,
  "created_at": 1785833570620,
  "updated_at": 1785834337599
}
---
Agent Memory project contracts:

- Usage, reconciliation report, and Codex invocation contracts remain as implemented in code.

- Memory write gate default: preserve submitted content verbatim with decision `allow`. `rewrite` is exceptional and must never be used for prose, grammar, formatting, headings, language, concision, tone, clarity, Markdown, commands, code, field names, paths, versions, or exact technical wording. It is allowed only for a minimal safety correction not otherwise rejected, objectively malformed structure, or removal of clearly unrelated transcript residue. Any rewrite must be surgical and preserve all durable facts, negation, modality, ownership, constraints, and uncertainty. If the change is editorial or preservation is uncertain, return allow with null normalized content.
