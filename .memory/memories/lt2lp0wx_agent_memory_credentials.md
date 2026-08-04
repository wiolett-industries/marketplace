---
{
  "id": "lt2lp0wx",
  "file_name": "lt2lp0wx_agent_memory_credentials",
  "tags": [
    "agent-memory",
    "credentials",
    "migration",
    "release",
    "verification"
  ],
  "layer": "deep",
  "ref": null,
  "created_at": 1785450949704,
  "updated_at": 1785450949704
}
---
In agent-marketplace-next, a canonical ai-providers.yml with an existing openai provider but an empty auth.api_key disables model-backed gate, synthesis, and embeddings because canonical YAML is intentionally authoritative and runtime legacy/environment fallback must remain disabled. The safe repair pattern is bootstrap-only: when the canonical openai credential is empty, a valid legacy Agent Memory credential exists, and the migration marker does not already say legacy_config_migrated=true, update only providers.openai.auth.api_key through the YAML document API, preserve comments/unrelated providers/routes, enforce mode 0600, never log the secret, and mark the repair so a later intentional credential clear is not silently reversed. Never inject the legacy OpenAI credential into custom providers. Workflow auth diagnostics must inspect the routed gate provider's actual non-empty api_key instead of treating ai-providers.yml existence as configured. Release verification for this class of change is one full login-shell pnpm test, pnpm typecheck, git diff --check, version-surface scan, and npm pack --dry-run for all publishable packages.
