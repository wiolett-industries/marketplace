import OpenAI from 'openai';
import { resolveOpenAIApiKey } from './config.js';

let client: OpenAI | null = null;
let clientApiKey: string | null = null;

export function resetOpenAIClient(): void {
  client = null;
  clientApiKey = null;
}

export function getResolvedOpenAIApiKey(): { apiKey: string | null; source: 'env' | 'stored' | 'none' } {
  return resolveOpenAIApiKey();
}

export function getOpenAIClient(): OpenAI | null {
  const { apiKey } = resolveOpenAIApiKey();
  if (!apiKey) {
    resetOpenAIClient();
    return null;
  }

  if (client && clientApiKey === apiKey) {
    return client;
  }

  client = new OpenAI({ apiKey });
  clientApiKey = apiKey;
  return client;
}
