export type JsonObject = Record<string, unknown>;

export type ModelContentBlock =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail?: 'auto' | 'low' | 'high' }
  | JsonObject;

export type ModelInputItem = {
  role: 'user' | 'system' | 'developer' | 'assistant';
  content: string | ModelContentBlock[];
};

export type ModelResponseRequest = {
  model?: string;
  input: string | ModelInputItem[] | JsonObject[];
  instructions?: string;
  reasoning?: JsonObject;
  text?: JsonObject;
  tools?: JsonObject[];
  tool_choice?: string | JsonObject;
  stream?: boolean;
  store?: boolean;
  metadata?: JsonObject;
  [key: string]: unknown;
};

export type ModelResponse = {
  raw: unknown;
  outputText: string;
};

export type EmbeddingClient = {
  createEmbedding(input: string, options?: { signal?: AbortSignal }): Promise<number[]>;
};

export type ModelClient = {
  createResponse(request: ModelResponseRequest, options?: { signal?: AbortSignal }): Promise<unknown>;
  createTextResponse(request: ModelResponseRequest, options?: { signal?: AbortSignal }): Promise<ModelResponse>;
};
