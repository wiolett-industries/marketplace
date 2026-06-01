import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('memory operations', () => {
  test('auto-initializes memory before normal memory operations', async () => {
    const result = runHarness('memory');
    expect(result.memoryAutoCreated).toBe(true);
    expect(result.memoryFiles).toHaveLength(1);
    expect(result.indexFiles).toHaveLength(2);
    expect(result.embeddingFiles).toHaveLength(1);
    expect(Array.isArray(JSON.parse(result.embeddingFileContents))).toBe(true);
    expect(result.autoLinks.service).toBeGreaterThanOrEqual(1);
    expect(result.serviceAutoEntry.links.outgoing).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: result.ids.deep, source: 'auto' })])
    );
    expect(result.autoLinks.lite).toBeGreaterThanOrEqual(1);
    expect(result.liteAutoEntry.links.outgoing.length).toBeGreaterThanOrEqual(1);
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
    expect(result.subgraph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([result.ids.deep, result.ids.service, result.ids.lite])
    );
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
    expect(result.rawGraphAfterDelete).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from_id: result.ids.service }),
        expect.objectContaining({ to_id: result.ids.service }),
      ])
    );
    expect(result.graphFilesAfterDelete).not.toEqual(
      expect.arrayContaining([expect.stringContaining(result.ids.service)])
    );
  });
});
