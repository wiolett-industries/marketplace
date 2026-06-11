import { describe, expect, test } from '@jest/globals';
import { pca2d } from '../dist/view/pca.js';

// pca.js is pure (no node:sqlite), so it imports directly into jest.

describe('pca2d (dual Gram PCA)', () => {
  test('separates two clusters along the dominant axis', () => {
    const vectors = [
      [0, 0, 0],
      [0.1, -0.1, 0.05],
      [10, 10, 10],
      [10.1, 9.9, 10.05],
    ];
    const result = pca2d(vectors);
    expect(result.ok).toBe(true);
    // Cluster A (first two) should land far from cluster B (last two) on PC1.
    const xs = result.coords.map((c) => c[0]);
    const clusterA = (xs[0] + xs[1]) / 2;
    const clusterB = (xs[2] + xs[3]) / 2;
    expect(Math.abs(clusterA - clusterB)).toBeGreaterThan(1);
  });

  test('PC1 captures the majority of variance for a 1D-dominant spread', () => {
    const vectors = [
      [-5, 0],
      [-1, 0],
      [1, 0],
      [5, 0],
    ];
    const result = pca2d(vectors);
    expect(result.ok).toBe(true);
    expect(result.variance[0]).toBeGreaterThan(0.95);
    expect(result.variance[1]).toBeLessThan(0.05);
  });

  test('returns degenerate result for fewer than two vectors', () => {
    expect(pca2d([]).ok).toBe(false);
    expect(pca2d([[1, 2, 3]]).ok).toBe(false);
    expect(pca2d([[1, 2, 3]]).coords).toHaveLength(1);
  });

  test('handles identical vectors (zero variance) without NaN', () => {
    const result = pca2d([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]);
    expect(result.ok).toBe(false);
    for (const [x, y] of result.coords) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  test('rejects inconsistent dimensions', () => {
    const result = pca2d([
      [1, 2, 3],
      [1, 2],
    ]);
    expect(result.ok).toBe(false);
  });

  test('is deterministic across runs', () => {
    const vectors = [
      [3, 1, 4],
      [1, 5, 9],
      [2, 6, 5],
      [3, 5, 8],
    ];
    expect(pca2d(vectors).coords).toEqual(pca2d(vectors).coords);
  });
});
