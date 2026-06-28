import { deleteIncomingAutoEdges, getDeepEntries, getEntryById, getLiteEntries, getOutgoingEdgeRecords, replaceAutoOutgoingEdges } from './db.js';
import { type EntryRecord } from './entry.js';
import { deleteGraphFile, writeGraphFile } from './files.js';
import { canParticipateInGraph, GRAPH_RELATIONS, type GraphEdgeRecord, type GraphRelation, normalizeWeight } from './graph.js';
import { getModelClient } from './model-provider.js';
import type { MemoryScope } from './scope.js';
import { cosineSimilarity } from './utils/cosine.js';

interface CandidateScore {
  entry: EntryRecord;
  score: number;
  cosine: number;
  relation: GraphRelation;
  reason: string;
}

export interface SupersedeVerdict {
  id: string;
  verdict: 'supersedes' | 'duplicate' | 'independent';
  confidence: number;
  reason?: string;
}

// Raw cosine gate to even consider a high-similarity candidate for supersession.
const SUPERSEDE_COSINE_THRESHOLD = 0.82;
// Minimum model confidence before acting on a supersede/duplicate verdict.
const SUPERSEDE_CONFIDENCE = 0.7;

interface ModelLinkDecision {
  id: string;
  relation: GraphRelation;
  weight: number;
  reason: string;
}

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'with',
]);

const BROAD_TAGS = new Set([
  'agent',
  'agents',
  'codex',
  'config',
  'dev',
  'development',
  'general',
  'memory',
  'misc',
  'notes',
  'preferences',
  'project',
  'repo',
  'setup',
  'workflow',
]);

export async function refreshAutoLinks(
  entry: EntryRecord,
  scope: MemoryScope = 'project',
  options: { pruneIncoming?: boolean } = {}
): Promise<{ linked: number; candidates: number; pruned_incoming: number; supersedes: string[]; duplicate_of: string[] }> {
  if (!canParticipateInGraph(entry)) {
    return { linked: 0, candidates: 0, pruned_incoming: 0, supersedes: [], duplicate_of: [] };
  }

  const prunedIncomingFromIds = options.pruneIncoming ? deleteIncomingAutoEdges(entry.id, scope) : [];
  syncGraphFilesForIds(prunedIncomingFromIds, scope);

  const candidates = getGraphCandidates(scope).filter((candidate) => candidate.id !== entry.id);
  const scored = candidates
    .map((candidate) => scoreCandidate(entry, candidate))
    .filter((candidate) => candidate.score >= threshold(scope))
    .sort((left, right) => right.score - left.score || left.entry.file_name.localeCompare(right.entry.file_name))
    .slice(0, 12);

  const modelDecisions = await refineWithModel(entry, scored, scope);
  const timestamp = Date.now();

  // B1: detect supersession/duplication on the highest-similarity candidates and
  // fold the resulting `supersedes` edges into the auto set, so they survive the
  // replaceAutoOutgoingEdges replace (a post-write edge would be clobbered).
  const highSimilarity = scored.filter((candidate) => candidate.cosine >= SUPERSEDE_COSINE_THRESHOLD);
  const { supersedeEdges, duplicateOf } = await detectSupersession(entry, highSimilarity, timestamp);
  const supersededIds = new Set(supersedeEdges.map((edge) => edge.to_id));
  const duplicateIds = new Set(duplicateOf);

  const linkEdges = (modelDecisions.length ? modelDecisions : scored.slice(0, scope === 'global' ? 3 : 5).map(toDeterministicDecision))
    .filter((decision) => decision.id !== entry.id)
    .filter((decision) => decision.relation !== 'supersedes') // supersession owns this relation
    .filter((decision) => !supersededIds.has(decision.id) && !duplicateIds.has(decision.id))
    .filter((decision) => GRAPH_RELATIONS.includes(decision.relation))
    .filter((decision) => decision.weight >= threshold(scope))
    .slice(0, scope === 'global' ? 3 : 5)
    .map((decision): GraphEdgeRecord => ({
      from_id: entry.id,
      to_id: decision.id,
      relation: decision.relation,
      weight: normalizeWeight(decision.weight),
      reason: decision.reason || 'Automatically linked from memory similarity.',
      source: 'auto',
      created_at: timestamp,
      updated_at: timestamp,
    }));

  const edges = dedupeEdges([...linkEdges, ...supersedeEdges]);

  replaceAutoOutgoingEdges(entry.id, edges, scope);
  const outgoing = getOutgoingEdgeRecords(entry.id, scope);
  if (outgoing.length) {
    writeGraphFile(entry.file_name, outgoing, scope);
  } else {
    deleteGraphFile(entry.file_name, scope);
  }

  return {
    linked: edges.length,
    candidates: scored.length,
    pruned_incoming: prunedIncomingFromIds.length,
    supersedes: [...supersededIds],
    duplicate_of: duplicateOf,
  };
}

function getGraphCandidates(scope: MemoryScope): EntryRecord[] {
  return [
    ...getDeepEntries(scope),
    ...getLiteEntries(scope).filter((entry) => entry.ref === null),
  ].filter(canParticipateInGraph);
}

