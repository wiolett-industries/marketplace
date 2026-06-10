import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('query graph-expansion (A1)', () => {
  const result = runHarness('query-expand');
  const { a, b } = result.ids;

  test('without expansion, only text-matched memories are candidates', () => {
    expect(result.noExpandCandidateIds).toContain(a);
    expect(result.noExpandCandidateIds).not.toContain(b);
  });

  test('expansion surfaces graph-connected memories the query text missed', () => {
    expect(result.expandCandidateIds).toContain(a);
    expect(result.expandCandidateIds).toContain(b);
  });

  test('expanded candidates carry via provenance; search hits do not', () => {
    const aCandidate = result.expandCandidates.find((candidate) => candidate.id === a);
    const bCandidate = result.expandCandidates.find((candidate) => candidate.id === b);
    expect(aCandidate.via).toBeNull();
    expect(bCandidate.via).toEqual({ seedId: a, relation: 'related_to', weight: 0.9 });
  });
});
