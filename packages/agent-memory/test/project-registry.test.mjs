import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('project memory registry', () => {
  const result = runHarness('project-registry');

  test('excludes empty project-memory directories and records the first write', () => {
    expect(result.beforeFirstWrite).toEqual([]);
    expect(result.afterFirstWrite).toEqual([
      expect.objectContaining({
        project_path: expect.stringMatching(/pm-project-registry-[^/]+$/),
        memory_root: expect.stringMatching(/pm-project-registry-[^/]+\/\.memory$/),
        first_seen_at: expect.any(String),
        last_seen_at: expect.any(String),
      }),
    ]);
    expect(result.registryPath).toMatch(/\.wiolett\/agent-memory\/projects\.json$/);
    expect(result.empty).toBeNull();
  });

  test('does not report a persisted memory write as failed when the registry is locked', () => {
    expect(result.lockedWrite).toEqual(expect.objectContaining({ action: 'created', id: expect.any(String) }));
    expect(result.afterLockedWrite).toEqual(result.afterFirstWrite);
  });

  test('registers an existing populated memory store at startup without reading its contents', () => {
    expect(result.restored).toEqual(expect.objectContaining({
      project_path: expect.stringMatching(/pm-project-registry-restored-[^/]+$/),
      memory_root: expect.stringMatching(/pm-project-registry-restored-[^/]+\/\.memory$/),
    }));
    expect(result.all).toEqual(expect.arrayContaining([
      expect.objectContaining({ project_path: expect.stringMatching(/pm-project-registry-[^/]+$/) }),
      expect.objectContaining({ project_path: expect.stringMatching(/pm-project-registry-restored-[^/]+$/) }),
    ]));
  });
});

describe('CLI registry boundaries', () => {
  const result = runHarness('cli-help-registry');

  test('does not register existing memory for a read-only help command', () => {
    expect(result.references).toEqual([]);
  });
});

describe('project memory registry on MCP startup', () => {
  const result = runHarness('mcp-startup-registry');

  test('registers a project with existing memory before any MCP write', () => {
    expect(JSON.parse(result.registry.content[0].text)).toEqual({
      projects: [expect.objectContaining({
        project_path: expect.stringMatching(/pm-mcp-startup-registry-[^/]+$/),
        memory_root: expect.stringMatching(/pm-mcp-startup-registry-[^/]+\/\.memory$/),
      })],
    });
  });

  test('does not wait for an occupied registry lock before serving MCP', () => {
    expect(result.startupDurationMs).toBeLessThan(1_000);
  });
});
