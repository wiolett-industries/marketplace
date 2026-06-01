import { compileRecall } from '../compile/recall.js';
import type { MemoryScope } from '../scope.js';

export async function handleRecall(args: {
  memory_id: string;
  scope?: MemoryScope;
  detail?: 'brief' | 'normal' | 'full';
  max_depth?: number;
  include_sources?: boolean;
}) {
  return compileRecall({
    id: args.memory_id,
    scope: args.scope,
    detail: args.detail,
    max_depth: args.max_depth,
    include_sources: args.include_sources,
  });
}
