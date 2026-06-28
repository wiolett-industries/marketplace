import { getEdgeSummaries, getEntryById, getIncomingSupersededIds, getNeighborSummaries } from '../db.js';
import { withoutEmbedding } from '../entry.js';
import { canParticipateInGraph } from '../graph.js';
import { getModelClient } from '../model-provider.js';
import type { MemoryScope } from '../scope.js';

export type DetailLevel = 'brief' | 'normal' | 'full';

export interface CompiledMemorySource {
  id: string;
  relation?: string;
  weight?: number;
  role: 'primary' | 'related';
}

export interface CompiledMemoryAnswer {
  answer: string;
  sources: CompiledMemorySource[];
  primary: { id: string; file_name: string };
  raw?: unknown;
}

export async function compileRecall(args: {
  id: string;
  scope?: MemoryScope;
  detail?: DetailLevel;
  max_depth?: number;
  include_sources?: boolean;
}): Promise<CompiledMemoryAnswer | null> {
  const scope = args.scope ?? 'project';
  const entry = getEntryById(args.id, scope);
  const primary = entry?.layer === 'lite' && entry.ref ? getEntryById(entry.ref, scope) : entry;
  if (!primary || !canParticipateInGraph(primary)) return null;

  // NOTE: `max_depth` does NOT traverse multiple graph hops. Recall always
  // compiles a single hop of direct neighbors; `max_depth > 1` only widens how
  // many 1-hop neighbors are included (breadth: 20 -> 40), surfacing more
  // directly-related memories rather than more distant ones. Multi-hop graph
  // traversal lives in handleSubgraph / spreadingActivation, not here.
  const neighborLimit = args.max_depth && args.max_depth > 1 ? 40 : 20;
  const neighbors = getNeighborSummaries({
    id: primary.id,
    direction: 'both',
    minWeight: 0,
    limit: neighborLimit,
    scope,
  });
  const relatedEntries = neighbors
    .map((neighbor) => ({ neighbor, entry: getEntryById(neighbor.id, scope) }))
    .filter((item): item is { neighbor: typeof neighbors[number]; entry: NonNullable<ReturnType<typeof getEntryById>> } => canParticipateInGraph(item.entry ?? null));
  // Batch the superseded check (one query) instead of per-neighbor edge lookups.
  const supersededIds = getIncomingSupersededIds(relatedEntries.map((item) => item.entry.id), scope);
  const related = relatedEntries
    .map((item) => ({ ...item, superseded: supersededIds.has(item.entry.id) }))
    // B1: down-rank superseded memories so fresh context wins the related cap.
    .sort((left, right) => Number(left.superseded) - Number(right.superseded));

  const deterministic = buildDeterministicAnswer(primary, related, args.detail ?? 'normal');
  const model = await getModelClient();
  if (!model) {
    return deterministic;
  }

  try {
    const response = await model.createTextResponse({
      reasoning: { effort: 'low' },
      instructions: 'Compile the supplied memory and related memories into concise context. Return plain markdown, preserve concrete facts, and include no extra commentary.',
      input: JSON.stringify({
        detail: args.detail ?? 'normal',
        primary: withoutEmbedding(primary),
        links: getEdgeSummaries(primary.id, scope),
        related: related.map((item) => ({
          relation: item.neighbor.relation,
          weight: item.neighbor.weight,
          direction: item.neighbor.direction,
          memory: withoutEmbedding(item.entry),
        })),
      }),
    });
    return {
      ...deterministic,
      answer: response.outputText.trim() || deterministic.answer,
    };
  } catch {
    return deterministic;
  }
}

function buildDeterministicAnswer(
  primary: NonNullable<ReturnType<typeof getEntryById>>,
  related: Array<{ neighbor: ReturnType<typeof getNeighborSummaries>[number]; entry: NonNullable<ReturnType<typeof getEntryById>> }>,
  detail: DetailLevel
): CompiledMemoryAnswer {
  const lines = [`# ${primary.file_name}`, '', primary.content];
  const relatedLimit = detail === 'brief' ? 4 : detail === 'full' ? 16 : 8;
  const selected = related.slice(0, relatedLimit);
  if (selected.length) {
    lines.push('', '## Related Context');
    for (const item of selected) {
      const text = compress(item.entry.content, item.neighbor.weight, detail);
      lines.push(`- ${item.neighbor.relation} (${item.neighbor.weight}): ${text} [${item.entry.id}]`);
    }
  }

  return {
    answer: lines.join('\n'),
    primary: { id: primary.id, file_name: primary.file_name },
    sources: [
      { id: primary.id, role: 'primary' },
      ...selected.map((item) => ({
        id: item.entry.id,
        relation: item.neighbor.relation,
        weight: item.neighbor.weight,
        role: 'related' as const,
      })),
    ],
  };
}

function compress(content: string, weight: number, detail: DetailLevel): string {
  if (detail === 'full' || weight >= 0.8) return content;
  const max = weight >= 0.5 || detail === 'normal' ? 220 : 120;
  return content.length > max ? `${content.slice(0, max - 3)}...` : content;
}
