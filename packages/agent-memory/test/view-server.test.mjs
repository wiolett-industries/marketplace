import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

// Boots the real view HTTP server in a spawned node process (node:sqlite works
// there) against a seeded temp .memory, hits the JSON API, then shuts down.

describe('view server (read-only dashboard API)', () => {
  const result = runHarness('view-server');

  test('binds an ephemeral port and serves the SPA shell', () => {
    expect(result.port).toBeGreaterThan(0);
    expect(result.servesIndex).toBe(true);
  });

  test('/api/meta reports an enabled store with the passed version', () => {
    expect(result.metaEnabled).toBe(true);
    expect(result.metaVersion).toBe('9.9.9');
    expect(result.embeddingsAvailable).toBe(true);
  });

  test('/api/graph exposes nodes, edges, superseded and symmetric flags', () => {
    expect(result.graphNodes).toBeGreaterThanOrEqual(5);
    expect(result.graphEdges).toBeGreaterThanOrEqual(4);
    expect(result.supersededCount).toBe(1);
    expect(result.symmetricEdgeCount).toBeGreaterThanOrEqual(1);
  });

  test('/api/health and /api/list return populated data', () => {
    expect(result.healthEdges).toBeGreaterThanOrEqual(4);
    expect(result.listCount).toBeGreaterThanOrEqual(5);
  });

  test('/api/scatter projects the injected embeddings', () => {
    expect(result.scatterN).toBe(5);
    expect(result.scatterPoints).toBe(5);
  });

  test('/api/search ranks results', () => {
    expect(result.searchCount).toBeGreaterThan(0);
  });

  test('/api/query returns a graph-expanded candidate list', () => {
    expect(result.queryHasCandidates).toBe(true);
    expect(result.queryCandidateCount).toBeGreaterThan(0);
  });

  test('/api/memory/:id returns detail with links, 404 for unknown', () => {
    expect(result.detailHasLinks).toBe(true);
    expect(result.missingStatus).toBe(404);
  });

  test('/api/path finds a route between connected memories', () => {
    expect(result.pathFound).toBe(true);
    expect(result.pathHops).toBeGreaterThanOrEqual(1);
  });

  test('static serving blocks path traversal', () => {
    expect(result.traversalStatus).toBe(403);
  });
});
