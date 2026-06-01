import { evaluateMemoryWrite } from '../gate/write-gate.js';
import { normalizeTags } from '../entry.js';
import { ensureMemoryReady } from '../runtime.js';
import type { MemoryScope } from '../scope.js';
import { handleWrite } from './write.js';

export async function handleSave(args: {
  content: string;
  tags?: string[];
  summary?: string;
  scope?: MemoryScope;
  layer?: 'lite' | 'deep';
}) {
  const scope = args.scope ?? 'project';
  const tags = normalizeTags(args.tags ?? []);
  const gate = await evaluateMemoryWrite({
    content: args.content.trim(),
    tags,
    scope,
    operation: 'save',
  });

  if (gate.decision === 'reject') {
    return {
      saved: false,
      gate,
    };
  }

  const content = gate.decision === 'rewrite' && gate.normalized_content ? gate.normalized_content : args.content;
  const finalScope = gate.suggested_scope ?? scope;
  ensureMemoryReady(finalScope);
  const result = await handleWrite({
    content,
    tags: gate.suggested_tags ?? tags,
    summary: args.summary,
    layer: args.layer,
    scope: finalScope,
  });

  return {
    saved: true,
    ...result,
    gate,
  };
}
