import type { JsonObject } from './types.js';
import { isJsonObject } from './utils.js';

export function extractResponseOutputText(response: unknown): string {
  if (isJsonObject(response) && typeof response.output_text === 'string') return response.output_text;
  if (!isJsonObject(response) || !Array.isArray(response.output)) {
    throw new Error('Response missing output text');
  }

  const parts: string[] = [];
  for (const item of response.output) {
    if (!isJsonObject(item)) continue;
    if (typeof item.text === 'string') parts.push(item.text);
    if (!Array.isArray(item.content)) continue;
    for (const block of item.content) {
      if (isTextBlock(block)) parts.push(block.text);
    }
  }

  const text = parts.join('\n').trim();
  if (!text) throw new Error('Response contained no output text');
  return text;
}

function isTextBlock(value: unknown): value is JsonObject & { text: string } {
  return isJsonObject(value) && (value.type === 'output_text' || value.type === 'text') && typeof value.text === 'string';
}
