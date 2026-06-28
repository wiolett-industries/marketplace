/**
 * Dual (Gram-matrix) PCA for projecting high-dimensional embedding vectors to 2D.
 *
 * Pure module: no I/O, no node:sqlite — safe to unit-test directly under jest.
 *
 * For n samples of dimension d (here d ~= 1536 OpenAI dims, n small), forming the
 * d x d covariance matrix is wasteful. Instead we center the samples, build the
 * n x n Gram matrix K = Y Yᵀ, and take its top-2 eigenvectors via power iteration
 * with deflation. The PCA score of sample i on component k is v_k[i] * sqrt(λ_k)
 * — valid only when the eigenvector v_k is unit-norm, so each power-iteration step
 * re-normalizes. Near-zero eigenvalues are treated as degenerate (zero coords).
 */

export interface Pca2dResult {
  /** One [x, y] coordinate per input vector, in input order. */
  coords: Array<[number, number]>;
  /** Fraction of total variance captured by PC1 and PC2 (0..1 each). */
  variance: [number, number];
  /** True when the projection is meaningful (>= 2 distinct vectors, non-zero variance). */
  ok: boolean;
}

const EPSILON = 1e-9;
const MAX_ITERATIONS = 200;
const CONVERGENCE = 1e-7;

function degenerate(n: number): Pca2dResult {
  return { coords: Array.from({ length: n }, () => [0, 0] as [number, number]), variance: [0, 0], ok: false };
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

function norm(vector: number[]): number {
  return Math.sqrt(dot(vector, vector));
}

/** Multiply symmetric n x n matrix by a length-n vector. */
function matVec(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    const row = matrix[i];
    let sum = 0;
    for (let j = 0; j < n; j += 1) sum += row[j] * vector[j];
    out[i] = sum;
  }
  return out;
}

/**
 * Dominant eigenpair of a symmetric PSD matrix via power iteration. The start
 * vector is deterministic (index-perturbed) so output is reproducible without
 * Math.random. Returns null when the matrix is effectively zero.
 */
function dominantEigenpair(matrix: number[][]): { value: number; vector: number[] } | null {
  const n = matrix.length;
  if (n === 0) return null;

  // Deterministic, non-uniform seed: avoids being orthogonal to the top eigenvector.
  let vector = Array.from({ length: n }, (_unused, i) => 1 + Math.sin(i + 1) * 0.5);
  let vectorNorm = norm(vector);
  if (vectorNorm < EPSILON) return null;
  vector = vector.map((value) => value / vectorNorm);

  let eigenvalue = 0;
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const next = matVec(matrix, vector);
    const nextNorm = norm(next);
    if (nextNorm < EPSILON) return null; // matrix annihilates the vector -> zero eigenvalue
    const normalized = next.map((value) => value / nextNorm);

    // Rayleigh quotient with unit vector is just vᵀ K v = nextNorm * (v · normalized)... use direct form.
    const newEigenvalue = dot(normalized, matVec(matrix, normalized));
    const delta = Math.abs(newEigenvalue - eigenvalue);
    vector = normalized;
    eigenvalue = newEigenvalue;
    if (delta < CONVERGENCE) break;
  }

  if (eigenvalue <= EPSILON) return null;
  return { value: eigenvalue, vector };
}

/** Subtract λ·v·vᵀ from the symmetric matrix in place (deflation). */
function deflate(matrix: number[][], eigenvalue: number, vector: number[]): void {
  const n = matrix.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      matrix[i][j] -= eigenvalue * vector[i] * vector[j];
    }
  }
}

/**
 * Project row-vectors to 2D via dual PCA. Vectors of inconsistent or zero length
 * are rejected (caller should pre-filter). Returns degenerate zero-coords when
 * fewer than 2 vectors or when variance collapses.
 */
export function pca2d(vectors: number[][]): Pca2dResult {
  const n = vectors.length;
  if (n < 2) return degenerate(n);

  const dim = vectors[0].length;
  if (dim === 0 || vectors.some((vector) => vector.length !== dim)) return degenerate(n);

  // Center each dimension across the n samples.
  const mean = new Array<number>(dim).fill(0);
  for (const vector of vectors) {
    for (let j = 0; j < dim; j += 1) mean[j] += vector[j];
  }
  for (let j = 0; j < dim; j += 1) mean[j] /= n;

  const centered = vectors.map((vector) => vector.map((value, j) => value - mean[j]));

  // Gram matrix K = Y Yᵀ (n x n), symmetric PSD.
  const gram: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  let trace = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      const value = dot(centered[i], centered[j]);
      gram[i][j] = value;
      gram[j][i] = value;
      if (i === j) trace += value;
    }
  }
  if (trace < EPSILON) return degenerate(n);

  const pc1 = dominantEigenpair(gram);
  if (!pc1) return degenerate(n);
  deflate(gram, pc1.value, pc1.vector);
  const pc2 = dominantEigenpair(gram);

  const scale1 = Math.sqrt(Math.max(pc1.value, 0));
  const scale2 = pc2 ? Math.sqrt(Math.max(pc2.value, 0)) : 0;

  const coords: Array<[number, number]> = [];
  for (let i = 0; i < n; i += 1) {
    const x = pc1.vector[i] * scale1;
    const y = pc2 ? pc2.vector[i] * scale2 : 0;
    coords.push([Number(x.toFixed(6)), Number(y.toFixed(6))]);
  }

  const variance: [number, number] = [
    Number((pc1.value / trace).toFixed(4)),
    pc2 ? Number((pc2.value / trace).toFixed(4)) : 0,
  ];

  return { coords, variance, ok: true };
}
