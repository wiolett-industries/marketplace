import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('safe graph maintenance', () => {
  const result = runHarness('maintenance');

  test('reports structural work without changing state in dry-run mode', () => {
    expect(result.before.dead_pointers.count).toBe(2);
    expect(result.before.dangling_edges.count).toBe(0);
    expect(result.dry.dead_pointers.would_delete).toBe(2);
    expect(result.dry.deterministic_graph_repair.orphan_graph_files).toBe(1);
    expect(result.dry.deterministic_graph_repair.invalid_edges.dangling_target).toBe(2);
    expect(result.dry.deterministic_graph_repair.invalid_edges.manual).toBe(3);
    expect(result.afterDry).toEqual(result.before);
  });

  test('removes broken pointers and graph artifacts, then rebuilds automatic links', () => {
    expect(result.repaired.dead_pointers.deleted).toBe(2);
    expect(result.repaired.deterministic_graph_repair.orphan_graph_files).toBe(1);
    expect(result.repaired.deterministic_graph_repair.invalid_edges.total).toBe(4);
    expect(result.repaired.deterministic_graph_repair.invalid_edges.manual).toBe(3);
    expect(result.repaired.auto_graph.rebuilt_for).toBe(2);
    expect(result.after.dead_pointers.count).toBe(0);
    expect(result.after.dangling_edges.count).toBe(0);
  });

  test('preserves a manual relation that matches an inferred link and is byte-idempotent on repeat', () => {
    expect(result.coldStartManual).toEqual(expect.objectContaining({
      source: 'manual',
      weight: 0.97,
      reason: 'Newest manual revision',
    }));
    expect(result.preservedManual).toEqual(expect.objectContaining({
      to_id: result.ids.target,
      relation: 'same_area',
      source: 'manual',
      weight: 0.97,
      reason: 'Newest manual revision',
    }));
    expect(result.repaired.deterministic_graph_repair.invalid_edges.duplicate_tuple).toBe(2);
    expect(result.graphAfterSecondMaintenance).toEqual(result.graphAfterFirstMaintenance);
    expect(result.repeated.auto_graph.automatic_links).toBeGreaterThanOrEqual(0);
  });
});
