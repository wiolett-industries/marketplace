import type { EmbeddingClient } from './types.js';
import { DEFAULT_EMBEDDING_MODEL, resolveOpenAIProviderConfig, type OpenAIProviderConfigOptions } from './openai-provider-config.js';
import { isJsonObject, sanitizeErrorText } from './utils.js';

export type OpenAIEmbeddingsOptions = OpenAIProviderConfigOptions;

export class OpenAIEmbeddingsClient implements EmbeddingClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly userAgent: string;
  private readonly headers: Record<string, string>;
  private readonly apiPath: string;
  private readonly timeoutMs: number;

  constructor(options: OpenAIEmbeddingsOptions = {}) {
    const config = resolveOpenAIProviderConfig({ ...options, role: 'embeddings' });
    this.apiKey = config?.apiKey;
    this.baseUrl = options.baseUrl ?? config?.baseUrl ?? 'https://api.openai.com/v1';
    this.model = options.embeddingModel ?? config?.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;
    this.userAgent = options.userAgent ?? '@wiolett/agent-memory';
    this.headers = config?.headers ?? {};
    this.apiPath = config?.apiPath ?? '/embeddings';
    this.timeoutMs = config?.timeoutMs ?? 30_000;
  }

  async createEmbedding(input: string, options: { signal?: AbortSignal } = {}): Promise<number[]> {
    if (!this.apiKey) {
      return [];
    }

    const response = await fetch(`${this.baseUrl.replace(/\/+$/u, '')}/${this.apiPath.replace(/^\/+/, '')}`, {
      method: 'POST',
      headers: {
        ...this.headers,
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent,
      },
      body: JSON.stringify({
        model: this.model,
        input,
      }),
      signal: options.signal ?? AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`OpenAI Embeddings request failed: HTTP ${response.status} ${sanitizeErrorText(text)}`);
    }

    const body = JSON.parse(text) as unknown;
    if (!isJsonObject(body) || !Array.isArray(body.data)) return [];
    const first = body.data[0];
    if (!isJsonObject(first) || !Array.isArray(first.embedding)) return [];
    return first.embedding.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  }
}
