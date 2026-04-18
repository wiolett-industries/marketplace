import { getOpenAIClient } from './openai.js';

export async function embed(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  if (!openai) {
    return [];
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0]?.embedding ?? [];
}
