import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('graph prune tool (E1)', () => {
  const result = runHarness('prune');

  test('dry run reports removals without writing', () => {
    expect(result.before).toBe(4);
    expect(result.dry.dry_run).toBe(true);
    expect(result.dry.removed.dangling).toBe(1);
    expect(result.dry.removed.below_min_weight).toBe(1);
    expect(result.dry.removed.total).toBe(2);
    expect(result.dry.affected_owners).toBe(1);
    // graph unchanged after dry run
    expect(result.afterDry).toBe(4);
  });

  test('real run removes only the unhealthy auto edges', () => {
    expect(result.real.dry_run).toBe(false);
    expect(result.real.removed.total).toBe(2);
    expect(result.afterRealCount).toBe(2);
  });

  test('manual edges are preserved even below the weight floor', () => {
    // both survivors are manual; the 0.05 manual uses_service edge is kept
    expect(result.afterRealSources).toEqual(['manual', 'manual']);
    expect(result.afterRealRelations).toEqual(['related_to', 'uses_service']);
  });
});
