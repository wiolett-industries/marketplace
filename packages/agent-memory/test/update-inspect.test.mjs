import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('memory update and inspect tools', () => {
  test('updates canonical memory in place and keeps graph links stable', async () => {
    const result = runHarness('update-inspect');

    expect(result.update).toEqual(expect.objectContaining({ updated: true, id: result.ids.primary }));
    expect(result.before.id).toBe(result.after.id);
    expect(result.before.file_name).toBe(result.after.file_name);
    expect(result.after.content).toContain('production bucket');
    expect(result.after.tags).toEqual(['deploy', 'production']);
    expect(result.after.links.outgoing).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: result.ids.related, relation: 'uses_service' })])
    );
    expect(result.relatedBeforeUpdate.links.outgoing).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: result.ids.primary, source: 'auto' })])
    );
    expect(result.relatedAfterUpdate.links.outgoing).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: result.ids.primary, source: 'auto' })])
    );

    expect(result.pointerBefore.id).toBe(result.pointerAfter.id);
    expect(result.pointerAfter.content).toContain(`[→ ${result.ids.primary}] Updated deployment memory`);
    expect(result.graph.outgoing).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: result.ids.related, relation: 'uses_service' })])
    );
    expect(result.all.memories).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: result.ids.primary, content: expect.stringContaining('production bucket') })])
    );
    expect(result.all.index).toEqual(expect.arrayContaining([expect.objectContaining({ ref: result.ids.primary })]));
    expect(result.recall.answer).toContain('production bucket');
    expect(result.recall.sources).toEqual(expect.arrayContaining([expect.objectContaining({ id: result.ids.primary })]));
    expect(result.memoryFiles).toHaveLength(2);
    expect(result.indexFiles).toHaveLength(2);
    expect(result.embeddingFiles).toHaveLength(2);
  });
});
