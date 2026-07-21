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
        'memory_recap',
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
    const memoryList = result.toolSchemas.find((tool) => tool.name === 'memory_list');
    const memoryReadLite = result.toolSchemas.find((tool) => tool.name === 'memory_read_lite');
    const memoryUpdate = result.toolSchemas.find((tool) => tool.name === 'memory_update');
    expect(JSON.stringify(memorySave)).not.toContain('bypass_gate');
    expect(JSON.stringify(memoryUpdate)).not.toContain('bypass_gate');
    expect(JSON.stringify(memoryList)).toContain('workspace_root');
    expect(JSON.stringify(memoryReadLite)).toContain('workspace_root');
    expect(JSON.stringify(memoryList)).toContain('By default this includes deep memories and lite index records');
    expect(JSON.stringify(memoryList)).toContain('Return only lightweight index/pointer records');
    expect(JSON.stringify(memoryList)).toContain('Relative paths are rejected');
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
    expect(result.recap.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.inspect.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.lite.content[0].text).toContain('Smoke memory');
    expect(result.canonicalList.content[0].text).toContain('Canonical smoke memory');
    expect(result.canonicalList.content[0].text).toContain('Smoke test memory from MCP launcher');
    expect(result.canonicalIndexList.content[0].text).toContain('Canonical smoke memory');
    expect(result.globalLite.content[0].text).not.toContain('Smoke global preference');
  }, 30000);

  test('project reads can target a workspace root when MCP cwd differs', async () => {
    const result = runHarness('mcp-workspace-root');
    const wrongCwdList = JSON.parse(result.wrongCwdList.content[0].text);
    const rootedList = JSON.parse(result.rootedList.content[0].text);
    const rootedIndexList = JSON.parse(result.rootedIndexList.content[0].text);
    const rootedInspect = JSON.parse(result.rootedInspect.content[0].text);
    const ancestorList = JSON.parse(result.ancestorList.content[0].text);
    const nestedRepoList = JSON.parse(result.nestedRepoList.content[0].text);

    expect(wrongCwdList).toEqual([]);
    expect(nestedRepoList).toEqual([]);
    expect(JSON.stringify(result.relativeRootResult ?? result.relativeRootError)).toMatch(/workspace_root must be an absolute path/);
    expect(rootedList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: result.ids.deep, layer: 'deep' }),
        expect.objectContaining({ id: result.ids.pointer, layer: 'lite', ref: result.ids.deep }),
      ])
    );
    expect(rootedIndexList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: result.ids.pointer, layer: 'lite', ref: result.ids.deep }),
      ])
    );
    expect(rootedInspect.memories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: result.ids.deep }),
      ])
    );
    expect(ancestorList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: result.ids.deep }),
      ])
    );
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
    expect(JSON.parse(result.recap.content[0].text)).toEqual({
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
