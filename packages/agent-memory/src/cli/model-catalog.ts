import type { ProviderDefinition } from '../config.js';

export interface CatalogModel {
  id: string;
  reasoningEfforts: string[];
}

export async function fetchProviderModels(input: {
  provider: ProviderDefinition;
  fetch?: typeof globalThis.fetch;
}): Promise<CatalogModel[]> {
  const url = `${input.provider.base_url.replace(/\/+$/u, '')}/models`;
  const apiKey = input.provider.auth?.api_key?.trim();
  if (!apiKey) throw new Error('This provider has no API key, so its model catalog cannot be loaded.');

  let response: Response;
  try {
    response = await (input.fetch ?? globalThis.fetch)(url, {
      headers: {
        Accept: 'application/json',
        ...(input.provider.headers ?? {}),
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': '@wiolett/agent-memory',
      },
      signal: AbortSignal.timeout(input.provider.timeout_ms ?? 30_000),
    });
  } catch {
    throw new Error('Could not load the provider model catalog. Check its URL, network access, and credentials.');
  }
  if (!response.ok) throw new Error(`Provider model catalog request failed: HTTP ${response.status}.`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Provider model catalog returned invalid JSON.');
  }
  const models = parseCatalog(payload);
  if (!models.length) throw new Error('Provider has no API models available to this credential.');
  return models;
}

export function parseCatalog(payload: unknown): CatalogModel[] {
  if (!isRecord(payload)) throw new Error('Provider model catalog has an unsupported format.');
  const records = Array.isArray(payload.models) ? payload.models : Array.isArray(payload.data) ? payload.data : null;
  if (!records) throw new Error('Provider model catalog must contain a models or data array.');

  const models = records.flatMap((record) => {
    if (!isRecord(record)) return [];
    if (record.visibility === 'hidden' || record.supported_in_api === false) return [];
    const id = readString(record.slug) ?? readString(record.id);
    if (!id) return [];
    return [{ id, reasoningEfforts: readReasoningEfforts(record.supported_reasoning_levels) }];
  });
  return [...new Map(models.map((model) => [model.id, model])).values()]
    .sort((left, right) => left.id.localeCompare(right.id));
}

function readReasoningEfforts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
