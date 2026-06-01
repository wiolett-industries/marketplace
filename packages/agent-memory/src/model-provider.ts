import {
  createDefaultModelProvider,
  hasEmbeddingProviderConfig,
  type DefaultModelProvider,
  type EmbeddingClient,
  type ModelClient,
} from '@wiolett/oai-auth';

let providerPromise: Promise<DefaultModelProvider> | null = null;

export function resetModelProvider(): void {
  providerPromise = null;
}

export function isSemanticSearchEnabled(): boolean {
  return hasEmbeddingProviderConfig();
}

export async function getModelClient(): Promise<ModelClient | null> {
  return (await getProvider()).modelClient;
}

export async function getEmbeddingClient(): Promise<EmbeddingClient | null> {
  return (await getProvider()).embeddingClient;
}

function getProvider(): Promise<DefaultModelProvider> {
  providerPromise ??= createDefaultModelProvider();
  return providerPromise;
}
