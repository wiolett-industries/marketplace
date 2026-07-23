import type { JsonObject, ModelInputItem, ModelResponse, ModelResponseRequest, ModelClient } from './types.js';
import { DEFAULT_RESPONSE_MODEL, resolveOpenAIProviderConfig, type OpenAIProviderConfigOptions } from './openai-provider-config.js';
import { isJsonObject, sanitizeErrorText } from './utils.js';

export type OpenAIChatCompletionsOptions = OpenAIProviderConfigOptions;

export class OpenAIChatCompletionsClient implements ModelClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly userAgent: string;
  private readonly headers: Record<string, string>;
  private readonly apiPath: string;
  private readonly timeoutMs: number;

  constructor(options: OpenAIChatCompletionsOptions = {}) {
    const config = resolveOpenAIProviderConfig({ ...options, role: options.role ?? 'synthesis', textApi: 'chat_completions' });
    this.apiKey = config?.apiKey;
    this.baseUrl = options.baseUrl ?? config?.baseUrl ?? 'https://api.openai.com/v1';
    this.model = options.model ?? options.responseModel ?? config?.model ?? DEFAULT_RESPONSE_MODEL;
    this.userAgent = options.userAgent ?? '@wiolett/agent-memory';
    this.headers = config?.headers ?? {};
    this.apiPath = config?.apiPath ?? '/chat/completions';
    this.timeoutMs = config?.timeoutMs ?? 30_000;
  }

  async createResponse(request: ModelResponseRequest, options: { signal?: AbortSignal } = {}): Promise<unknown> {
    if (!this.apiKey) throw new Error('OpenAI-compatible auth is required for OpenAI API model calls.');
    const response = await fetch(`${this.baseUrl.replace(/\/+$/u, '')}/${this.apiPath.replace(/^\/+/, '')}`, {
      method: 'POST',
      headers: {
        ...this.headers,
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent,
      },
      body: JSON.stringify(toChatRequest(request, this.model)),
      signal: options.signal ?? AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`OpenAI Chat Completions request failed: HTTP ${response.status} ${sanitizeErrorText(text)}`);
    }
    return JSON.parse(text) as unknown;
  }

  async createTextResponse(request: ModelResponseRequest, options: { signal?: AbortSignal } = {}): Promise<ModelResponse> {
    const raw = await this.createResponse(request, options);
    return { raw, outputText: extractChatOutputText(raw) };
  }
}

function toChatRequest(request: ModelResponseRequest, defaultModel: string): JsonObject {
  const messages: ModelInputItem[] = [];
  if (request.instructions) messages.push({ role: 'developer', content: request.instructions });
  if (typeof request.input === 'string') {
    messages.push({ role: 'user', content: request.input });
  } else {
    for (const item of request.input) {
      if (isModelInputItem(item)) messages.push(item);
      else messages.push({ role: 'user', content: JSON.stringify(item) });
    }
  }

  const body: JsonObject = { model: request.model ?? defaultModel, messages };
  const reasoningEffort = isJsonObject(request.reasoning) && typeof request.reasoning.effort === 'string'
    ? request.reasoning.effort
    : undefined;
  if (reasoningEffort) body.reasoning_effort = reasoningEffort;
  const format = isJsonObject(request.text) && isJsonObject(request.text.format) ? request.text.format : null;
  if (format?.type === 'json_schema') {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: format.name,
        strict: format.strict,
        schema: format.schema,
      },
    };
  } else if (format?.type === 'json_object') {
    body.response_format = { type: 'json_object' };
  }
  if (request.store !== undefined) body.store = request.store;
  return body;
}

function extractChatOutputText(value: unknown): string {
  if (!isJsonObject(value) || !Array.isArray(value.choices)) return '';
  const first = value.choices[0];
  if (!isJsonObject(first) || !isJsonObject(first.message)) return '';
  const content = first.message.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => isJsonObject(part) && typeof part.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('\n');
}

function isModelInputItem(value: unknown): value is ModelInputItem {
  return isJsonObject(value)
    && ['user', 'system', 'developer', 'assistant'].includes(String(value.role))
    && (typeof value.content === 'string' || Array.isArray(value.content));
}
