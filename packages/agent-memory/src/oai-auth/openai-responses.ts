import type { ModelClient, ModelResponse, ModelResponseRequest } from './types.js';
import { extractResponseOutputText } from './response-output.js';
import { DEFAULT_RESPONSE_MODEL, resolveOpenAIProviderConfig, type OpenAIProviderConfigOptions } from './openai-provider-config.js';
import { sanitizeErrorText } from './utils.js';

export type OpenAIResponsesOptions = OpenAIProviderConfigOptions;

export class OpenAIResponsesClient implements ModelClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly userAgent: string;
  private readonly headers: Record<string, string>;
  private readonly apiPath: string;
  private readonly store: boolean;
  private readonly timeoutMs: number;

  constructor(options: OpenAIResponsesOptions = {}) {
    const config = resolveOpenAIProviderConfig({ ...options, role: options.role ?? 'synthesis', textApi: 'responses' });
    this.apiKey = config?.apiKey;
    this.baseUrl = options.baseUrl ?? config?.baseUrl ?? 'https://api.openai.com/v1';
    this.model = options.model ?? options.responseModel ?? config?.model ?? DEFAULT_RESPONSE_MODEL;
    this.userAgent = options.userAgent ?? '@wiolett/agent-memory';
    this.headers = config?.headers ?? {};
    this.apiPath = config?.apiPath ?? '/responses';
    this.store = config?.store ?? false;
    this.timeoutMs = config?.timeoutMs ?? 30_000;
  }

  async createResponse(request: ModelResponseRequest, options: { signal?: AbortSignal } = {}): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error('OpenAI-compatible auth is required for OpenAI API model calls.');
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
        ...request,
        model: request.model ?? this.model,
        store: request.store ?? this.store,
      }),
      signal: options.signal ?? AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`OpenAI Responses request failed: HTTP ${response.status} ${sanitizeErrorText(text)}`);
    }
    return JSON.parse(text) as unknown;
  }

  async createTextResponse(request: ModelResponseRequest, options: { signal?: AbortSignal } = {}): Promise<ModelResponse> {
    const raw = await this.createResponse(request, options);
    return { raw, outputText: extractResponseOutputText(raw) };
  }
}
