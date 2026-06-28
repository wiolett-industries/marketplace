import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('graph health view (E1)', () => {
  const { health } = runHarness('health');

  test('counts node kinds', () => {
    expect(health.nodes.deep).toBe(3);
    expect(health.nodes.pointers).toBe(3); // one pointer per deep write
    expect(health.nodes.lite_standalone).toBe(1);
    expect(health.nodes.graph_capable).toBe(4); // 3 deep + 1 standalone lite
  });

  test('summarizes edges and relation distribution', () => {
    // related_to is symmetric -> two physical directed edges
    expect(health.edges.total).toBe(2);
    expect(health.edges.manual).toBe(2);
    expect(health.edges.auto).toBe(0);
    expect(health.edges.by_relation.related_to).toBe(2);
    expect(health.edges.related_to_share).toBe(1);
  });

  test('detects orphans (graph-capable nodes with no edges)', () => {
    // the orphan deep memory + the standalone lite, neither linked
    expect(health.orphans.count).toBe(2);
  });

  test('weight histogram bucketizes edge weights', () => {
    expect(health.weight_histogram['0.8-1.0']).toBe(2);
  });

  test('reports no dead pointers or dangling edges in a healthy graph', () => {
    expect(health.dead_pointers.count).toBe(0);
    expect(health.dangling_edges.count).toBe(0);
    expect(health.hubs.nodes).toHaveLength(0);
  });
});
