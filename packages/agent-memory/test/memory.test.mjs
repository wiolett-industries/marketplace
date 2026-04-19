import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('memory operations', () => {
  test('auto-initializes memory before normal memory operations', async () => {
    const result = runHarness('memory');
    expect(result.memoryAutoCreated).toBe(true);
    expect(result.memoryFiles).toHaveLength(3);
    expect(result.embeddingFiles).toHaveLength(3);
    expect(result.liteEntries).toHaveLength(2);
    expect(result.liteEntries.some((entry) => entry.ref === result.ids.deep && entry.content.includes(`[→ ${result.ids.deep}]`))).toBe(true);
    expect(result.readAll).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: result.ids.service, layer: 'deep' }),
        expect.objectContaining({ ref: result.ids.service, layer: 'lite' }),
      ])
    );
    expect(result.symmetric.mirrored).toBe(true);
    expect(result.deepEntry.links.outgoing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relation: 'uses_service', id: result.ids.service }),
        expect.objectContaining({ relation: 'related_to', id: result.ids.service }),
      ])
    );
    expect(result.serviceEntry.links.incoming).toEqual(
      expect.arrayContaining([expect.objectContaining({ relation: 'uses_service', id: result.ids.deep })])
    );
    expect(result.serviceEntry.links.outgoing).toEqual(
      expect.arrayContaining([expect.objectContaining({ relation: 'related_to', id: result.ids.deep })])
    );
    expect(result.neighbors.neighbors.length).toBeGreaterThanOrEqual(2);
    expect(result.subgraph.nodes.map((node) => node.id).sort()).toEqual([result.ids.deep, result.ids.service].sort());
    expect(result.subgraph.edges).toEqual(
      expect.arrayContaining([expect.objectContaining({ relation: 'uses_service', to_id: result.ids.service })])
    );
    expect(result.search.length).toBeGreaterThan(0);
    expect(result.search[0].links).toBeDefined();
    expect(result.readAll.find((entry) => entry.id === result.ids.deep).links).toBeDefined();
    expect(result.unlinkResult).toEqual({
      removed: true,
      mirrored_removed: true,
    });
    expect(result.deleted.deleted).toBe(true);
    expect(result.deepAfterDelete.links.outgoing).toHaveLength(0);
    expect(result.graphFilesAfterDelete).toHaveLength(0);
  });
});
