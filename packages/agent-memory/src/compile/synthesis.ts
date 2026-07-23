import type { EntryRecord } from '../entry.js';
import { withoutEmbedding } from '../entry.js';
import { getModelClient } from '../model-provider.js';
import type { ActivationVia } from '../retrieval/activation.js';

export type SynthesisMode = 'query' | 'recap';
export type SynthesisDetail = 'brief' | 'normal' | 'full';

export interface SynthesisCandidate {
  entry: EntryRecord;
  score: number;
  via: ActivationVia | null;
}

export interface SynthesisSource {
  id: string;
  relation?: string;
  weight?: number;
  role: 'primary' | 'related';
}

export interface SynthesisAnswer {
  answer: string;
  sources: SynthesisSource[];
}

export async function compileSynthesis(args: {
  mode: SynthesisMode;
  candidates: SynthesisCandidate[];
  detail?: SynthesisDetail;
  query?: string;
}): Promise<SynthesisAnswer> {
  const detail = args.detail ?? 'normal';
  const selected = args.candidates.slice(0, detail === 'brief' ? 4 : detail === 'full' ? 16 : 8);
  const deterministic = buildDeterministicAnswer(args.mode, selected, args.query);
  if (!selected.length) return deterministic;

  const model = await getModelClient('synthesis');
  if (!model) return deterministic;

  const taskInstruction = args.mode === 'query'
    ? 'Answer the supplied query directly from all relevant memories, not just the first memory.'
    : 'Produce a useful recap of the durable context that should shape the next task.';

  try {
    const response = await model.createTextResponse({
      reasoning: { effort: 'medium' },
      instructions: [
        taskInstruction,
        'Synthesize across the supplied ranked memories and reconcile overlaps or contradictions.',
        'Prefer newer, more relevant, and non-superseded facts when the supplied evidence conflicts.',
        'Preserve concrete facts, negation, ownership, constraints, and uncertainty exactly.',
        'Do not invent facts or recommendations that are absent from the supplied memories.',
        'Use concise plain markdown with no preamble or process commentary.',
        'Attach the source memory id in square brackets to material claims.',
      ].join(' '),
      input: JSON.stringify({
        mode: args.mode,
        detail,
        ...(args.query ? { query: args.query } : {}),
        memories: selected.map((candidate, index) => ({
          rank: index + 1,
          score: candidate.score,
          via: candidate.via,
          memory: withoutEmbedding(candidate.entry),
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
  mode: SynthesisMode,
  candidates: SynthesisCandidate[],
  query?: string,
): SynthesisAnswer {
  if (!candidates.length) return { answer: '', sources: [] };

  const title = mode === 'query' && query
    ? `# Memory context for: ${query}`
    : '# Memory recap';
  const lines = [title, ''];
  for (const candidate of candidates) {
    lines.push(`- [${candidate.entry.id}] ${candidate.entry.content}`);
  }

  return {
    answer: lines.join('\n'),
    sources: candidates.map((candidate, index) => ({
      id: candidate.entry.id,
      role: index === 0 ? 'primary' : 'related',
      ...(candidate.via ? { relation: candidate.via.relation, weight: candidate.via.weight } : {}),
    })),
  };
}
