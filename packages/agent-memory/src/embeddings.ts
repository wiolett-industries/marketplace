import { getEmbeddingClient } from './model-provider.js';

export async function embed(text: string): Promise<number[]> {
  const embeddings = await getEmbeddingClient();
  if (!embeddings) {
    return [];
  }

  return embeddings.createEmbedding(text);
}
