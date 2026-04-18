import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('MCP launcher smoke test', () => {
  test('start-mcp.sh exposes tools and handles basic calls', async () => {
    const result = runHarness('mcp');
    expect(result.toolNames).toEqual(
      expect.arrayContaining([
        'agent_memory_configure',
        'memory_setup',
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
    expect(result.configure.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.setup.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.write.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.globalWrite.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.lite.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.globalLite.content[0]).toEqual(expect.objectContaining({ type: 'text' }));
    expect(result.lite.content[0].text).toContain('Smoke memory');
    expect(result.globalLite.content[0].text).toContain('Smoke global preference');
    expect(result.configPath).toContain('/agent-memory/config.json');
    expect(result.storedConfig.openaiApiKey).toBe('sk-test-configured');
  }, 30000);
});