function scoreCandidate(source: EntryRecord, candidate: EntryRecord): CandidateScore {
  const sourceTokens = tokenize(`${source.content} ${source.tags.join(' ')}`);
  const candidateTokens = tokenize(`${candidate.content} ${candidate.tags.join(' ')}`);
  const tokenOverlap = jaccard(sourceTokens, candidateTokens);
  const tagOverlap = jaccard(toSpecificTags(source.tags), toSpecificTags(candidate.tags));
  const semantic = source.embedding.length > 0 && source.embedding.length === candidate.embedding.length
    ? Math.max(0, cosineSimilarity(source.embedding, candidate.embedding))
    : 0;
  const baseScore = (semantic * 0.6) + (tagOverlap * 0.35) + (tokenOverlap * 0.3);
  const score = normalizeWeight(Math.min(1, baseScore));
  return {
    entry: candidate,
    score,
    cosine: semantic,
    ...inferRelation(source, candidate, tagOverlap, tokenOverlap),
  };
}

function inferRelation(source: EntryRecord, candidate: EntryRecord, tagOverlap: number, tokenOverlap: number): Pick<CandidateScore, 'relation' | 'reason'> {
  const sourceText = `${source.content} ${source.tags.join(' ')}`.toLowerCase();
  const candidateText = `${candidate.content} ${candidate.tags.join(' ')}`.toLowerCase();

  if (/\b(workflow|process|flow|procedure|runbook)\b/u.test(sourceText) && /\b(config|provider|service|bucket|api|endpoint)\b/u.test(candidateText)) {
    return {
      relation: 'uses_service',
      reason: 'The memory appears to describe a workflow that uses the related service or configuration.',
    };
  }

  if (/\b(summary|report|release|plan|audit)\b/u.test(sourceText) && /\b(summary|report|release|plan|audit)\b/u.test(candidateText)) {
    return {
      relation: 'same_workflow',
      reason: 'The memories appear to belong to the same workflow or operating process.',
    };
  }

  if (tagOverlap >= 0.25 || tokenOverlap >= 0.25) {
    return {
      relation: 'same_area',
      reason: 'The memories share tags or vocabulary from the same area.',
    };
  }

  return {
    relation: 'related_to',
    reason: 'The memories are similar enough to be useful related context.',
  };
}

async function refineWithModel(source: EntryRecord, candidates: CandidateScore[], scope: MemoryScope): Promise<ModelLinkDecision[]> {
  if (!candidates.length) {
    return [];
  }

  const model = await getModelClient();
  if (!model) {
    return [];
  }

  try {
    const response = await model.createTextResponse({
      reasoning: { effort: 'low' },
      instructions: [
        'You decide whether memory graph links should be created.',
        'Return strict JSON only: {"links":[{"id":"...","relation":"related_to|same_workflow|same_area|depends_on|supersedes|part_of|derived_from|uses_service","weight":0.0-1.0,"reason":"short reason"}]}.',
        'Create only durable, useful links. Prefer no link over weak related_to noise.',
        scope === 'global' ? 'Global memory links must be especially durable and cross-project useful.' : 'Project memory links may connect project-specific workflows, repo facts, and conventions.',
      ].join('\n'),
      input: JSON.stringify({
        source: summarizeEntry(source),
        candidates: candidates.map((candidate) => ({
          ...summarizeEntry(candidate.entry),
          deterministic_score: candidate.score,
          suggested_relation: candidate.relation,
        })),
      }),
    });
    const parsed = JSON.parse(response.outputText.trim()) as { links?: unknown };
    if (!Array.isArray(parsed.links)) {
      return [];
    }
    const allowedIds = new Set(candidates.map((candidate) => candidate.entry.id));
    return parsed.links
      .map(parseModelDecision)
      .filter((decision): decision is ModelLinkDecision => Boolean(decision && allowedIds.has(decision.id)))
      .filter((decision) => decision.weight >= threshold(scope))
      .slice(0, scope === 'global' ? 3 : 5);
  } catch {
    return [];
  }
}

function parseModelDecision(value: unknown): ModelLinkDecision | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string') return null;
  if (typeof record.relation !== 'string' || !GRAPH_RELATIONS.includes(record.relation as GraphRelation)) return null;
  if (typeof record.weight !== 'number' || !Number.isFinite(record.weight)) return null;
  return {
    id: record.id,
    relation: record.relation as GraphRelation,
    weight: normalizeWeight(Math.max(0, Math.min(1, record.weight))),
    reason: typeof record.reason === 'string' ? record.reason.slice(0, 240) : 'Automatically linked by memory graph review.',
  };
}

function toDeterministicDecision(candidate: CandidateScore): ModelLinkDecision {
  return {
    id: candidate.entry.id,
    relation: candidate.relation,
    weight: candidate.score,
    reason: candidate.reason,
  };
}

/**
 * Turn model supersession verdicts into outgoing `supersedes` edges (new -> old)
 * and a list of near-duplicate ids. Pure: only confident, non-self verdicts act.
 */
