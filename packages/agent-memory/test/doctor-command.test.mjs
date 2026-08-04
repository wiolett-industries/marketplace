import { describe, expect, test } from '@jest/globals';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectDoctorReport, formatDoctorReport } from '../dist/cli/doctor-command.js';

const manifests = {
  'agent-memory': '1.0.0',
  workflow: '1.0.0',
  'merge-request-review': '1.0.0',
};

function fetchGithub(url) {
  const match = url.match(/plugins\/([^/]+)\//u);
  const version = match && manifests[match[1]];
  return Promise.resolve(new Response(JSON.stringify({ version }), { status: version ? 200 : 404 }));
}

function runCommand(command, args) {
  if (command !== 'codex') return { ok: false, stdout: '' };
  if (args[0] === 'plugin') {
    return { ok: true, stdout: JSON.stringify({ installed: [
      { name: 'agent-memory', marketplaceName: 'wiolett-industries', version: '1.0.0', enabled: true },
      { name: 'workflow', marketplaceName: 'wiolett-industries', version: '0.9.9', enabled: true },
      { name: 'merge-request-review', marketplaceName: 'wiolett-industries', version: '1.0.0', enabled: true },
    ] }) };
  }
  if (args[2] === 'agent-memory') {
    return { ok: true, stdout: JSON.stringify({ enabled: true, transport: { type: 'stdio', command: 'npx', args: ['-y', '@wiolett/agent-memory@latest'] } }) };
  }
  if (args[2] === 'workflow') {
    return { ok: true, stdout: JSON.stringify({ enabled: false, transport: { type: 'stdio', command: 'npx', args: ['-y', '@wiolett/workflow@latest'] } }) };
  }
  return { ok: false, stdout: '' };
}

describe('Doctor command', () => {
  test('compares GitHub manifests with local plugin and MCP state without writing', async () => {
    const report = await collectDoctorReport({ fetch: fetchGithub, runCommand, homeDirectory: '/not-present' });
    expect(report.githubVersions.workflow).toBe('1.0.0');
    expect(report.codexPlugins.workflow?.version).toBe('0.9.9');
    expect(report.codexMcp['agent-memory']).toEqual({ enabled: true, expectedCommand: true });
    expect(report.issues.map((issue) => issue.title)).toEqual(expect.arrayContaining([
      'Codex plugin workflow is behind',
      'Codex MCP workflow is disabled',
      'Codex MCP merge-request-review is not configured',
    ]));
    const output = formatDoctorReport(report);
    expect(output).toContain('3 actions need attention');
    expect(output).toContain('Update the Codex marketplace');
    expect(output).toContain('Workflow: 0.9.9 → 1.0.0');
    expect(output).toContain('codex plugin marketplace upgrade wiolett-industries');
    expect(output).toContain('Current state');
  });

  test('reports an unavailable GitHub manifest rather than treating it as current', async () => {
    const report = await collectDoctorReport({
      fetch: async () => new Response('', { status: 503 }),
      runCommand: () => ({ ok: false, stdout: '' }),
      homeDirectory: '/not-present',
    });
    expect(report.issues.filter((issue) => issue.title.startsWith('Could not check GitHub version'))).toHaveLength(3);
    expect(formatDoctorReport(report)).toContain('unavailable');
  });

  test('detects an incomplete Codex skill cache even when the plugin is installed', async () => {
    const cacheHome = mkdtempSync(join(tmpdir(), 'agent-memory-doctor-'));
    try {
      const agentMemoryCache = join(cacheHome, '.codex', 'plugins', 'cache', 'wiolett-industries', 'agent-memory', '1.0.0');
      mkdirSync(join(agentMemoryCache, '.codex-plugin'), { recursive: true });
      mkdirSync(join(agentMemoryCache, 'skills', 'using-agent-memory'), { recursive: true });
      writeFileSync(join(agentMemoryCache, '.codex-plugin', 'plugin.json'), JSON.stringify({ version: '1.0.0' }));
      writeFileSync(join(agentMemoryCache, 'skills', 'using-agent-memory', 'SKILL.md'), '---\nname: using-agent-memory\n---\n');

      const report = await collectDoctorReport({ fetch: fetchGithub, runCommand, homeDirectory: cacheHome });
      expect(report.codexSkills['agent-memory']).toEqual({
        expected: 2,
        cached: 1,
        missing: ['reconciling-memory'],
        invalid: [],
      });
      expect(report.issues.map((issue) => issue.title)).toContain('Codex skill cache agent-memory is incomplete');
      const output = formatDoctorReport(report);
      expect(output).toContain('Refresh cached Codex skills');
      expect(output).toContain('Agent Memory: 1 / 2 skills cached');
      expect(output).toContain('Missing or invalid: reconciling-memory');
    } finally {
      rmSync(cacheHome, { recursive: true, force: true });
    }
  });
});
