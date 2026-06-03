import * as z from 'zod/v4';
import { getModelClient } from '../model-provider.js';
import type { MemoryScope } from '../scope.js';

const gateSchema = z.object({
  decision: z.enum(['allow', 'rewrite', 'reject']),
  reason: z.string(),
  normalized_content: z.string().optional(),
  suggested_scope: z.enum(['project', 'global']).optional(),
  suggested_tags: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  importance: z.number().min(0).max(1),
});

export type MemoryGateResult = z.infer<typeof gateSchema>;

const rawGateSchema = z.object({
  decision: z.enum(['allow', 'rewrite', 'reject']),
  reason: z.string(),
  normalized_content: z.string().nullable(),
  suggested_scope: z.enum(['project', 'global']).nullable(),
  suggested_tags: z.array(z.string()).nullable(),
  confidence: z.number().min(0).max(1),
  importance: z.number().min(0).max(1),
});

export async function evaluateMemoryWrite(args: {
  content: string;
  tags: string[];
  scope: MemoryScope;
  operation: 'save' | 'update';
}): Promise<MemoryGateResult> {
  const model = await getModelClient();
  if (!model) {
    if (args.scope === 'global') {
      return {
        decision: 'reject',
        reason: 'Global memory writes require model-backed sanity review.',
        confidence: 0,
        importance: 0,
      };
    }

    return allow('Model unavailable; accepted project memory with deterministic fallback.', args.content, args.tags, 0.5, 0.5);
  }

  const prompt = [
    'You are a strict memory write gate for an MCP memory server.',
    'Return JSON only.',
    'Reject secrets, credentials, raw tokens, raw transcripts, ephemeral task chatter, and model self-notes.',
    'Allow distilled durable lessons from completed work, including root causes, fix patterns, verification sequences, workflow gotchas, and stable preferences.',
    'Global memory must only contain durable cross-project user preferences, stable workflows, or durable user-level facts.',
    'Project memory may contain durable repository facts, workflows, setup steps, decisions, and operational gotchas.',
    'If useful but poorly worded, choose rewrite and provide normalized_content.',
  ].join(' ');

  const input = JSON.stringify({
    operation: args.operation,
    scope: args.scope,
    tags: args.tags,
    content: args.content,
  });

  try {
    const response = await model.createTextResponse({
      instructions: prompt,
      input,
      reasoning: { effort: 'low' },
      text: {
        format: {
          type: 'json_schema',
          name: 'memory_gate_result',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: [
              'decision',
              'reason',
              'normalized_content',
              'suggested_scope',
              'suggested_tags',
              'confidence',
              'importance',
            ],
            properties: {
              decision: { type: 'string', enum: ['allow', 'rewrite', 'reject'] },
              reason: { type: 'string' },
              normalized_content: { type: ['string', 'null'] },
              suggested_scope: { type: ['string', 'null'], enum: ['project', 'global', null] },
              suggested_tags: {
                anyOf: [
                  { type: 'array', items: { type: 'string' } },
                  { type: 'null' },
                ],
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              importance: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
        },
      },
    });
    return normalizeGateResult(rawGateSchema.parse(JSON.parse(response.outputText)));
  } catch {
    return args.scope === 'global'
      ? { decision: 'reject', reason: 'Global memory gate failed to produce valid review JSON.', confidence: 0, importance: 0 }
      : allow('Gate failed; accepted project memory with deterministic fallback.', args.content, args.tags, 0.45, 0.45);
  }
}

function normalizeGateResult(raw: z.infer<typeof rawGateSchema>): MemoryGateResult {
  return gateSchema.parse({
    decision: raw.decision,
    reason: raw.reason,
    ...(raw.normalized_content ? { normalized_content: raw.normalized_content } : {}),
    ...(raw.suggested_scope ? { suggested_scope: raw.suggested_scope } : {}),
    ...(raw.suggested_tags ? { suggested_tags: raw.suggested_tags } : {}),
    confidence: raw.confidence,
    importance: raw.importance,
  });
}

function allow(reason: string, content: string, tags: string[], confidence: number, importance: number): MemoryGateResult {
  return {
    decision: 'allow',
    reason,
    normalized_content: content,
    suggested_tags: tags,
    confidence,
    importance,
  };
}
