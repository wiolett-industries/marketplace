import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('spreadingActivation engine (A2)', () => {
  const result = runHarness('activation');
  const { a, b, c, d } = result.ids;

  test('propagates activation outward with per-hop decay', () => {
    expect(result.both[b].score).toBeCloseTo(0.45, 5);
    expect(result.both[c].score).toBeCloseTo(0.18, 5);
    // b (1 hop) is stronger than c (2 hops)
    expect(result.both[b].score).toBeGreaterThan(result.both[c].score);
  });

  test('populates via with seed origin, relation, and edge weight', () => {
    expect(result.both[b].via).toEqual({ seedId: a, relation: 'related_to', weight: 0.9 });
    expect(result.both[c].via).toEqual({ seedId: a, relation: 'depends_on', weight: 0.8 });
    // seed node keeps via = null
    expect(result.both[a].via).toBeNull();
  });

  test('respects the hop budget', () => {
    // hops: 2 reaches c (2 hops) but not d (3 hops)
    expect(result.both[c]).toBeDefined();
    expect(result.both[d]).toBeUndefined();
    // hops: 1 reaches b only
    expect(result.hop1[b]).toBeDefined();
    expect(result.hop1[c]).toBeUndefined();
  });

  test('symmetric edges do not double-count', () => {
    // related_to is stored as two physical directed edges (a->b and b->a);
    // activation of b must be a single 0.45 contribution, not 0.9.
    expect(result.both[b].score).toBeCloseTo(0.45, 5);
  });

  test('maxNodes caps traversal breadth', () => {
    // maxNodes: 1 keeps only the seed in the expanding frontier, so c is never reached
    expect(result.capped[c]).toBeUndefined();
  });

  test('minWeight filters weak edges out of traversal', () => {
    // minWeight 0.85 admits only a->b (0.9); b->c (0.8) is excluded, so c is unreached
    expect(result.minWeightFilter[b]).toBeDefined();
    expect(result.minWeightFilter[c]).toBeUndefined();
  });

  test('no seeds yields an empty map', () => {
    expect(Object.keys(result.noSeeds)).toHaveLength(0);
  });
});
