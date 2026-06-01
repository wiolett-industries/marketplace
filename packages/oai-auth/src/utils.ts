import type { JsonObject } from './types.js';

export function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function sanitizeErrorText(text: string): string {
  return text.replace(/\s+/gu, ' ').trim().slice(0, 500);
}
