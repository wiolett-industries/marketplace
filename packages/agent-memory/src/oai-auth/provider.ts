import { OpenAIEmbeddingsClient } from './openai-embeddings.js';
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
  embeddingClient: EmbeddingClient | null;
};

export async function createDefaultModelProvider(options: DefaultModelProviderOptions = {}): Promise<DefaultModelProvider> {
  const openAIConfig = resolveOpenAIProviderConfig(options.openai);
  const embeddingConfig = resolveEmbeddingProviderConfig(options.openai);
  const embeddingClient = embeddingConfig ? new OpenAIEmbeddingsClient(options.openai) : null;

  if (openAIConfig) {
    return {
      source: 'openai-compatible',
      modelClient: new OpenAIResponsesClient(options.openai),
      embeddingClient,
    };
  }

  return {
    source: 'none',
    modelClient: null,
    embeddingClient,
  };
}
