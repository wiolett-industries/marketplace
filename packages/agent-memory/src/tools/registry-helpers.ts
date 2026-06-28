import * as z from 'zod/v4';
import { GRAPH_RELATIONS } from '../graph.js';

export function asTextResult(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload),
      },
    ],
  };
}

export const scopeSchema = z.enum(['project', 'global']).optional();
export const detailSchema = z.enum(['brief', 'normal', 'full']).optional();
export const relationEnum = z.enum(GRAPH_RELATIONS);
export const directionEnum = z.enum(['outgoing', 'incoming', 'both']);
