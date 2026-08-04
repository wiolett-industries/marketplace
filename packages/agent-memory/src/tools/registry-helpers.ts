import path from 'node:path';
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
export const workspaceRootSchema = z
  .string()
  .min(1)
  .refine((value) => path.isAbsolute(value), { message: 'workspace_root must be an absolute path' })
  .optional()
  .describe('Absolute target project root for project-scoped memory. Use it for the current or another project when its memory is requested explicitly; reads remain isolated to that root and never initialize it. Relative paths are rejected.');
export const detailSchema = z.enum(['brief', 'normal', 'full']).optional();
export const relationEnum = z.enum(GRAPH_RELATIONS);
export const directionEnum = z.enum(['outgoing', 'incoming', 'both']);

// MCP annotations are client-facing hints. Keep them conservative and tied to
// the actual side effects rather than the tool name or a common happy path.
export const localReadOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const localMutationAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export const localDestructiveAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const;
