import {
  createDefaultModelProvider,
  hasEmbeddingProviderConfig,
  type DefaultModelProvider,
  type EmbeddingClient,
  type ModelClient,
} from './oai-auth/index.js';

let providerPromise: Promise<DefaultModelProvider> | null = null;

export function resetModelProvider(): void {
  providerPromise = null;
}

export function isSemanticSearchEnabled(): boolean {
  return hasEmbeddingProviderConfig();
}

export async function getModelClient(role: 'gate' | 'synthesis' = 'synthesis'): Promise<ModelClient | null> {
  return (await getProvider()).modelClients[role];
}

export async function getEmbeddingClient(): Promise<EmbeddingClient | null> {
  return (await getProvider()).embeddingClient;
}

function getProvider(): Promise<DefaultModelProvider> {
  providerPromise ??= createDefaultModelProvider();
  return providerPromise;
}
