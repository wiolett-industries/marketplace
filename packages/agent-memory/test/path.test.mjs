import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('pathfinding handler (C1)', () => {
  const result = runHarness('path');
  const { a, b, d, e } = result.ids;

  test('shortest favors fewest hops', () => {
    expect(result.shortest.found).toBe(true);
    expect(result.shortest.hops).toBe(1);
    expect(result.shortest.path.map((node) => node.id)).toEqual([a, d]);
    expect(result.shortest.total_weight).toBeCloseTo(0.3, 5);
  });

  test('strongest favors highest weight product even with more hops', () => {
    expect(result.strongest.found).toBe(true);
    expect(result.strongest.hops).toBe(2);
    expect(result.strongest.path.map((node) => node.id)).toEqual([a, b, d]);
    expect(result.strongest.total_weight).toBeCloseTo(0.81, 5);
  });

  test('shortest and strongest diverge', () => {
    expect(result.shortest.path.map((n) => n.id)).not.toEqual(result.strongest.path.map((n) => n.id));
  });

  test('reports no path between disconnected nodes', () => {
    expect(result.noPath.found).toBe(false);
    expect(result.noPath.path).toHaveLength(0);
    expect(result.noPath.to_id).toBe(e);
  });

  test('self path is a single node, zero hops', () => {
    expect(result.selfPath.found).toBe(true);
    expect(result.selfPath.hops).toBe(0);
    expect(result.selfPath.path.map((n) => n.id)).toEqual([a]);
  });

  test('rejects a pointer-lite endpoint', () => {
    expect(result.pointerError).toBe(true);
  });
});
