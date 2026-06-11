import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('supersede detection (B1)', () => {
  const result = runHarness('supersede');
  const ts = 1700000000000;

  test('buildSupersedeOutcome creates a supersedes edge for confident supersession', () => {
    expect(result.pure.supersedeEdges).toHaveLength(1);
    expect(result.pure.supersedeEdges[0]).toEqual({
      from_id: 'SRC',
      to_id: 'old1',
      relation: 'supersedes',
      weight: 0.9,
      reason: 'replaced',
      source: 'auto',
      created_at: ts,
      updated_at: ts,
    });
  });

  test('collects duplicates and ignores independent / low-confidence / self', () => {
    expect(result.pure.duplicateOf).toEqual(['dup1']);
    const supersededIds = result.pure.supersedeEdges.map((edge) => edge.to_id);
    expect(supersededIds).not.toContain('low1');
    expect(supersededIds).not.toContain('SRC');
    expect(supersededIds).not.toContain('ind1');
  });

  test('degrades to a no-op without a model', () => {
    expect(result.first.id).toBeDefined();
    expect(result.second.id).toBeDefined();
    expect(result.second.supersedes).toBeUndefined();
    expect(result.second.duplicate_of).toBeUndefined();
  });
});