export function buildSupersedeOutcome(
  sourceId: string,
  verdicts: SupersedeVerdict[],
  timestamp: number
): { supersedeEdges: GraphEdgeRecord[]; duplicateOf: string[] } {
  const supersedeEdges: GraphEdgeRecord[] = [];
  const duplicateOf: string[] = [];
  const seen = new Set<string>();

  for (const verdict of verdicts) {
    if (!verdict || verdict.id === sourceId || seen.has(verdict.id)) continue;
    if (!Number.isFinite(verdict.confidence) || verdict.confidence < SUPERSEDE_CONFIDENCE) continue;

    if (verdict.verdict === 'supersedes') {
      seen.add(verdict.id);
      supersedeEdges.push({
        from_id: sourceId,
        to_id: verdict.id,
        relation: 'supersedes',
        weight: normalizeWeight(Math.max(0, Math.min(1, verdict.confidence))),
        reason: (verdict.reason || 'New memory supersedes the prior one.').slice(0, 240),
        source: 'auto',
        created_at: timestamp,
        updated_at: timestamp,
      });
    } else if (verdict.verdict === 'duplicate') {
      seen.add(verdict.id);
      duplicateOf.push(verdict.id);
    }
  }

  return { supersedeEdges, duplicateOf };
}

function parseVerdict(value: unknown): SupersedeVerdict | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string') return null;
  const verdict = record.verdict;
  if (verdict !== 'supersedes' && verdict !== 'duplicate' && verdict !== 'independent') return null;
  const confidence = typeof record.confidence === 'number' && Number.isFinite(record.confidence) ? record.confidence : 0;
  return {
    id: record.id,
    verdict,
    confidence,
    reason: typeof record.reason === 'string' ? record.reason : undefined,
  };
}

/**
 * Ask the model whether the new memory supersedes, duplicates, or is independent
 * of each high-similarity existing memory. No model -> empty outcome (safe no-op).
 */
async function detectSupersession(
  source: EntryRecord,
  highSimilarity: CandidateScore[],
  timestamp: number
): Promise<{ supersedeEdges: GraphEdgeRecord[]; duplicateOf: string[] }> {
  if (!highSimilarity.length) return { supersedeEdges: [], duplicateOf: [] };

  const model = await getModelClient();
  if (!model) return { supersedeEdges: [], duplicateOf: [] };

  try {
    const response = await model.createTextResponse({
      reasoning: { effort: 'low' },
      instructions: [
        'You compare a NEW memory against existing memories that are highly similar to it.',
        'For each existing memory decide if the new memory: "supersedes" it (replaces/contradicts/obsoletes it), is a "duplicate" (restates the same durable fact), or is "independent".',
        'Return strict JSON only: {"decisions":[{"id":"...","verdict":"supersedes|duplicate|independent","confidence":0.0-1.0,"reason":"short reason"}]}.',
        'Only mark supersedes when the new memory genuinely replaces or contradicts the old one. Prefer "independent" when unsure.',
      ].join('\n'),
      input: JSON.stringify({
        new_memory: summarizeEntry(source),
        existing: highSimilarity.map((candidate) => ({ ...summarizeEntry(candidate.entry), cosine: candidate.cosine })),
      }),
    });
    const parsed = JSON.parse(response.outputText.trim()) as { decisions?: unknown };
    const allowedIds = new Set(highSimilarity.map((candidate) => candidate.entry.id));
    const verdicts = Array.isArray(parsed.decisions)
      ? parsed.decisions
          .map(parseVerdict)
          .filter((verdict): verdict is SupersedeVerdict => Boolean(verdict && allowedIds.has(verdict.id)))
      : [];
    return buildSupersedeOutcome(source.id, verdicts, timestamp);
  } catch {
    return { supersedeEdges: [], duplicateOf: [] };
  }
}

function dedupeEdges(edges: GraphEdgeRecord[]): GraphEdgeRecord[] {
  const seen = new Set<string>();
  const out: GraphEdgeRecord[] = [];
  for (const edge of edges) {
    const key = `${edge.to_id}:${edge.relation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edge);
  }
  return out;
}

function summarizeEntry(entry: EntryRecord) {
  return {
    id: entry.id,
    layer: entry.layer,
    file_name: entry.file_name,
    tags: entry.tags,
    content: entry.content.length > 900 ? `${entry.content.slice(0, 897)}...` : entry.content,
  };
}

function threshold(scope: MemoryScope): number {
  return scope === 'global' ? 0.24 : 0.1;
}

function syncGraphFilesForIds(ids: string[], scope: MemoryScope): void {
  for (const id of ids) {
    const entry = getEntryById(id, scope);
    if (!entry || !canParticipateInGraph(entry)) {
      continue;
    }
    const outgoing = getOutgoingEdgeRecords(id, scope);
    if (outgoing.length) {
      writeGraphFile(entry.file_name, outgoing, scope);
    } else {
      deleteGraphFile(entry.file_name, scope);
    }
  }
}

function toSpecificTags(tags: string[]): Set<string> {
  return new Set(tags.filter((tag) => !BROAD_TAGS.has(tag)));
}

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .split(/[^a-z0-9а-яё]+/iu)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !STOPWORDS.has(token))
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = Array.from(left).filter((value) => right.has(value)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}
