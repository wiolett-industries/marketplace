import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('MCP launcher smoke test', () => {
  test('MCP server handles basic calls without exposing gate bypass', async () => {
    const result = runHarness('mcp');
    expect(result.toolNames).toEqual(
      expect.arrayContaining([
        'memory_setup',
        'memory_save',
        'memory_update',
        'memory_recall',
        'memory_query',
        'memory_list',
        'memory_inspect',
        'memory_graph',
        'memory_path',
        'memory_graph_prune',
        'global_memory_path',
        'global_memory_graph_prune',
        'memory_write',
        'memory_get',
        'memory_read_lite',
        'memory_search',
        'memory_delete',
        'memory_link',
        'memory_unlink',
        'memory_neighbors',
        'memory_subgraph',
        'memory_read_all',
        'global_memory_write',
        'global_memory_get',
        'global_memory_read_lite',
        'global_memory_search',
        'global_memory_delete',
        'global_memory_link',
        'global_memory_unlink',
        'global_memory_neighbors',
        'global_memory_subgraph',
        'global_memory_read_all',
      ])
    );
    expect(result.toolNames).not.toContain('agent_memory_configure');
    const memorySave = result.toolSchemas.find((tool) => tool.name === 'memory_save');
    const memoryUpdate = result.toolSchemas.find((tool) => tool.name === 'memory_update');
    expect(JSON.stringify(memorySave)).not.toContain('bypass_gate');
    expect(JSON.stringify(memoryUpdate)).not.toContain('bypass_gate');
    expect(result.setup.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.write.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.globalWrite.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(JSON.parse(result.globalWrite.content[0].text)).toEqual(
      expect.objectContaining({ saved: false })
    );
    expect(JSON.parse(result.get.content[0].text)).toEqual(
      expect.objectContaining({ content: 'Smoke test memory from MCP launcher' })
    );
    expect(Array.isArray(JSON.parse(result.search.content[0].text))).toBe(true);
    expect(result.lite.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.globalLite.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.canonicalWrite.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.query.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.inspect.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.lite.content[0].text).toContain('Smoke memory');
    expect(result.globalLite.content[0].text).not.toContain('Smoke global preference');
  }, 30000);

  test('read tools do not initialize missing project memory', async () => {
    const result = runHarness('mcp-read-uninitialized');
    expect(result.projectMemoryDirCreated).toBe(false);
    expect(result.globalMemoryDirCreated).toBe(false);
    expect(JSON.parse(result.lite.content[0].text)).toEqual([]);
    expect(JSON.parse(result.list.content[0].text)).toEqual([]);
    expect(JSON.parse(result.query.content[0].text)).toEqual({
      answer: '',
      sources: [],
      candidates: [],
    });
    expect(JSON.parse(result.get.content[0].text)).toBeNull();
    expect(JSON.parse(result.inspect.content[0].text)).toEqual({
      memories: [],
      index: [],
      graph: [],
    });
  }, 30000);
});
