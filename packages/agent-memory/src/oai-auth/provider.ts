import { OpenAIEmbeddingsClient } from './openai-embeddings.js';
import { OpenAIChatCompletionsClient } from './openai-chat-completions.js';
import { resolveEmbeddingProviderConfig, resolveOpenAIProviderConfig, type OpenAIProviderConfigOptions } from './openai-provider-config.js';
import { OpenAIResponsesClient } from './openai-responses.js';
import type { EmbeddingClient, ModelClient } from './types.js';

export type ModelProviderSource = 'openai-compatible' | 'none';

export type DefaultModelProviderOptions = {
  openai?: OpenAIProviderConfigOptions;
};

export type DefaultModelProvider = {
  source: ModelProviderSource;
  modelClient: ModelClient | null;
  modelClients: { gate: ModelClient | null; synthesis: ModelClient | null };
  embeddingClient: EmbeddingClient | null;
};

export async function createDefaultModelProvider(options: DefaultModelProviderOptions = {}): Promise<DefaultModelProvider> {
  const gateConfig = resolveOpenAIProviderConfig({ ...options.openai, role: 'gate' });
  const synthesisConfig = resolveOpenAIProviderConfig({ ...options.openai, role: 'synthesis' });
  const embeddingConfig = resolveEmbeddingProviderConfig(options.openai);
  const embeddingClient = embeddingConfig ? new OpenAIEmbeddingsClient(options.openai) : null;
  const gateClient = createTextClient('gate', gateConfig, options.openai);
  const synthesisClient = createTextClient('synthesis', synthesisConfig, options.openai);

  if (gateClient || synthesisClient || embeddingClient) {
    return {
      source: 'openai-compatible',
      modelClient: synthesisClient,
      modelClients: { gate: gateClient, synthesis: synthesisClient },
      embeddingClient,
    };
  }

  return {
    source: 'none',
    modelClient: null,
    modelClients: { gate: null, synthesis: null },
    embeddingClient,
  };
}

function createTextClient(
  role: 'gate' | 'synthesis',
  config: ReturnType<typeof resolveOpenAIProviderConfig>,
  options: OpenAIProviderConfigOptions | undefined,
): ModelClient | null {
  if (!config) return null;
  const clientOptions = { ...options, role, providerId: config.providerId };
  return config.textApi === 'chat_completions'
    ? new OpenAIChatCompletionsClient(clientOptions)
    : new OpenAIResponsesClient(clientOptions);
}
