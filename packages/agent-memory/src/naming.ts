import { customAlphabet } from 'nanoid';
import { getOpenAIClient } from './openai.js';

const createId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'in', 'is',
  'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'with', 'we', 'you', 'your',
  'our', 'their', 'they', 'was', 'were', 'will', 'would', 'should', 'can', 'could',
]);

function sanitizeSlug(input: string): string {
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);

  return words.join('_');
}

function fallbackSlug(content: string, tags: string[]): string {
  const candidates = [
    ...tags,
    ...content
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  ];

  const uniqueWords = Array.from(new Set(candidates)).slice(0, 3);
  const slug = sanitizeSlug(uniqueWords.join(' '));
  return slug || 'memory_note';
}

async function aiSlug(content: string, tags: string[]): Promise<string | null> {
  const openai = getOpenAIClient();
  if (!openai) {
    return null;
  }

  const response = await openai.responses.create({
    model: 'gpt-5-nano',
    instructions: [
      'Generate a concise filename slug for an agent memory entry.',
      'Return only 1 to 3 meaningful lowercase words joined by underscores.',
      'Use only letters, digits, and underscores.',
      'Do not return punctuation, explanations, quotes, markdown, or more than 3 words.',
    ].join(' '),
    input: JSON.stringify({
      tags,
      content_preview: content.slice(0, 800),
    }),
  });

  const slug = sanitizeSlug(response.output_text);
  return slug || null;
}

export async function createEntryIdentity(content: string, tags: string[]): Promise<{ id: string; file_name: string }> {
  const id = createId();
  let slug: string | null = null;

  try {
    slug = await aiSlug(content, tags);
  } catch {
    slug = null;
  }

  const finalSlug = slug ?? fallbackSlug(content, tags);
  return {
    id,
    file_name: `${id}_${finalSlug}`,
  };
}

export function createLegacyFileName(id: string, content: string, tags: string[]): string {
  return `${id}_${fallbackSlug(content, tags)}`;
}
