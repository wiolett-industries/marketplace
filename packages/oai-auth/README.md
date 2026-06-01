# OpenAI Auth

Shared OpenAI-compatible model access package for Wiolett MCP plugins.

Model access uses a normal OpenAI-compatible API key. The default model for
text calls is `gpt-5-nano`.

## Providers

- `OpenAIResponsesClient` calls the OpenAI-compatible Responses API.
- `OpenAIEmbeddingsClient` exposes embeddings for plugins that need semantic search.
- `createDefaultModelProvider` returns OpenAI-compatible clients when an API key is configured.

## Auth Config

The package reads an API key from `OPENAI_API_KEY` or:

```text
~/.agents/.wiolett/auth-config.json
```

Example:

```json
{
  "openAIKey": "sk-proj-...",
  "endpoint": "https://api.openai.com/v1",
  "embeddingModel": "text-embedding-3-small"
}
```

## Environment

- `OPENAI_API_KEY` provides API key auth without a config file.
- `WIOLETT_AUTH_CONFIG_PATH` overrides the fallback config path.
